import { Frame } from '@/components/Frame';
import { TransactionEditForm } from '@/components/TransactionEditForm';
import { activeData } from '@/lib/data';
import { rupees } from '@/lib/access';
import Link from 'next/link';
import { Download } from 'lucide-react';

export default async function Page() {
  const data = await activeData();
  const isAdmin = data.user.role === 'SUPER_ADMIN';
  const items = [
    ...data.incomes.map((income) => ({ ...income, type: 'INCOME' as const })),
    ...data.expenses.map((expense) => ({ ...expense, type: 'EXPENSE' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Frame>
      <div className="transactions-heading">
        <div>
          <h1>Transactions</h1>
          <p className="muted">{data.event?.name || 'No current event'}</p>
        </div>
        {isAdmin && data.event && (
          <Link className="button secondary export-button" href="/api/export">
            <Download size={17} aria-hidden="true" /> Export Excel
          </Link>
        )}
      </div>
      <div className="card">
        {items.length === 0 ? <p>No transactions yet</p> : items.map((item) => (
          <div className="listrow transaction-row" key={item.type + item.id}>
            <div>
              <b>{item.category}</b>
              <p className="muted">{item.type} · {new Date(item.date).toLocaleDateString('en-IN')}</p>
              {isAdmin && <p className="muted">By {item.createdByName || 'Admin'}</p>}
              {'status' in item && (
                <span className={`pill ${item.status === 'APPROVED' ? 'approved' : item.status === 'REJECTED' ? 'rejected' : ''}`}>
                  {item.status}
                </span>
              )}
            </div>
            <div className="transaction-actions">
              <b>{item.type === 'INCOME' ? '+' : '−'}{rupees(item.amount)}</b>
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
        ))}
      </div>
    </Frame>
  );
}
