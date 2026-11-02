import { decideExpense } from '@/app/actions';
import { Frame } from '@/components/Frame';
import { TransactionEditForm } from '@/components/TransactionEditForm';
import { admin, rupees } from '@/lib/access';
import { db } from '@/lib/db';
import { Event } from '@/models/Event';
import { Expense } from '@/models/Expense';
import { SubmitButton } from '@/components/SubmitButton';

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
      <h1>Expense Approvals</h1>
      <p className="muted">{pending.length} pending requests</p>
      <div className="stack">
        {pending.length === 0 ? <div className="card">No pending expenses.</div> : pending.map((expense) => (
          <div className="card" key={String(expense._id)}>
            <div className="sectionhead">
              <h2>{expense.category}</h2>
              <strong style={{ fontSize: 22 }}>{rupees(expense.amountMinor)}</strong>
            </div>
            <p className="muted">
              By {(expense.createdBy as unknown as { name?: string })?.name || 'Manager'} · Paid to: {expense.paidTo || '—'}
            </p>
            <p>{expense.note}</p>
            <div className="approval-actions">
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
              <div className="grid2" style={{ marginTop: 14 }}>
                <form action={decideExpense}>
                  <input type="hidden" name="id" value={String(expense._id)} />
                  <input type="hidden" name="decision" value="APPROVED" />
                  <SubmitButton style={{ width: '100%' }} pendingText="Approving...">Approve</SubmitButton>
                </form>
                <form action={decideExpense}>
                  <input type="hidden" name="id" value={String(expense._id)} />
                  <input type="hidden" name="decision" value="REJECTED" />
                  <div className="field">
                    <label>Rejection reason</label>
                    <input required name="reason" placeholder="Reason" />
                  </div>
                  <SubmitButton className="button danger" style={{ width: '100%' }} pendingText="Rejecting...">Reject</SubmitButton>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}
