import Link from 'next/link';
import { Frame } from '@/components/Frame';
import { activeData } from '@/lib/data';
import { rupees } from '@/lib/access';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const data = await activeData();
  const query = await searchParams;
  const isAdmin = data.user.role === 'SUPER_ADMIN';

  return (
    <Frame>
      <div className="stack">
        {query.saved && (
          <div className="card" style={{ color: '#116b47' }}>
            ✓ {query.saved === 'expense' ? 'Expense submitted successfully' : 'Income recorded successfully'}
          </div>
        )}
        {!data.event ? (
          <div className="card">
            <h1>No active event</h1>
            <p className="muted">
              {isAdmin
                ? 'Create and activate an event to get started.'
                : 'Contact your admin for access to the active event.'}
            </p>
            {isAdmin && <Link className="button" href="/events">Manage Events</Link>}
          </div>
        ) : (
          <>
            <div className="card hero">
              <div className="event-status">
                <span className="muted">CURRENT EVENT</span>
                <b className="live-status">
                  <span className="live-dot" aria-hidden="true" />
                  LIVE
                </b>
              </div>
              <h1 style={{ marginTop: 10 }}>{data.event.name}</h1>
              <p className="muted">
                {new Date(data.event.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · {data.event.location}
              </p>
              <p className="muted" style={{ marginTop: 22 }}>Available Balance</p>
              <div className="money">{rupees(data.summary!.balance)}</div>
              <div className="grid2" style={{ marginTop: 16 }}>
                <div>
                  <p className="muted">{isAdmin ? 'Total Event Income' : 'Your Event Income'}</p>
                  <b>{rupees(data.summary!.income)}</b>
                </div>
                <div>
                  <p className="muted">{isAdmin ? 'Total Event Expenses' : 'Your Event Expenses'}</p>
                  <b>{rupees(data.summary!.totalExpense)}</b>
                </div>
              </div>
              <p className="muted" style={{ marginTop: 14 }}>
                Pending approval: {rupees(data.summary!.pending)}
              </p>
            </div>
            <div className="grid2">
              <Link href="/income" className="button" style={{ minHeight: 64 }}>＋ Add Income</Link>
              <Link href="/expense" className="button secondary" style={{ minHeight: 64 }}>− Add Expense</Link>
            </div>
            {isAdmin && (
              <Link
                href="/approvals"
                className="card"
                style={{ display: 'flex', justifyContent: 'space-between', textDecoration: 'none', color: '#144b33' }}
              >
                <b>Expense Approvals</b>
                <b>{rupees(data.summary!.pending)} →</b>
              </Link>
            )}
            <section className="card">
              <div className="sectionhead">
                <h2>Recent Activity</h2>
                <Link href="/transactions">View all</Link>
              </div>
              {[
                ...data.incomes.map((income) => ({ ...income, type: 'income' as const })),
                ...data.expenses.map((expense) => ({ ...expense, type: 'expense' as const })),
              ]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 7)
                .map((transaction) => (
                  <div key={transaction.type + transaction.id} className="listrow">
                    <div>
                      <b>{transaction.category}</b>
                      <p className="muted">
                        {new Date(transaction.date).toLocaleDateString('en-IN')} · {transaction.type === 'income' ? 'Income' : 'Expense'}
                      </p>
                      {isAdmin && <p className="muted">By {transaction.createdByName || 'Admin'}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <b style={{ color: transaction.type === 'income' ? '#138343' : '#bd5d25' }}>
                        {transaction.type === 'income' ? '+' : '−'}{rupees(transaction.amount)}
                      </b>
                      {'status' in transaction && (
                        <p>
                          <span
                            className={`pill ${
                              transaction.status === 'APPROVED'
                                ? 'approved'
                                : transaction.status === 'REJECTED'
                                  ? 'rejected'
                                  : ''
                            }`}
                          >
                            {transaction.status}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </section>
          </>
        )}
      </div>
    </Frame>
  );
}
