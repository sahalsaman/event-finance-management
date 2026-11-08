import { notFound } from 'next/navigation';
import { Types } from 'mongoose';
import { IncomeReceipt } from '@/components/IncomeReceipt';
import { currentUser, isAssigned } from '@/lib/access';
import { Event } from '@/models/Event';
import { Income } from '@/models/Income';

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  const income = await Income.findById(id).lean();
  if (!income || (user.role === 'MANAGER' && String(income.createdBy) !== user.id)) notFound();

  const event = await Event.findById(income.eventId).select('name managerIds').lean();
  if (!event || !isAssigned(event, user)) notFound();

  const createdAt = new Date(income.createdAt);
  const year = new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(createdAt);
  const yearStart = new Date(`${year}-01-01T00:00:00+05:30`);
  const nextYearStart = new Date(`${Number(year) + 1}-01-01T00:00:00+05:30`);
  const priorReceipts = await Income.countDocuments({
    createdAt: { $gte: yearStart, $lt: nextYearStart },
    $or: [
      { createdAt: { $lt: createdAt } },
      { createdAt, _id: { $lt: income._id } },
    ],
  });
  const receiptNo = `${year}-${String(priorReceipts + 1).padStart(4, '0')}`;

  return (
    <main className="shell">
      <div className="content">
        <IncomeReceipt
          receipt={{
            receiptNo,
            date: createdAt.toISOString(),
            receivedFrom: String(income.from),
            receivedFromMalayalam: String(income.from_ml ?? ''),
            amountMinor: Number(income.amountMinor),
            category: String(income.category),
            eventName: String(event.name),
          }}
        />
      </div>
    </main>
  );
}
