import { Frame } from '@/components/Frame';
import { TransactionEditForm } from '@/components/TransactionEditForm';
import { activeData } from '@/lib/data';
import { rupees } from '@/lib/access';
import Link from 'next/link';
import { Download, Filter, Receipt } from 'lucide-react';
import { Popup } from '@/components/Popup';

type TransactionFilters = {
  manager?: string;
  type?: string;
  sort?: string;
};

export default async function Page({ searchParams }: { searchParams: Promise<TransactionFilters> }) {
  const data = await activeData();
  const isAdmin = data.user.role === 'SUPER_ADMIN';
  const filters = await searchParams;
  const allItems = [
    ...data.incomes.map((income) => ({ ...income, type: 'INCOME' as const })),
    ...data.expenses.map((expense) => ({ ...expense, type: 'EXPENSE' as const })),
  ];
  const managers = [...new Map(
    allItems
      .filter((item) => item.createdById && item.createdByName)
      .map((item) => [item.createdById, { id: item.createdById, name: item.createdByName }]),
  ).values()].sort((a, b) => a.name.localeCompare(b.name));
  const selectedManager = isAdmin && managers.some((manager) => manager.id === filters.manager)
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
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>{manager.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
      <div className="card">
        {items.length === 0 ? <p>{allItems.length ? 'No transactions match these filters.' : 'No transactions yet'}</p> : items.map((item) => (
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
