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

  const receiptNo = `FC-${Buffer.from(String(income._id), 'hex').toString('base64url')}`;
  const date = new Date(income.createdAt).toISOString();

  return (
    <main className="shell">
      <div className="content">
        <IncomeReceipt
          receipt={{
            receiptNo,
            date,
            receivedFrom: String(income.from),
            amountMinor: Number(income.amountMinor),
            eventName: String(event.name),
          }}
        />
      </div>
    </main>
  );
}
