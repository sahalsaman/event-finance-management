import { Frame } from '@/components/Frame';
import { TransactionEditForm } from '@/components/TransactionEditForm';
import { activeData } from '@/lib/data';
import { rupees } from '@/lib/access';
import Link from 'next/link';
import { Download, Filter, Receipt } from 'lucide-react';
import { Popup } from '@/components/Popup';
import { Types } from 'mongoose';
import { Income } from '@/models/Income';
import { Expense } from '@/models/Expense';

type TransactionFilters = {
  manager?: string;
  type?: string;
  sort?: string;
  period?: string;
};

type TransactionPeriod = 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_HOUR';

function getTransactionRange(period: TransactionPeriod, now = new Date()) {
  if (period === 'LAST_HOUR') {
    return { start: new Date(now.getTime() - 60 * 60 * 1000), end: now };
  }
  if (period === 'ALL') return undefined;

  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => dateParts.find((entry) => entry.type === type)?.value ?? '';
  const todayKey = `${part('year')}-${part('month')}-${part('day')}`;
  const todayUtc = Date.parse(`${todayKey}T00:00:00Z`);
  const startKey = period === 'TODAY'
    ? todayKey
    : new Date(todayUtc - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const endKey = period === 'TODAY'
    ? new Date(todayUtc + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : todayKey;
  return {
    start: new Date(`${startKey}T00:00:00+05:30`),
    end: new Date(`${endKey}T00:00:00+05:30`),
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<TransactionFilters> }) {
  const filters = await searchParams;
  const selectedPeriod: TransactionPeriod = filters.period === 'TODAY' ||
      filters.period === 'YESTERDAY' ||
      filters.period === 'LAST_HOUR'
    ? filters.period
    : 'ALL';
  const range = getTransactionRange(selectedPeriod);
  const data = await activeData({ transactionRange: range });
  const isAdmin = data.user.role === 'SUPER_ADMIN';
  const allItems = [
    ...data.incomes.map((income) => ({ ...income, type: 'INCOME' as const })),
    ...data.expenses.map((expense) => ({ ...expense, type: 'EXPENSE' as const })),
  ];
  const managers = [...new Map(
    allItems
      .filter((item) => item.createdById && item.createdByName)
      .map((item) => [item.createdById, { id: item.createdById, name: item.createdByName }]),
  ).values()].sort((a, b) => a.name.localeCompare(b.name));
  const selectedManager = isAdmin && Types.ObjectId.isValid(filters.manager ?? '')
    ? filters.manager
    : '';
  const selectedType = filters.type === 'INCOME' || filters.type === 'EXPENSE' ? filters.type : 'ALL';
  const selectedSort = ['DATE_ASC', 'AMOUNT_DESC', 'AMOUNT_ASC'].includes(filters.sort ?? '')
    ? filters.sort!
    : 'DATE_DESC';
  const items = allItems
    .filter((item) => selectedType === 'ALL' || item.type === selectedType)
    .filter((item) => !selectedManager || item.createdById === selectedManager)
    .sort((a, b) => {
      if (selectedSort === 'DATE_ASC') return a.date.localeCompare(b.date);
      if (selectedSort === 'AMOUNT_DESC') return b.amount - a.amount;
      if (selectedSort === 'AMOUNT_ASC') return a.amount - b.amount;
      return b.date.localeCompare(a.date);
    });
  const totalsFilter = data.event
    ? {
        eventId: new Types.ObjectId(data.event.id),
        ...(data.user.role === 'MANAGER'
          ? { createdBy: new Types.ObjectId(data.user.id) }
          : selectedManager
            ? { createdBy: new Types.ObjectId(selectedManager) }
            : {}),
        ...(range ? { createdAt: { $gte: range.start, $lt: range.end } } : {}),
      }
    : null;
  const [incomeTotals, expenseTotals] = totalsFilter
    ? await Promise.all([
        selectedType === 'EXPENSE'
          ? Promise.resolve([])
          : Income.aggregate([
              { $match: totalsFilter },
              { $group: { _id: null, total: { $sum: '$amountMinor' } } },
            ]),
        selectedType === 'INCOME'
          ? Promise.resolve([])
          : Expense.aggregate([
              { $match: totalsFilter },
              { $group: { _id: null, total: { $sum: '$amountMinor' } } },
            ]),
      ])
    : [[], []];
  const totalCollection = Number(incomeTotals[0]?.total ?? 0);
  const totalExpense = Number(expenseTotals[0]?.total ?? 0);

  return (
    <Frame>
      <div className="transactions-heading">
        <div>
          <h1>Transactions</h1>
          <p className="muted">{data.event?.name || 'No current event'}</p>
        </div>
        <div className="transactions-tools">
          <Popup
            title="Filter transactions"
            trigger={<Filter size={18} aria-hidden="true" />}
            triggerLabel="Filter transactions"
            triggerClassName="button ghost icon-button"
          >
            <form action="/transactions" method="get">
              {isAdmin && (
                <div className="field">
                  <label htmlFor="transaction-manager">Manager</label>
                  <select id="transaction-manager" name="manager" defaultValue={selectedManager}>
                    <option value="">All managers</option>
                    {selectedManager && !managers.some((manager) => manager.id === selectedManager) && (
                      <option value={selectedManager}>Selected manager</option>
                    )}
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>{manager.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label htmlFor="transaction-period">Date range</label>
                <select id="transaction-period" name="period" defaultValue={selectedPeriod}>
                  <option value="ALL">All dates</option>
                  <option value="TODAY">Today</option>
                  <option value="YESTERDAY">Yesterday</option>
                  <option value="LAST_HOUR">Last 1 hour</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="transaction-type">Transaction type</label>
                <select id="transaction-type" name="type" defaultValue={selectedType}>
                  <option value="ALL">Income and expenses</option>
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="transaction-sort">Sort by</label>
                <select id="transaction-sort" name="sort" defaultValue={selectedSort}>
                  <option value="DATE_DESC">Date: newest first</option>
                  <option value="DATE_ASC">Date: oldest first</option>
                  <option value="AMOUNT_DESC">Amount: highest first</option>
                  <option value="AMOUNT_ASC">Amount: lowest first</option>
                </select>
              </div>
              <div className="transactions-filter-actions">
                <Link className="button ghost" href="/transactions">Clear filters</Link>
                <button className="button" type="submit">Apply filters</button>
              </div>
            </form>
          </Popup>
          {isAdmin && data.event && (
            <Link className="button secondary icon-button" href="/api/export" aria-label="Export Excel" title="Export Excel">
              <Download size={18} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
      <section className="card transaction-totals" aria-label="Filtered transaction totals">
        <div>
          <small className="muted">Total collection</small>
          <b className="transaction-total-income">{rupees(totalCollection)}</b>
        </div>
        <div>
          <small className="muted">Total expense</small>
          <b className="transaction-total-expense">{rupees(totalExpense)}</b>
        </div>
      </section>
      <div className="card">
        {items.length === 0 ? <p>{allItems.length || range || selectedManager || selectedType !== 'ALL' ? 'No transactions match these filters.' : 'No transactions yet'}</p> : items.map((item) => (
          <div className="listrow transaction-row" key={item.type + item.id}>
            <div>
              <b>{item.category}</b>
              <p className="muted">{item.type} · {new Date(item.date).toLocaleDateString('en-IN')}</p>
              <p className="muted">
                {item.type === 'INCOME'
                  ? `Received from: ${item.from || '—'}`
                  : `Paid to: ${item.paidTo || '—'}`}
              </p>
              {isAdmin && <p className="muted">By {item.createdByName || 'Admin'}</p>}
              {'status' in item && (
                <span className={`pill ${item.status === 'APPROVED' ? 'approved' : item.status === 'REJECTED' ? 'rejected' : ''}`}>
                  {item.status}
                </span>
              )}
            </div>
            <div className="transaction-actions">
              <b>{item.type === 'INCOME' ? '+' : '−'}{rupees(item.amount)}</b>
              <div className="transaction-icon-actions">
                {item.type === 'INCOME' && (
                  <Link
                    className="button ghost icon-button"
                    href={`/receipt/${item.id}`}
                    aria-label="View e-receipt"
                    title="View e-receipt"
                  >
                    <Receipt size={17} aria-hidden="true" />
                  </Link>
                )}
                <TransactionEditForm
                  record={item.type === 'INCOME'
                    ? {
                        type: 'income',
                        id: item.id,
                        amount: item.amount,
                        category: item.category,
                        from: item.from,
                        address: item.address,
                        method: item.method,
                        note: item.note,
                      }
                    : {
                        type: 'expense',
                        id: item.id,
                        amount: item.amount,
                        category: item.category,
                        paidTo: item.paidTo,
                        method: item.method,
                        note: item.note,
                      }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}
