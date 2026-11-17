import { recordManagerHandover } from '@/app/actions';
import { Frame } from '@/components/Frame';
import { Popup } from '@/components/Popup';
import { SubmitButton } from '@/components/SubmitButton';
import { admin, rupees } from '@/lib/access';
import { db } from '@/lib/db';
import { formatTransactionDate } from '@/lib/transaction-date';
import { Event } from '@/models/Event';
import { Income } from '@/models/Income';
import { ManagerHandover } from '@/models/ManagerHandover';
import { AuditLog } from '@/models/AuditLog';
import { User } from '@/models/User';
import { LiveSearchList } from '@/components/LiveSearchList';
import Link from 'next/link';

type HandoverTransaction = {
  id: string;
  managerName: string;
  amount: number;
  date: Date | null;
  legacy: boolean;
};

type PaidToAdminTab = 'TRANSACTIONS' | 'MANAGERS';

type PaidToAdminSearchParams = { tab?: string };

export default async function Page({ searchParams }: { searchParams: Promise<PaidToAdminSearchParams> }) {
  const { tab } = await searchParams;
  const selectedTab: PaidToAdminTab = tab === 'managers' ? 'MANAGERS' : 'TRANSACTIONS';
  await admin();
  await db();
  const event = await Event.findOne({ status: 'ACTIVE' }).lean();
  const managerIds = event?.managerIds ?? [];
  const managers = event && managerIds.length
    ? await User.find({ _id: { $in: managerIds }, role: 'MANAGER' })
      .select('_id name')
      .sort({ name: 1 })
      .lean()
    : [];
  const [incomeTotals, handovers, handoverLogs] = event && managerIds.length
    ? await Promise.all([
        Income.aggregate([
          { $match: { eventId: event._id, createdBy: { $in: managerIds } } },
          { $group: { _id: '$createdBy', total: { $sum: '$amountMinor' } } },
        ]),
        ManagerHandover.find({ eventId: event._id, managerId: { $in: managerIds } })
          .sort({ updatedAt: -1 })
          .lean(),
        AuditLog.find({ entityId: event._id, action: 'MANAGER_HANDOVER_RECORDED' })
          .select('detail createdAt')
          .sort({ createdAt: -1 })
          .lean(),
      ])
    : [[], [], []];
  const incomeByManager = new Map<string, number>();
  for (const entry of incomeTotals) incomeByManager.set(String(entry._id), Number(entry.total));
  const handedOverByManager = new Map<string, number>();
  for (const handover of handovers) {
    handedOverByManager.set(String(handover.managerId), Number(handover.totalMinor));
  }
  const receivedTotal = handovers.reduce((total, handover) => total + Number(handover.totalMinor), 0);
  const outstandingTotal = managers.reduce((total, manager) => {
    const managerId = String(manager._id);
    return total + Math.max((incomeByManager.get(managerId) ?? 0) - (handedOverByManager.get(managerId) ?? 0), 0);
  }, 0);
  const managersWithBalance = managers.filter((manager) => {
    const managerId = String(manager._id);
    return (incomeByManager.get(managerId) ?? 0) > (handedOverByManager.get(managerId) ?? 0);
  });
  const managerPaymentRows = managers
    .map((manager) => {
      const managerId = String(manager._id);
      const collected = incomeByManager.get(managerId) ?? 0;
      const paid = handedOverByManager.get(managerId) ?? 0;
      return {
        id: managerId,
        name: String(manager.name),
        paid,
        balance: Math.max(collected - paid, 0),
      };
    })
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  const managerNames = new Map<string, string>();
  for (const manager of managers) managerNames.set(String(manager._id), String(manager.name));
  const historyTotals = new Map<string, number>();
  const transactions: HandoverTransaction[] = handoverLogs.flatMap((log) => {
    const detail = typeof log.detail === 'object' && log.detail !== null
      ? log.detail as Record<string, unknown>
      : {};
    const managerId = String(detail.managerId ?? '');
    const amount = Number(detail.amountMinor);
    if (!managerId || !Number.isSafeInteger(amount) || amount <= 0) return [];
    historyTotals.set(managerId, (historyTotals.get(managerId) ?? 0) + amount);
    return [{
      id: String(log._id),
      managerName: managerNames.get(managerId) ?? 'Manager',
      amount,
      date: log.createdAt ? new Date(log.createdAt) : null,
      legacy: false,
    }];
  });
  for (const handover of handovers) {
    const managerId = String(handover.managerId);
    const earlierAmount = Math.max(
      Number(handover.totalMinor) - (historyTotals.get(managerId) ?? 0),
      0,
    );
    if (earlierAmount > 0) {
      transactions.push({
        id: `${String(handover._id)}-legacy`,
        managerName: managerNames.get(managerId) ?? 'Manager',
        amount: earlierAmount,
        date: null,
        legacy: true,
      });
    }
  }
  transactions.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  return (
    <Frame>
      <div className="sectionhead">
        <div>
          <h1>Paid to Admin</h1>
          <p className="muted">{event?.name ?? 'No active event'}</p>
        </div>
        {event && managersWithBalance.length > 0 && (
          <Popup title="Record payment to admin" trigger="＋ Pay to Admin">
            <form action={recordManagerHandover}>
              <input type="hidden" name="eventId" value={String(event._id)} />
              <div className="field">
                <label htmlFor="handover-manager">Manager</label>
                <select id="handover-manager" name="managerId" required defaultValue="">
                  <option value="" disabled>Select a manager</option>
                  {managersWithBalance.map((manager) => (
                    <option key={String(manager._id)} value={String(manager._id)}>
                      {manager.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="handover-amount">Amount (₹)</label>
                <input
                  id="handover-amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <SubmitButton style={{ width: '100%' }} pendingText="Recording...">Submit</SubmitButton>
            </form>
          </Popup>
        )}
      </div>
      <section className="card home-finance-summary home-finance-summary-admin" aria-label="Manager payment totals">
        <div>
          <small className="muted">Received from managers</small>
          <b>{rupees(receivedTotal)}</b>
        </div>
        <div>
          <small className="muted">Still to receive from managers</small>
          <b>{rupees(outstandingTotal)}</b>
        </div>
      </section>
      <nav className="transaction-tabs" aria-label="Paid to admin view">
        <Link
          className={`transaction-tab${selectedTab === 'TRANSACTIONS' ? ' active' : ''}`}
          href="/paid-to-admin"
          aria-current={selectedTab === 'TRANSACTIONS' ? 'page' : undefined}
        >
          Transactions
        </Link>
        <Link
          className={`transaction-tab${selectedTab === 'MANAGERS' ? ' active' : ''}`}
          href="/paid-to-admin?tab=managers"
          aria-current={selectedTab === 'MANAGERS' ? 'page' : undefined}
        >
          Managers
        </Link>
      </nav>
      {selectedTab === 'TRANSACTIONS' ? (
        <section className="card">
          <h2>Received transactions</h2>
          <LiveSearchList
            className=""
            inputId="paid-to-admin-search"
            label="Search received transactions"
            placeholder="Search manager payments"
            emptyMessage="No payments received from managers yet."
            noResultsMessage="No manager payments match your search."
          >
            {transactions.map((transaction) => (
              <div className="listrow" data-search={`${transaction.managerName} ${rupees(transaction.amount)} ${transaction.legacy ? 'earlier recorded amount' : transaction.date ? formatTransactionDate(transaction.date.toISOString()) : 'date unavailable'}`} key={transaction.id}>
                <div>
                  <b>{transaction.managerName}</b>
                  <p className="muted">
                    {transaction.legacy
                      ? 'Earlier recorded amount'
                      : transaction.date
                        ? formatTransactionDate(transaction.date.toISOString())
                        : 'Date unavailable'}
                  </p>
                </div>
                <b className="transaction-total-income">{rupees(transaction.amount)}</b>
              </div>
            ))}
          </LiveSearchList>
        </section>
      ) : (
        <section className="card">
          <h2>Manager balances</h2>
          <LiveSearchList
            className=""
            inputId="paid-to-admin-manager-search"
            label="Search managers"
            placeholder="Search managers"
            emptyMessage="No managers assigned to the active event."
            noResultsMessage="No managers match your search."
          >
            {managerPaymentRows.map((manager) => (
              <div className="listrow" data-search={`${manager.name} ${rupees(manager.paid)} ${rupees(manager.balance)}`} key={manager.id}>
                <b>{manager.name}</b>
                <div className="text-right">
                  <p className="muted">Paid: {rupees(manager.paid)}</p>
                  <b className={manager.balance > 0 ? 'transaction-total-expense' : 'transaction-total-income'}>
                    Balance: {rupees(manager.balance)}
                  </b>
                </div>
              </div>
            ))}
          </LiveSearchList>
        </section>
      )}
    </Frame>
  );
}
