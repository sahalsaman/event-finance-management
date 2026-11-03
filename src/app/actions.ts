'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Types } from 'mongoose';
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
import { User } from '@/models/User';

type AppUser = { id: string; role: string };
type EventStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED';

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
  const from = formText(form, 'from', 250);
  if (!from) throw new Error('Received From is required');

  const income = await Income.create({
    eventId: event._id,
    amountMinor: parseMoney(form.get('amount')),
    category: formText(form, 'category', 70) || 'Other',
    from,
    address: formText(form, 'address', 500),
    method: formText(form, 'method') || 'CASH',
    note: formText(form, 'note'),
    createdBy: user.id,
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
  revalidatePath('/approvals');
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
  revalidatePath('/');
  revalidatePath('/events');
  revalidatePath('/transactions');
  revalidatePath('/income');
  revalidatePath('/expense');
  revalidatePath('/approvals');
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

export async function assignManagers(form: FormData) {
  const user = await admin();
  await db();
  const eventId = formText(form, 'eventId');
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
  const managerIds = ids.map((id) => new Types.ObjectId(id));
  const managerCount = await User.countDocuments({
    _id: { $in: managerIds },
    role: 'MANAGER',
    active: true,
  });
  if (managerCount !== managerIds.length) throw new Error('One or more managers are unavailable');

  const event = await Event.findOneAndUpdate(
    { _id: eventId, status: { $ne: 'COMPLETED' } },
    { $addToSet: { managerIds: { $each: managerIds } } },
    { new: true },
  );
  if (!event) throw new Error('Event not found or completed');
  await AuditLog.create({
    actorId: user.id,
    action: 'EVENT_MANAGERS_ASSIGNED',
    entityId: event._id,
    detail: { managerIds: ids },
  });
  revalidatePath('/events');
  revalidatePath('/');
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
  revalidatePath('/events');
  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/income');
  revalidatePath('/expense');
  revalidatePath('/approvals');
}

export async function setManagerTarget(form: FormData) {
  const user = await admin();
  await db();
  const eventId = formText(form, 'eventId');
  const managerId = formText(form, 'managerId');
  if (!Types.ObjectId.isValid(eventId) || !Types.ObjectId.isValid(managerId)) {
    throw new Error('Valid event and manager are required');
  }
  const event = await Event.findOne({
    _id: eventId,
    managerIds: new Types.ObjectId(managerId),
  });
  if (!event) throw new Error('Manager is not assigned to this event');

  const managerObjectId = new Types.ObjectId(managerId);
  const targetMinor = parseOptionalTarget(form.get('target'));
  const existing = event.managerTargets.find((target) => String(target.managerId) === managerId);
  if (existing) {
    existing.targetMinor = targetMinor;
  } else {
    event.managerTargets.push({ managerId: managerObjectId, targetMinor });
  }
  event.markModified('managerTargets');
  await event.save();
  const savedEvent = await Event.findOne({
    _id: event._id,
    managerTargets: {
      $elemMatch: { managerId: managerObjectId, targetMinor },
    },
  }).select('_id');
  if (!savedEvent) throw new Error('Manager target could not be saved');
  await AuditLog.create({
    actorId: user.id,
    action: 'EVENT_MANAGER_TARGET_UPDATED',
    entityId: event._id,
    detail: { managerId, targetMinor },
  });
  revalidatePath('/events');
  revalidatePath('/');
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
  revalidatePath('/events');
  revalidatePath('/');
}

export async function updateIncome(form: FormData) {
  const user = await currentUser();
  await db();
  const id = formText(form, 'id');
  const from = formText(form, 'from', 250);
  if (!Types.ObjectId.isValid(id) || !from) {
    throw new Error('Valid transaction and Received From are required');
  }
  const filter = {
    _id: id,
    ...(user.role === 'MANAGER' ? { createdBy: new Types.ObjectId(user.id) } : {}),
  };
  const existing = await Income.findOne(filter);
  if (!existing) throw new Error('Income not found or not editable');
  const event = await Event.findById(existing.eventId);
  if (!event || !isAssigned(event, user)) throw new Error('Event access denied');

  const amountMinor = parseMoney(form.get('amount'));
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

  const income = await Income.findOneAndUpdate(
    filter,
    {
      $set: {
        amountMinor,
        category: formText(form, 'category', 70) || 'Other',
        from,
        address: formText(form, 'address', 500),
        method: formText(form, 'method') || 'CASH',
        note: formText(form, 'note'),
      },
    },
    { new: true },
  );
  if (!income) throw new Error('Income not found or not editable');
  await AuditLog.create({ actorId: user.id, action: 'INCOME_UPDATED', entityId: income._id });
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
  revalidatePath('/approvals');
}
