import { currentUser, isAssigned } from '@/lib/access';
import { db } from '@/lib/db';
import { Event } from '@/models/Event';
import { Expense } from '@/models/Expense';
import { Income } from '@/models/Income';
import { Types } from 'mongoose';

function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(',');
}

export async function GET() {
  const user = await currentUser();
  await db();
  const event = await Event.findOne({ status: 'ACTIVE' }).lean();
  if (!event || !isAssigned(event, user)) {
    return new Response('No accessible active event', { status: 404 });
  }

  const filter = {
    eventId: event._id,
    ...(user.role === 'MANAGER' ? { createdBy: new Types.ObjectId(user.id) } : {}),
  };
  const [incomes, expenses] = await Promise.all([
    Income.find(filter).populate('createdBy', 'name').sort({ createdAt: 1 }).lean(),
    Expense.find(filter).populate('createdBy', 'name').sort({ createdAt: 1 }).lean(),
  ]);
  const rows: unknown[][] = [[
    'Type',
    'Date',
    'Category',
    'Amount (INR)',
    'Status',
    'Created By',
    'Received From',
    'Address',
    'Paid To',
    'Payment Method',
    'Notes',
  ]];

  for (const income of incomes) {
    const creator = income.createdBy;
    rows.push([
      'Income',
      new Date(income.createdAt).toISOString(),
      income.category,
      (Number(income.amountMinor) / 100).toFixed(2),
      'Recorded',
      typeof creator === 'object' && creator !== null && 'name' in creator ? creator.name : '',
      income.from,
      income.address,
      '',
      income.method,
      income.note,
    ]);
  }
  for (const expense of expenses) {
    const creator = expense.createdBy;
    rows.push([
      'Expense',
      new Date(expense.createdAt).toISOString(),
      expense.category,
      (Number(expense.amountMinor) / 100).toFixed(2),
      expense.status,
      typeof creator === 'object' && creator !== null && 'name' in creator ? creator.name : '',
      '',
      '',
      expense.paidTo,
      expense.method,
      expense.note,
    ]);
  }

  const csv = `\uFEFF${rows.map(csvRow).join('\r\n')}`;
  const filename = `${String(event.name).replace(/[^a-zA-Z0-9_-]+/g, '-')}-transactions.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
