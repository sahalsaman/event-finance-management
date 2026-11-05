import Link from 'next/link';
import { Frame } from '@/components/Frame';
import { activeData } from '@/lib/data';
import { rupees } from '@/lib/access';
import { formatTransactionDate } from '@/lib/transaction-date';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const data = await activeData();
  const query = await searchParams;
  const isAdmin = data.user.role === 'SUPER_ADMIN';
  const target = isAdmin ? data.event?.targetMinor ?? 0 : data.event?.managerTargetMinor ?? 0;
  const achieved = target > 0 ? Math.round((data.summary!.income / target) * 100) : 0;

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
              <section className="goal-summary ">
                <div className="sectionhead" style={{ margin: 0 }}>
                  <span>
                    <small className="muted">Collected</small>
                    <h1><b>{rupees(data.summary!.income)}</b></h1>
                  </span>
                  <div className="">
                    <small className="muted">Target</small><br/>
                    <b>{target > 0 ? rupees(target) : 'Not set'}</b>
                  </div>
                </div>
                <div className=" flex justify-between">
                  <div>
                    <small className="muted">Balance : </small>
                    <span className='muted'>{target > 0 ? rupees(Math.max(target - data.summary!.income, 0)) : '—'}</span>
                  </div>
                  <span className='muted'>{target > 0 ? `${achieved}% achieved` : 'Not set'}</span>
                </div>
                {target > 0 && (
                  <div
                    className="goal-progress-track"
                    role="progressbar"
                    aria-valuenow={Math.min(achieved, 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${achieved}% of target achieved`}
                  >
                    <span className="goal-progress-fill" style={{ width: `${Math.min(achieved, 100)}%` }} />
                  </div>
                )}
              </section>
            </div>
            {!isAdmin && data.teamSummary && (() => {
              const teamTarget = data.teamSummary.target;
              const teamAchieved = teamTarget > 0
                ? Math.round((data.teamSummary.income / teamTarget) * 100)
                : 0;
              return (
                <section className="card goal-summary goal-summary-green" aria-label="Team collection summary">
                  <div className="sectionhead" style={{ margin: 0 }}>
                    <h2>{data.teamSummary.name}</h2>
                    <span>
                      <small className="muted">Team target</small><br />
                      <b>{teamTarget > 0 ? rupees(teamTarget) : 'Not set'}</b>
                    </span>
                  </div>
                  <div className="goal-summary-values">
                    <span>
                      <small className="muted">Team collected</small>
                      <b>{rupees(data.teamSummary.income)}</b>
                    </span>
                    <span>
                      <small className="muted">Team balance</small>
                      <b>{teamTarget > 0 ? rupees(Math.max(teamTarget - data.teamSummary.income, 0)) : '—'}</b>
                    </span>
                    <b>{teamTarget > 0 ? `${teamAchieved}% achieved` : 'Target not set'}</b>
                  </div>
                  {teamTarget > 0 && (
                    <div
                      className="goal-progress-track"
                      role="progressbar"
                      aria-valuenow={Math.min(teamAchieved, 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${teamAchieved}% of team target achieved`}
                    >
                      <span className="goal-progress-fill" style={{ width: `${Math.min(teamAchieved, 100)}%` }} />
                    </div>
                  )}
                </section>
              );
            })()}
            <section
              className={`card home-finance-summary${isAdmin ? ' home-finance-summary-admin' : ''}`}
              aria-label={isAdmin ? 'Expense and balance summary' : 'Expense, balance, and handover summary'}
            >
              {!isAdmin && (
                <div>
                  <small className="muted">Paid to admin</small>
                  <b>{rupees(data.summary!.paidToAdmin)}</b>
                </div>
              )}
              <div>
                <small className="muted">Expenses</small>
                <b>{rupees(data.summary!.totalExpense)}</b>
              </div>
              <div>
                <small className="muted">Balance</small>
                <b>{rupees(data.summary!.balance)}</b>
              </div>
            </section>
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
              <div className="sectionhead" style={{margin: 0}}>
                <h2>Recent Activity</h2>
                <Link href="/transactions">View all</Link>
              </div>
              {[
                ...data.incomes.map((income) => ({ ...income, type: 'income' as const })),
                ...data.expenses.map((expense) => ({ ...expense, type: 'expense' as const })),
              ]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 10)
                .map((transaction) => (
                  <div key={transaction.type + transaction.id} className="listrow">
                    <div>
                      <b>{transaction.category}</b>
                      <p className="muted">
                        {formatTransactionDate(transaction.date)} · {transaction.type === 'income' ? 'Income' : 'Expense'}
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
