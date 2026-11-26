import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Types } from 'mongoose';
import { Frame } from '@/components/Frame';
import { LiveSearchList } from '@/components/LiveSearchList';
import { admin, rupees } from '@/lib/access';
import { db } from '@/lib/db';
import { formatTransactionDate } from '@/lib/transaction-date';
import { Event } from '@/models/Event';
import { AuditLog } from '@/models/AuditLog';
import { Expense } from '@/models/Expense';
import { Income } from '@/models/Income';
import { ManagerHandover } from '@/models/ManagerHandover';
import { Team } from '@/models/Team';
import { User } from '@/models/User';
import { ArrowLeft } from 'lucide-react';

type Scope = 'manager' | 'team' | 'sector' | 'unit';
type ActivityTab = 'income' | 'expense' | 'paid';
type SearchParams = { scope?: string; value?: string; sector?: string; tab?: string };

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await admin();
  await db();
  const [{ eventId }, query] = await Promise.all([params, searchParams]);
  if (!Types.ObjectId.isValid(eventId)) notFound();
  const scope = query.scope as Scope;
  const value = (query.value ?? '').trim().slice(0, 120);
  const sector = (query.sector ?? '').trim().slice(0, 120);
  const selectedTab: ActivityTab = query.tab === 'expense' || query.tab === 'paid' ? query.tab : 'income';
  if (!['manager', 'team', 'sector', 'unit'].includes(scope) || !value || (scope === 'unit' && !sector)) notFound();

  const event = await Event.findById(eventId).lean();
  if (!event) notFound();
  const eventManagerIds = event.managerIds.map((managerId) => new Types.ObjectId(String(managerId)));
  let title = value;
  let managerIds: Types.ObjectId[] | null = null;

  if (scope === 'manager') {
    const isEventManager = event.managerIds.some((managerId) => String(managerId) === value);
    const isEventSuperAdmin = String(event.createdBy) === value;
    if (!Types.ObjectId.isValid(value) || (!isEventManager && !isEventSuperAdmin)) notFound();
    const manager = await User.findById(value).select('name').lean();
    if (!manager) notFound();
    title = String(manager.name);
    managerIds = [new Types.ObjectId(value)];
  }

  if (scope === 'team') {
    if (!Types.ObjectId.isValid(value)) notFound();
    const team = await Team.findById(value).select('name').lean();
    if (!team) notFound();
    title = String(team.name);
    const explicitAssignments = event.managerTeams ?? [];
    const explicitManagerIds = new Set(explicitAssignments.map((assignment) => String(assignment.managerId)));
    const selectedManagerIds = explicitAssignments
      .filter((assignment) => String(assignment.teamId ?? '') === value)
      .map((assignment) => new Types.ObjectId(String(assignment.managerId)));
    const legacyManagerIds = eventManagerIds.filter((managerId) => !explicitManagerIds.has(String(managerId)));
    const legacyMembers = legacyManagerIds.length
      ? await User.find({ _id: { $in: legacyManagerIds }, role: 'MANAGER', teamIds: new Types.ObjectId(value) }).distinct('_id')
      : [];
    managerIds = [...new Map([...selectedManagerIds, ...legacyMembers].map((managerId) => [String(managerId), managerId])).values()];
  }

  const incomeFilter: Record<string, unknown> = { eventId: event._id };
  if (scope === 'manager' || scope === 'team') incomeFilter.createdBy = { $in: managerIds ?? [] };
  if (scope === 'sector') incomeFilter.sector = value;
  if (scope === 'unit') Object.assign(incomeFilter, { sector, unit: value });
  const expenseFilter = (scope === 'manager' || scope === 'team')
    ? { eventId: event._id, createdBy: { $in: managerIds ?? [] } }
    : null;
  const handoverFilter = (scope === 'manager' || scope === 'team')
    ? { eventId: event._id, managerId: { $in: managerIds ?? [] } }
    : null;
  const [incomes, expenses, handovers, handoverLogs] = await Promise.all([
    Income.find(incomeFilter).sort({ createdAt: -1 }).lean(),
    expenseFilter ? Expense.find(expenseFilter).sort({ createdAt: -1 }).lean() : Promise.resolve([]),
    handoverFilter ? ManagerHandover.find(handoverFilter).lean() : Promise.resolve([]),
    handoverFilter ? AuditLog.find({ entityId: event._id, action: 'MANAGER_HANDOVER_RECORDED' }).select('detail createdAt').sort({ createdAt: -1 }).lean() : Promise.resolve([]),
  ]);
  const creatorIds = [...new Set([
    ...incomes.map((income) => String(income.createdBy)),
    ...expenses.map((expense) => String(expense.createdBy)),
    ...(managerIds ?? []).map(String),
  ])].filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
  const creators = creatorIds.length ? await User.find({ _id: { $in: creatorIds } }).select('name').lean() : [];
  const creatorNames = new Map(creators.map((creator) => [String(creator._id), String(creator.name)]));
  const totalIncome = incomes.reduce((total, income) => total + Number(income.amountMinor), 0);
  const totalExpense = expenses
    .filter((expense) => expense.status === 'APPROVED' || expense.status === 'PENDING')
    .reduce((total, expense) => total + Number(expense.amountMinor), 0);
  const handedOverByManager = new Map(handovers.map((handover) => [String(handover.managerId), Number(handover.totalMinor)]));
  const totalPaidToAdmin = handovers.reduce((total, handover) => total + Number(handover.totalMinor), 0);
  const selectedManagerIds = new Set((managerIds ?? []).map(String));
  const paymentHistory = handoverLogs.flatMap((log) => {
    const detail = typeof log.detail === 'object' && log.detail !== null ? log.detail as Record<string, unknown> : {};
    const managerId = String(detail.managerId ?? '');
    const amount = Number(detail.amountMinor);
    if (!selectedManagerIds.has(managerId) || !Number.isSafeInteger(amount) || amount <= 0) return [];
    return [{
      id: String(log._id),
      manager: creatorNames.get(managerId) ?? 'Manager',
      amount,
      date: new Date(log.createdAt),
      remark: typeof detail.remark === 'string' ? detail.remark : '',
    }];
  });
  const recordedByManager = new Map<string, number>();
  for (const log of handoverLogs) {
    const detail = typeof log.detail === 'object' && log.detail !== null ? log.detail as Record<string, unknown> : {};
    const managerId = String(detail.managerId ?? '');
    const amount = Number(detail.amountMinor);
    if (selectedManagerIds.has(managerId) && Number.isSafeInteger(amount) && amount > 0) {
      recordedByManager.set(managerId, (recordedByManager.get(managerId) ?? 0) + amount);
    }
  }
  for (const [managerId, total] of handedOverByManager) {
    const earlierAmount = Math.max(total - (recordedByManager.get(managerId) ?? 0), 0);
    if (earlierAmount > 0) paymentHistory.push({
      id: `legacy-${managerId}`,
      manager: creatorNames.get(managerId) ?? 'Manager',
      amount: earlierAmount,
      date: new Date(0),
      remark: 'Earlier recorded amount',
    });
  }
  paymentHistory.sort((a, b) => b.date.getTime() - a.date.getTime());
  const currentBalance = totalIncome - totalExpense - totalPaidToAdmin;
  const tabHref = (tab: ActivityTab) => {
    const params = new URLSearchParams({ scope, value, tab });
    if (sector) params.set('sector', sector);
    return `/events/${eventId}/activity?${params.toString()}`;
  };
  const activities = [
    ...incomes.map((income) => ({
      id: `income-${String(income._id)}`,
      type: 'Income' as const,
      amount: Number(income.amountMinor),
      date: new Date(income.createdAt),
      manager: creatorNames.get(String(income.createdBy)) ?? 'Manager',
      category: String(income.category),
      from: String(income.from || ''),
      sector: String(income.sector || ''),
      unit: String(income.unit || ''),
    })),
    ...expenses.map((expense) => ({
      id: `expense-${String(expense._id)}`,
      type: 'Expense' as const,
      amount: Number(expense.amountMinor),
      date: new Date(expense.createdAt),
      manager: creatorNames.get(String(expense.createdBy)) ?? 'Manager',
      category: String(expense.category),
      paidTo: String(expense.paidTo || ''),
      status: String(expense.status),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <Frame>
      <div className="sectionhead">
        <div className="flex gap-2 items-center">
          <Link className="muted bg-green-100 p-2 rounded-xl" href="/events"><ArrowLeft/></Link>
          <div>

          <h2 style={{margin:"0px"}}>{title}</h2>
          <p className="muted" style={{margin:"0px"}}>{event.name} · {scope === 'unit' ? `${sector} unit` : scope} activity</p>
          </div>
        </div>
      </div>
      <section className="card transaction-totals" aria-label={`${title} activity totals`}>
        <div>
          <small className="muted">Total collection</small>
          <b className="transaction-total-income">{rupees(totalIncome)}</b>
        </div>
        <div>
          <small className="muted">Total expense</small>
          <b className="transaction-total-expense">{rupees(totalExpense)}</b>
        </div>
        <div>
          <small className="muted">Total paid to admin</small>
          <b>{rupees(totalPaidToAdmin)}</b>
        </div>
        <div>
          <small className="muted">Current balance</small>
          <b className={currentBalance < 0 ? 'transaction-total-expense' : 'transaction-total-income'}>{rupees(currentBalance)}</b>
        </div>
      </section>
      <nav className="transaction-tabs" aria-label="Activity type">
        {([
          { id: 'income', label: 'Income' },
          { id: 'expense', label: 'Expense' },
          { id: 'paid', label: 'Paid to admin' },
        ] as const).map((tab) => (
          <Link key={tab.id} className={`transaction-tab${selectedTab === tab.id ? ' active' : ''}`} href={tabHref(tab.id)} aria-current={selectedTab === tab.id ? 'page' : undefined}>
            {tab.label}
          </Link>
        ))}
      </nav>
      <LiveSearchList
        className="card"
        inputId="activity-search"
        label="Search activity"
        placeholder="Search activity"
        emptyMessage={selectedTab === 'paid' ? 'No payments to admin recorded for this selection.' : `No ${selectedTab} activity recorded for this selection.`}
        noResultsMessage="No activity matches your search."
        pageSize={20}
      >
        {selectedTab === 'paid' ? paymentHistory.map((payment) => (
          <div className="listrow transaction-row" data-search={`${payment.manager} ${payment.remark} ${rupees(payment.amount)}`} key={payment.id}>
            <div className="transaction-summary">
              <p className="muted">Paid to admin · {payment.date.getTime() === 0 ? 'Earlier recorded amount' : formatTransactionDate(payment.date)}</p>
              <div className="transaction-summary-row transaction-primary-row">
                <b>{payment.manager}</b>
                <strong className="transaction-amount income">−{rupees(payment.amount)}</strong>
              </div>
              {payment.remark && <p className="muted">{payment.remark}</p>}
            </div>
          </div>
        )) : activities.filter((activity) => activity.type === (selectedTab === 'income' ? 'Income' : 'Expense')).map((activity) => (
          <div
            className="listrow transaction-row"
            data-search={activity.type === 'Income'
              ? [activity.category, activity.from, activity.sector, activity.unit, activity.manager, rupees(activity.amount)].join(' ')
              : [activity.category, activity.paidTo, activity.status, activity.manager, rupees(activity.amount)].join(' ')}
            key={activity.id}
          >
            <div className="transaction-summary">
              {activity.type === 'Income' ? <>
                <div className="transaction-summary-row">
                  <span className={`transaction-category-chip ${activity.category === 'Rifadha' || activity.category === 'Rifala' || activity.category === 'Rifada' ? 'rifadha' : 'donation'}`}>
                    {activity.category === 'Rifala' || activity.category === 'Rifada' ? 'Rifadha' : activity.category}
                  </span>
                  <p className="muted">Income · {formatTransactionDate(activity.date)}</p>
                </div>
                <div className="transaction-summary-row transaction-primary-row">
                  <b>{activity.from || '—'}</b>
                  <strong className="transaction-amount income">+{rupees(activity.amount)}</strong>
                </div>
                <div>
                  {activity.sector && <p className="muted">{activity.sector}{activity.unit ? ` · ${activity.unit}` : ''}</p>}
                  <p className="muted">By {activity.manager}</p>
                </div>
              </> : <>
                <p className="muted">Expense · {formatTransactionDate(activity.date)}</p>
                <div className="transaction-summary-row transaction-primary-row">
                  <b>{activity.category}</b>
                  <strong className="transaction-amount expense">−{rupees(activity.amount)}</strong>
                </div>
                <div>
                  <p className="muted">Paid to: {activity.paidTo || '—'}</p>
                  <p className="muted">By {activity.manager}</p>
                  <span className={`pill ${activity.status === 'APPROVED' ? 'approved' : activity.status === 'REJECTED' ? 'rejected' : ''}`}>{activity.status}</span>
                </div>
              </>}
            </div>
          </div>
        ))}
      </LiveSearchList>
    </Frame>
  );
}
