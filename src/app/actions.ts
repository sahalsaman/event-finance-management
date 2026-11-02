'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { signIn, signOut } from '@/auth';
import { admin, currentUser, formText, isAssigned, parseMoney } from '@/lib/access';
import { db } from '@/lib/db';
import { AuditLog } from '@/models/AuditLog';
import { Event } from '@/models/Event';
import { Expense } from '@/models/Expense';
import { ExpenseCategory } from '@/models/ExpenseCategory';
import { Income } from '@/models/Income';
import { User } from '@/models/User';

type AppUser = { id: string; role: string };

export async function login(form: FormData) {
  try {
    await signIn('credentials', {
      email: formText(form, 'email'),
      password: formText(form, 'password'),
      redirectTo: '/',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('CredentialsSignin')) {
      redirect('/login?error=invalid');
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

  await Income.create({
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
  redirect('/?saved=income');
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
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error('Name and a valid date are required');
  }
  await Event.create({
    name,
    eventDate: new Date(`${date}T12:00:00`),
    location: formText(form, 'location'),
    createdBy: user.id,
    status: 'UPCOMING',
  });
  revalidatePath('/events');
  redirect('/events');
}

export async function updateEvent(form: FormData) {
  const user = await admin();
  await db();
  const id = formText(form, 'id');
  const name = formText(form, 'name', 120);
  const date = formText(form, 'date');
  if (
    !Types.ObjectId.isValid(id) ||
    !name ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date))
  ) {
    throw new Error('Valid event name and date are required');
  }
  const event = await Event.findByIdAndUpdate(
    id,
    {
      $set: {
        name,
        eventDate: new Date(`${date}T12:00:00`),
        location: formText(form, 'location', 250),
      },
    },
    { new: true },
  );
  if (!event) throw new Error('Event not found');
  await AuditLog.create({ actorId: user.id, action: 'EVENT_UPDATED', entityId: event._id });
  revalidatePath('/');
  revalidatePath('/events');
  revalidatePath('/transactions');
}

export async function activateEvent(form: FormData) {
  await admin();
  await db();
  const id = formText(form, 'id');
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid event');
  if (await Event.exists({ status: 'ACTIVE' })) {
    throw new Error('Complete existing active event first');
  }
  await Event.updateOne({ _id: id, status: 'UPCOMING' }, { $set: { status: 'ACTIVE' } });
  revalidatePath('/');
  revalidatePath('/events');
  redirect('/events');
}

export async function completeEvent(form: FormData) {
  await admin();
  await db();
  const id = formText(form, 'id');
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid event');
  if (await Expense.exists({ eventId: id, status: 'PENDING' })) {
    throw new Error('Resolve pending expenses first');
  }
  await Event.updateOne({ _id: id, status: 'ACTIVE' }, { $set: { status: 'COMPLETED' } });
  revalidatePath('/');
  revalidatePath('/events');
  redirect('/events');
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

  const income = await Income.findOneAndUpdate(
    filter,
    {
      $set: {
        amountMinor: parseMoney(form.get('amount')),
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
