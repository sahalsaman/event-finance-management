import { decideExpense } from '@/app/actions';
import { Frame } from '@/components/Frame';
import { TransactionEditForm } from '@/components/TransactionEditForm';
import { SubmitButton } from '@/components/SubmitButton';
import { admin, rupees } from '@/lib/access';
import { db } from '@/lib/db';
import { Event } from '@/models/Event';
import { Expense } from '@/models/Expense';
import Link from 'next/link';

export default async function Page() {
  await admin();
  await db();
  const event = await Event.findOne({ status: 'ACTIVE' });
  const pending = event
    ? await Expense.find({ eventId: event._id, status: 'PENDING' })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean()
    : [];
  return (
    <Frame>
      <div className="sectionhead">
        <h1>Expense Approvals</h1>
      </div>
      <p className="muted">{pending.length} pending requests</p>
      <div className="stack">
        {pending.length === 0 ? <div className="card">No pending expenses.</div> : pending.map((expense) => (
          <div className="card" id={`expense-${String(expense._id)}`} key={String(expense._id)}>
            <div className="flex justify-between ">
              <div>
                <h2>{expense.category}</h2>
                <p className="muted">
                  By {(expense.createdBy as unknown as { name?: string })?.name || 'Manager'} · Paid to: {expense.paidTo || '—'}
                </p>
              </div>
              <div>
                <strong style={{ fontSize: 22 }} className="mr-2">{rupees(expense.amountMinor)}</strong>
                <TransactionEditForm
                  record={{
                    type: 'expense',
                    id: String(expense._id),
                    amount: Number(expense.amountMinor),
                    category: String(expense.category),
                    paidTo: String(expense.paidTo || ''),
                    method: String(expense.method || 'CASH'),
                    note: String(expense.note || ''),
                  }}
                />
              </div>
            </div>
            <p>{expense.note}</p>
            <div className="approval-actions">
              <form action={decideExpense}>
                <input type="hidden" name="id" value={String(expense._id)} />
                <div className="field">
                  <input required name="reason" placeholder="Reason" />
                </div>
                <div className="flex justify-between w-full gap-2">
                  <SubmitButton
                    name="decision"
                    value="APPROVED"
                    formNoValidate
                    style={{ width: '100%' }}
                    pendingText="Approving..."
                  >
                    Approve
                  </SubmitButton>
                  <SubmitButton
                    name="decision"
                    value="REJECTED"
                    className="button danger"
                    style={{ width: '100%' }}
                    pendingText="Rejecting..."
                  >
                    Reject
                  </SubmitButton>
                </div>
              </form>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}
