'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';
import { admin, currentUser, formText, isAssigned, parseMoney } from '@/lib/access';
import { db } from '@/lib/db';
import { AuditLog } from '@/models/AuditLog';
import { Event } from '@/models/Event';
import { Expense } from '@/models/Expense';
import { ExpenseCategory } from '@/models/ExpenseCategory';
import { Income } from '@/models/Income';
import { ManagerHandover } from '@/models/ManagerHandover';
import { Team } from '@/models/Team';
import { User } from '@/models/User';
import { isIncomeSector, isUnitForSector } from '@/lib/sectors';

type AppUser = { id: string; role: string };
type EventStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
const MAX_INCOME_MINOR = 100_000 * 100;
export type ChangePasswordState = { error?: string; success?: string };

function isEventStatus(status: string): status is EventStatus {
  return status === 'UPCOMING' || status === 'ACTIVE' || status === 'COMPLETED';
}

function parseOptionalTarget(value: FormDataEntryValue | null) {
  const amount = String(value ?? '').trim();
  if (!amount) return 0;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(amount)) {
    throw new Error('Enter a valid target amount');
  }
  const [whole, fraction = ''] = amount.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) throw new Error('Invalid target amount');
  return minor;
}

function incomeFormValues(form: FormData, locationError = 'Select a valid sector and unit') {
  const from = formText(form, 'from', 250);
  const fromMl = formText(form, 'from_ml', 250);
  const sector = formText(form, 'sector', 40);
  const unit = formText(form, 'unit', 80);
  const amountMinor = parseMoney(form.get('amount'));
  const category = formText(form, 'category', 70);
  if (category !== 'Donation' && category !== 'Rifadha') throw new Error('Select a valid income category');
  if (!from) throw new Error('Received From is required');
  if (category === 'Rifadha' && !fromMl) throw new Error('Received From (Malayalam) is required for Rifadha');
  if (amountMinor > MAX_INCOME_MINOR) throw new Error('Income cannot exceed ₹100,000 per entry');
  if (category === 'Rifadha' && amountMinor < 100_000) throw new Error('Rifadha income must be at least ₹1,000');
  if (!isIncomeSector(sector) || !isUnitForSector(sector, unit)) throw new Error(locationError);
  return { from, fromMl, sector, unit, amountMinor, category };
}

function revalidateEventPages() {
  for (const path of ['/', '/events', '/transactions', '/income', '/expense', '/paid-to-admin', '/expense-approvals']) {
    revalidatePath(path);
  }
}

export async function login(form: FormData) {
  try {
    await signIn('credentials', {
      email: formText(form, 'email'),
      password: formText(form, 'password'),
      redirectTo: '/',
    });
  } catch (error) {
    if (error instanceof AuthError && error.type === 'CredentialsSignin') {
      redirect('/login?error=invalid');
    }
    if (error instanceof AuthError && error.type === 'CallbackRouteError') {
      redirect('/login?error=unavailable');
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: '/login' });
}

export async function changePassword(
  _previousState: ChangePasswordState,
  form: FormData,
): Promise<ChangePasswordState> {
  const currentPassword = form.get('currentPassword');
  const newPassword = form.get('newPassword');
  const confirmPassword = form.get('confirmPassword');
  if (
    typeof currentPassword !== 'string' ||
    typeof newPassword !== 'string' ||
    typeof confirmPassword !== 'string' ||
    currentPassword.length === 0 ||
    newPassword.length < 6 ||
    Buffer.byteLength(newPassword, 'utf8') > 72
  ) {
    return { error: 'Enter your current password and a new password between 6 and 72 bytes.' };
  }
  if (newPassword !== confirmPassword) {
    return { error: 'The new passwords do not match.' };
  }

  const user = await currentUser();
  const account = await User.findById(user.id).select('+passwordHash');
  if (!account || !account.active) return { error: 'Your account is no longer available.' };
  if (!(await bcrypt.compare(currentPassword, account.passwordHash))) {
    return { error: 'Your current password is incorrect.' };
  }
  if (await bcrypt.compare(newPassword, account.passwordHash)) {
    return { error: 'Choose a password different from your current password.' };
  }

  account.passwordHash = await bcrypt.hash(newPassword, 12);
  await account.save();
  await AuditLog.create({
    actorId: account._id,
    action: 'PASSWORD_CHANGED',
    entityId: account._id,
  });
  return { success: 'Your password has been changed.' };
}

async function activeFor(user: AppUser) {
  await db();
  const event = await Event.findOne({ status: 'ACTIVE' });
  if (!event) throw new Error('No active event');
  if (!isAssigned(event, user)) throw new Error('Event access denied');
  return event;
}

export async function addIncome(form: FormData) {
  const user = await currentUser();
  const event = await activeFor(user);
  const { from, fromMl, sector, unit, amountMinor, category } = incomeFormValues(form);

  const income = await Income.create({
    eventId: event._id,
    amountMinor,
    category,
    sector,
    unit,
    from,
    from_ml: category === 'Rifadha' ? fromMl : '',
    address: formText(form, 'address', 500),
    method: formText(form, 'method') || 'CASH',
    note: formText(form, 'note'),
    createdBy: user.id,
  });
  await AuditLog.create({
    actorId: user.id,
    action: 'INCOME_CREATED',
    entityId: income._id,
    detail: {
      eventId: event._id,
      amountMinor,
      category: income.category,
      from: income.from,
      sector: income.sector,
      unit: income.unit,
    },
  });
  revalidatePath('/');
  revalidatePath('/transactions');
  redirect(`/receipt/${income._id}`);
}

export async function addExpense(form: FormData) {
  const user = await currentUser();
  const event = await activeFor(user);
  const isAdmin = user.role === 'SUPER_ADMIN';
  const category = formText(form, 'category', 70);
  if (!category) throw new Error('Expense category is required');
  const expense = await Expense.create({
    eventId: event._id,
    amountMinor: parseMoney(form.get('amount')),
    category,
    paidTo: formText(form, 'paidTo'),
    method: formText(form, 'method') || 'CASH',
    note: formText(form, 'note'),
    status: isAdmin ? 'APPROVED' : 'PENDING',
    createdBy: user.id,
    ...(isAdmin ? { decidedBy: user.id, decidedAt: new Date() } : {}),
  });
  await AuditLog.create({
    actorId: user.id,
    action: isAdmin ? 'EXPENSE_CREATED_APPROVED' : 'EXPENSE_SUBMITTED',
    entityId: expense._id,
  });
  revalidatePath('/');
  redirect('/?saved=expense');
}

export async function createExpenseCategory(form: FormData) {
  const user = await admin();
  await db();
  const name = formText(form, 'name', 70);
  if (!name) throw new Error('Category name is required');
  const key = name.toLocaleLowerCase();
  if (await ExpenseCategory.exists({ key })) throw new Error('Expense category already exists');
  const category = await ExpenseCategory.create({ name, key, createdBy: user.id });
  await AuditLog.create({
    actorId: user.id,
    action: 'EXPENSE_CATEGORY_CREATED',
    entityId: category._id,
    detail: { name },
  });
  revalidatePath('/expense');
}

export async function decideExpense(form: FormData) {
  const user = await admin();
  await db();
  const id = formText(form, 'id');
  const decision = formText(form, 'decision');
  if (!Types.ObjectId.isValid(id) || !['APPROVED', 'REJECTED'].includes(decision)) {
    throw new Error('Invalid action');
  }
  const reason = formText(form, 'reason');
  if (decision === 'REJECTED' && !reason) throw new Error('Provide a rejection reason');

  const expense = await Expense.findById(id);
  if (!expense || expense.status !== 'PENDING') throw new Error('Expense already processed');
  const event = await Event.findById(expense.eventId);
  if (!event || event.status !== 'ACTIVE') throw new Error('Event is not active');

  const updated = await Expense.findOneAndUpdate(
    { _id: id, status: 'PENDING' },
    {
      $set: {
        status: decision,
        decidedBy: user.id,
        decidedAt: new Date(),
        ...(decision === 'REJECTED' ? { rejectionReason: reason } : {}),
      },
    },
    { new: true },
  );
  if (!updated) throw new Error('Expense already processed');
  await AuditLog.create({
    actorId: user.id,
    action: `EXPENSE_${decision}`,
    entityId: updated._id,
    detail: { reason },
  });
  revalidatePath('/');
  revalidatePath('/paid-to-admin');
  revalidatePath('/expense-approvals');
  revalidatePath('/transactions');
}

export async function createEvent(form: FormData) {
  const user = await admin();
  await db();
  const name = formText(form, 'name', 120);
  const date = formText(form, 'date');
  const status = formText(form, 'status') || 'UPCOMING';
  if (
    !name ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    !isEventStatus(status)
  ) {
    throw new Error('Name and a valid date are required');
  }
  if (status === 'ACTIVE' && await Event.exists({ status: 'ACTIVE' })) {
    throw new Error('Complete the existing active event first');
  }
  await Event.create({
    name,
    eventDate: new Date(`${date}T12:00:00`),
    location: formText(form, 'location'),
    targetMinor: parseOptionalTarget(form.get('target')),
    createdBy: user.id,
    status,
  });
  revalidatePath('/events');
  revalidatePath('/');
  redirect('/events');
}

export async function updateEvent(form: FormData) {
  const user = await admin();
  await db();
  const id = formText(form, 'id');
  const name = formText(form, 'name', 120);
  const date = formText(form, 'date');
  const status = formText(form, 'status');
  if (
    !Types.ObjectId.isValid(id) ||
    !name ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    !isEventStatus(status)
  ) {
    throw new Error('Valid event name and date are required');
  }
  if (status === 'ACTIVE' && await Event.exists({ _id: { $ne: id }, status: 'ACTIVE' })) {
    throw new Error('Complete the existing active event first');
  }
  if (status === 'COMPLETED' && await Expense.exists({ eventId: id, status: 'PENDING' })) {
    throw new Error('Resolve pending expenses before completing this event');
  }
  const event = await Event.findByIdAndUpdate(
    id,
    {
      $set: {
        name,
        eventDate: new Date(`${date}T12:00:00`),
        location: formText(form, 'location', 250),
        targetMinor: parseOptionalTarget(form.get('target')),
        status,
      },
    },
    { new: true },
  );
  if (!event) throw new Error('Event not found');
  await AuditLog.create({
    actorId: user.id,
    action: 'EVENT_UPDATED',
    entityId: event._id,
    detail: { status },
  });
  revalidateEventPages();
}

export async function createManager(form: FormData) {
  const user = await admin();
  await db();
  const email = formText(form, 'email').toLowerCase();
  const name = formText(form, 'name');
  const password = formText(form, 'password', 200);
  if (!/^\S+@\S+\.\S+$/.test(email) || !name || password.length < 6) {
    throw new Error('Valid name, email and 6+ character password required');
  }
  const manager = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'MANAGER',
  });
  await AuditLog.create({
    actorId: user.id,
    action: 'MANAGER_CREATED',
    entityId: manager._id,
  });
  revalidatePath('/managers');
  redirect('/managers');
}

export async function updateManager(form: FormData) {
  const user = await admin();
  await db();
  const id = formText(form, 'id');
  const name = formText(form, 'name');
  const email = formText(form, 'email').toLowerCase();
  const password = formText(form, 'password', 200);
  const active = formText(form, 'active');
  if (
    !Types.ObjectId.isValid(id) ||
    !name ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    !['true', 'false'].includes(active) ||
    (password.length > 0 && password.length < 6)
  ) {
    throw new Error('Valid name, email, status and optional 6+ character password required');
  }
  const $set: { name: string; email: string; active: boolean; passwordHash?: string } = {
    name,
    email,
    active: active === 'true',
  };
  if (password) $set.passwordHash = await bcrypt.hash(password, 12);
  const manager = await User.findOneAndUpdate(
    { _id: id, role: 'MANAGER' },
    { $set },
    { new: true },
  );
  if (!manager) throw new Error('Manager not found');
  await AuditLog.create({
    actorId: user.id,
    action: 'MANAGER_UPDATED',
    entityId: manager._id,
  });
  revalidatePath('/managers');
  revalidatePath('/events');
  revalidatePath('/');
}

export async function createTeam(form: FormData) {
  const user = await admin();
  await db();
  const rawNames = String(form.get('names') ?? '');
  if (rawNames.length > 5000) throw new Error('Team names are too long');
  const names = [
    ...new Set(
      rawNames
        .split(/\r?\n/)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  if (!names.length || names.some((name) => name.length > 80)) {
    throw new Error('Enter one or more team names, each no longer than 80 characters');
  }
  const keyedNames = names.map((name) => ({ name, key: name.toLocaleLowerCase('en') }));
  if (new Set(keyedNames.map(({ key }) => key)).size !== keyedNames.length) {
    throw new Error('Team names must be unique');
  }
  if (await Team.exists({ key: { $in: keyedNames.map(({ key }) => key) } })) {
    throw new Error('A team with one of these names already exists');
  }
  const rawTeamTarget = String(form.get('teamTarget') ?? '').trim();
  const teamTarget = rawTeamTarget ? parseOptionalTarget(rawTeamTarget) : 0;
  const teamTargetEventId = formText(form, 'teamTargetEventId');
  let targetEvent = null;
  if (teamTargetEventId || rawTeamTarget) {
    if (!Types.ObjectId.isValid(teamTargetEventId)) throw new Error('Select an event for the team target');
    targetEvent = await Event.findOne({
      _id: teamTargetEventId,
      status: { $ne: 'COMPLETED' },
    });
    if (!targetEvent) throw new Error('Selected event is unavailable for team targets');
  }
  const teams = await Team.insertMany(
    keyedNames.map(({ name, key }) => ({ name, key, createdBy: user.id })),
  );
  if (targetEvent) {
    const selectedManagerIds = new Set(
      form.getAll('teamManagerIds')
        .filter((value): value is string => typeof value === 'string' && Types.ObjectId.isValid(value)),
    );
    const assignedManagers = await User.find({
      _id: { $in: targetEvent.managerIds },
      role: 'MANAGER',
    }).select('_id').lean();
    const assignedManagerIds = new Set(assignedManagers.map((manager) => String(manager._id)));
    if ([...selectedManagerIds].some((managerId) => !assignedManagerIds.has(managerId))) {
      throw new Error('One or more selected managers are not assigned to this event');
    }

    for (const team of teams) {
      targetEvent.teamTargets.push({ teamId: team._id, targetMinor: teamTarget });
    }
    if (teams.length === 1) {
      const team = teams[0];
      const assignmentsByManager = new Map(
        targetEvent.managerTeams.map((assignment) => [String(assignment.managerId), assignment]),
      );
      for (const managerId of selectedManagerIds) {
        const existingAssignment = assignmentsByManager.get(managerId);
        if (existingAssignment) existingAssignment.teamId = team._id;
        else targetEvent.managerTeams.push({
          managerId: new Types.ObjectId(managerId),
          teamId: team._id,
        });
      }
      targetEvent.markModified('managerTeams');
    }
    targetEvent.markModified('teamTargets');
    await targetEvent.save();
  }
  await AuditLog.insertMany(
    teams.map((team) => ({
      actorId: user.id,
      action: 'TEAM_CREATED',
      entityId: team._id,
      detail: { name: team.name },
    })),
  );
  revalidatePath('/managers');
  revalidatePath('/events');
}

export async function updateTeam(form: FormData) {
  const user = await admin();
  await db();
  const teamId = formText(form, 'teamId');
  const name = formText(form, 'name', 80);
  const eventId = formText(form, 'teamTargetEventId');
  if (!Types.ObjectId.isValid(teamId) || !name) throw new Error('Valid team and name are required');
  const key = name.toLocaleLowerCase('en');
  if (await Team.exists({ key, _id: { $ne: teamId } })) {
    throw new Error('A team with this name already exists');
  }

  let targetEvent = null;
  let targetMinor: number | null = null;
  const rawTarget = String(form.get('teamTarget') ?? '').trim();
  if (eventId) {
    if (!Types.ObjectId.isValid(eventId)) throw new Error('Select a valid event');
    targetEvent = await Event.findOne({ _id: eventId, status: { $ne: 'COMPLETED' } });
    if (!targetEvent) throw new Error('Selected event is unavailable for team targets');
    if (rawTarget) targetMinor = parseOptionalTarget(rawTarget);
  } else if (rawTarget) {
    throw new Error('Select an event for the team target');
  }

  const team = await Team.findByIdAndUpdate(
    teamId,
    { $set: { name, key } },
    { new: true },
  );
  if (!team) throw new Error('Team not found');

  if (targetEvent && targetMinor !== null) {
    const existing = targetEvent.teamTargets.find((target) => String(target.teamId) === teamId);
    if (existing) existing.targetMinor = targetMinor;
    else targetEvent.teamTargets.push({ teamId: team._id, targetMinor });
    targetEvent.markModified('teamTargets');
    await targetEvent.save();
  }

  if (targetEvent && form.get('manageTeamMembers') === 'true') {
    const selectedManagerIds = new Set(
      form.getAll('teamManagerIds')
        .filter((value): value is string => typeof value === 'string' && Types.ObjectId.isValid(value)),
    );
    const assignedManagers = await User.find({
      _id: { $in: targetEvent.managerIds },
      role: 'MANAGER',
    }).select('_id teamIds').lean();
    const assignedManagerIds = new Set(assignedManagers.map((manager) => String(manager._id)));
    if ([...selectedManagerIds].some((managerId) => !assignedManagerIds.has(managerId))) {
      throw new Error('One or more selected managers are not assigned to this event');
    }

    const assignmentsByManager = new Map(
      targetEvent.managerTeams.map((assignment) => [String(assignment.managerId), assignment]),
    );
    for (const manager of assignedManagers) {
      const managerId = String(manager._id);
      const existingAssignment = assignmentsByManager.get(managerId);
      const legacyMember = !existingAssignment && manager.teamIds?.some((memberTeamId) => String(memberTeamId) === teamId);
      const currentMember = String(existingAssignment?.teamId ?? '') === teamId || legacyMember;
      if (!selectedManagerIds.has(managerId) && !currentMember) continue;

      if (existingAssignment) {
        existingAssignment.teamId = selectedManagerIds.has(managerId) ? team._id : null;
      } else {
        targetEvent.managerTeams.push({
          managerId: manager._id,
          teamId: selectedManagerIds.has(managerId) ? team._id : null,
        });
      }
    }
    targetEvent.markModified('managerTeams');
    await targetEvent.save();
  }

  await AuditLog.create({
    actorId: user.id,
    action: 'TEAM_UPDATED',
    entityId: team._id,
    detail: { name, teamTargetEventId: eventId || null, membersManaged: form.get('manageTeamMembers') === 'true' },
  });
  revalidatePath('/managers');
  revalidatePath('/events');
  revalidatePath('/');
}

export async function resetManagerPasswordForSharing(managerId: string) {
  const user = await admin();
  await db();
  if (!Types.ObjectId.isValid(managerId)) throw new Error('Valid manager is required');

  const manager = await User.findOne({ _id: managerId, role: 'MANAGER', active: true }).select('_id');
  if (!manager) throw new Error('Active manager not found');

  const password = randomBytes(12).toString('base64url');
  manager.set('passwordHash', await bcrypt.hash(password, 12));
  await manager.save();
  await AuditLog.create({
    actorId: user.id,
    action: 'MANAGER_PASSWORD_RESET_FOR_SHARING',
    entityId: manager._id,
  });
  revalidatePath('/managers');
  return password;
}

export async function assignManagers(form: FormData) {
  const user = await admin();
  await db();
  const eventId = formText(form, 'eventId');
  const teamId = formText(form, 'teamId');
  const ids = [
    ...new Set(
      form
        .getAll('managerIds')
        .filter((value): value is string => typeof value === 'string')
        .filter((id) => Types.ObjectId.isValid(id)),
    ),
  ];
  if (!Types.ObjectId.isValid(eventId) || ids.length === 0) {
    throw new Error('Select at least one valid manager');
  }
  if (teamId && !Types.ObjectId.isValid(teamId)) throw new Error('Select a valid team');
  const managerIds = ids.map((id) => new Types.ObjectId(id));
  const teamObjectId = teamId ? new Types.ObjectId(teamId) : null;
  const managerCount = await User.countDocuments({
    _id: { $in: managerIds },
    role: 'MANAGER',
    active: true,
  });
  if (managerCount !== managerIds.length) throw new Error('One or more managers are unavailable');
  if (teamObjectId && !await Team.exists({ _id: teamObjectId })) {
    throw new Error('Selected team no longer exists');
  }

  const event = await Event.findOneAndUpdate(
    {
      _id: eventId,
      status: { $ne: 'COMPLETED' },
      managerIds: { $nin: managerIds },
    },
    {
      $addToSet: {
        managerIds: { $each: managerIds },
        managerTeams: {
          $each: managerIds.map((managerId) => ({ managerId, teamId: teamObjectId })),
        },
        managerTargets: {
          $each: managerIds.map((managerId) => ({
            managerId,
            targetMinor: parseOptionalTarget(form.get('managerTarget')),
          })),
        },
      },
    },
    { new: true },
  );
  if (!event) throw new Error('Event not found, completed, or one or more managers are already assigned');
  await AuditLog.create({
    actorId: user.id,
    action: 'EVENT_MANAGERS_ASSIGNED',
    entityId: event._id,
    detail: { managerIds: ids, teamId },
  });
  revalidatePath('/events');
  revalidatePath('/');
}

export async function updateEventManagerAssignment(form: FormData) {
  const user = await admin();
  await db();
  const eventId = formText(form, 'eventId');
  const managerId = formText(form, 'managerId');
  const teamId = formText(form, 'teamId');
  if (!Types.ObjectId.isValid(eventId) || !Types.ObjectId.isValid(managerId)) {
    throw new Error('Valid event and manager are required');
  }
  if (teamId && !Types.ObjectId.isValid(teamId)) throw new Error('Select a valid team');

  const [event, team] = await Promise.all([
    Event.findOne({ _id: eventId, status: { $ne: 'COMPLETED' }, managerIds: managerId }),
    teamId ? Team.findById(teamId).select('_id') : Promise.resolve(null),
  ]);
  if (!event) throw new Error('Manager is not assigned to an editable event');
  if (teamId && !team) throw new Error('Selected team no longer exists');

  const managerObjectId = new Types.ObjectId(managerId);
  const teamObjectId = teamId ? new Types.ObjectId(teamId) : null;
  const targetMinor = parseOptionalTarget(form.get('managerTarget'));
  const existingTeam = event.managerTeams.find(
    (assignment) => String(assignment.managerId) === managerId,
  );
  if (existingTeam) existingTeam.teamId = teamObjectId;
  else event.managerTeams.push({ managerId: managerObjectId, teamId: teamObjectId });

  const existingTarget = event.managerTargets.find(
    (target) => String(target.managerId) === managerId,
  );
  if (existingTarget) existingTarget.targetMinor = targetMinor;
  else event.managerTargets.push({ managerId: managerObjectId, targetMinor });

  event.markModified('managerTeams');
  event.markModified('managerTargets');
  await event.save();
  await AuditLog.create({
    actorId: user.id,
    action: 'EVENT_MANAGER_ASSIGNMENT_UPDATED',
    entityId: event._id,
    detail: { managerId, teamId: teamId || null, targetMinor },
  });
  revalidatePath('/events');
  revalidatePath('/');
  revalidatePath('/transactions');
}

export async function unassignManager(form: FormData) {
  const user = await admin();
  await db();
  const eventId = formText(form, 'eventId');
  const managerId = formText(form, 'managerId');
  if (!Types.ObjectId.isValid(eventId) || !Types.ObjectId.isValid(managerId)) {
    throw new Error('Valid event and manager are required');
  }
  const eventObjectId = new Types.ObjectId(eventId);
  const managerObjectId = new Types.ObjectId(managerId);
  const event = await Event.findOne({ _id: eventObjectId, managerIds: managerObjectId });
  if (!event) throw new Error('Manager is not assigned to this event');

  const [income, expense] = await Promise.all([
    Income.exists({ eventId: eventObjectId, createdBy: managerObjectId }),
    Expense.exists({
      eventId: eventObjectId,
      createdBy: managerObjectId,
      status: { $in: ['APPROVED', 'PENDING'] },
    }),
  ]);
  if (income || expense) throw new Error('Managers with income or expenses cannot be unassigned');

  const result = await Event.updateOne(
    { _id: eventObjectId, managerIds: managerObjectId },
    {
      $pull: {
        managerIds: managerObjectId,
        managerTeams: { managerId: managerObjectId },
        managerTargets: { managerId: managerObjectId },
      },
    },
  );
  if (result.modifiedCount !== 1) throw new Error('Manager could not be unassigned');
  await AuditLog.create({
    actorId: user.id,
    action: 'EVENT_MANAGER_UNASSIGNED',
    entityId: eventObjectId,
    detail: { managerId },
  });
  revalidateEventPages();
}

export async function recordManagerHandover(form: FormData) {
  const user = await admin();
  await db();
  const eventId = formText(form, 'eventId');
  const managerId = formText(form, 'managerId');
  if (!Types.ObjectId.isValid(eventId) || !Types.ObjectId.isValid(managerId)) {
    throw new Error('Valid event and manager are required');
  }

  const eventObjectId = new Types.ObjectId(eventId);
  const managerObjectId = new Types.ObjectId(managerId);
  const event = await Event.findOne({ _id: eventObjectId, managerIds: managerObjectId }).select('_id');
  if (!event) throw new Error('Manager is not assigned to this event');
  const manager = await User.findOne({ _id: managerObjectId, role: 'MANAGER' }).select('_id');
  if (!manager) throw new Error('Manager not found');

  const amountMinor = parseMoney(form.get('amount'));
  const incomeTotal = await Income.aggregate([
    { $match: { eventId: eventObjectId, createdBy: managerObjectId } },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);
  const collectedMinor = Number(incomeTotal[0]?.total ?? 0);
  if (amountMinor > collectedMinor) {
    throw new Error('Handover amount cannot exceed the manager’s recorded income');
  }

  try {
    await ManagerHandover.updateOne(
      { eventId: eventObjectId, managerId: managerObjectId },
      { $setOnInsert: { eventId: eventObjectId, managerId: managerObjectId, totalMinor: 0 } },
      { upsert: true },
    );
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) {
      throw error;
    }
  }

  const handover = await ManagerHandover.findOneAndUpdate(
    {
      eventId: eventObjectId,
      managerId: managerObjectId,
      totalMinor: { $lte: collectedMinor - amountMinor },
    },
    { $inc: { totalMinor: amountMinor } },
    { new: true },
  );
  if (!handover) {
    throw new Error('Handover amount exceeds the manager’s remaining unhanded income');
  }

  await AuditLog.create({
    actorId: user.id,
    action: 'MANAGER_HANDOVER_RECORDED',
    entityId: eventObjectId,
    detail: { managerId, amountMinor, totalMinor: handover.totalMinor },
  });
  revalidatePath('/paid-to-admin');
  revalidatePath('/events');
  revalidatePath('/');
}

export async function updateIncome(form: FormData) {
  const user = await currentUser();
  await db();
  const id = formText(form, 'id');
  const { from, fromMl, sector, unit, amountMinor, category } = incomeFormValues(form, 'Valid transaction, Received From, sector and unit are required');
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid income transaction');
  const filter = {
    _id: id,
    ...(user.role === 'MANAGER' ? { createdBy: new Types.ObjectId(user.id) } : {}),
  };
  const existing = await Income.findOne(filter);
  if (!existing) throw new Error('Income not found or not editable');
  const event = await Event.findById(existing.eventId);
  if (!event || !isAssigned(event, user)) throw new Error('Event access denied');

  const currentCreatorId = String(existing.createdBy);
  if (event.managerIds.some((managerId) => String(managerId) === currentCreatorId)) {
    const [incomeTotal, handover] = await Promise.all([
      Income.aggregate([
        { $match: { eventId: existing.eventId, createdBy: existing.createdBy } },
        { $group: { _id: null, total: { $sum: '$amountMinor' } } },
      ]),
      ManagerHandover.findOne({
        eventId: existing.eventId,
        managerId: existing.createdBy,
      }).select('totalMinor').lean(),
    ]);
    const projectedTotal = Number(incomeTotal[0]?.total ?? 0) - existing.amountMinor + amountMinor;
    if (projectedTotal < Number(handover?.totalMinor ?? 0)) {
      throw new Error('Income cannot be reduced below the manager’s recorded handovers');
    }
  }

  const previous = {
    amountMinor: existing.amountMinor,
    category: existing.category,
    from: existing.from,
    from_ml: existing.from_ml,
    sector: existing.sector,
    unit: existing.unit,
  };
  const income = await Income.findOneAndUpdate(
    filter,
    {
      $set: {
        amountMinor,
        category,
        sector,
        unit,
        from,
        from_ml: category === 'Rifadha' ? fromMl : '',
        address: formText(form, 'address', 500),
        method: formText(form, 'method') || 'CASH',
        note: formText(form, 'note'),
      },
    },
    { new: true },
  );
  if (!income) throw new Error('Income not found or not editable');
  await AuditLog.create({
    actorId: user.id,
    action: 'INCOME_UPDATED',
    entityId: income._id,
    detail: {
      eventId: income.eventId,
      before: previous,
      after: {
        amountMinor: income.amountMinor,
        category: income.category,
        from: income.from,
        from_ml: income.from_ml,
        sector: income.sector,
        unit: income.unit,
      },
    },
  });
  revalidatePath('/');
  revalidatePath('/transactions');
}

export async function updateExpense(form: FormData) {
  const user = await currentUser();
  await db();
  const id = formText(form, 'id');
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid expense');
  const filter = {
    _id: id,
    ...(user.role === 'MANAGER' ? { createdBy: new Types.ObjectId(user.id) } : {}),
  };
  const expense = await Expense.findOne(filter);
  if (!expense) throw new Error('Expense not found or not editable');
  if (user.role === 'MANAGER' && expense.status === 'APPROVED') {
    throw new Error('Only Super Admin can edit approved expenses');
  }
  const event = await Event.findById(expense.eventId);
  if (!event || !isAssigned(event, user)) throw new Error('Event access denied');
  const resetDecision = user.role === 'MANAGER' && expense.status === 'REJECTED';

  const updated = await Expense.findOneAndUpdate(
    filter,
    {
      $set: {
        amountMinor: parseMoney(form.get('amount')),
        category: formText(form, 'category', 70) || 'Other',
        paidTo: formText(form, 'paidTo', 250),
        method: formText(form, 'method') || 'CASH',
        note: formText(form, 'note'),
        ...(resetDecision
          ? { status: 'PENDING', decidedBy: null, decidedAt: null, rejectionReason: null }
          : {}),
      },
    },
    { new: true },
  );
  if (!updated) throw new Error('Expense not found or not editable');
  await AuditLog.create({
    actorId: user.id,
    action: 'EXPENSE_UPDATED',
    entityId: updated._id,
    detail: { previousStatus: expense.status, status: updated.status },
  });
  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/paid-to-admin');
  revalidatePath('/expense-approvals');
}
