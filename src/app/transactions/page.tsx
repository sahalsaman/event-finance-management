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
import { connection } from 'next/server';
import { Team } from '@/models/Team';
import { User } from '@/models/User';
import { Event } from '@/models/Event';
import { TransactionLocationFilters } from '@/components/TransactionLocationFilters';
import { isIncomeSector, isUnitForSector } from '@/lib/sectors';

type TransactionFilters = {
  manager?: string;
  team?: string;
  sector?: string;
  unit?: string;
  type?: string;
  sort?: string;
  period?: string;
};

type TransactionPeriod = 'ALL' | 'TODAY';

function getTransactionRange(period: TransactionPeriod, now = new Date()) {
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
  const startKey = todayKey;
  const endKey = new Date(todayUtc + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    start: new Date(`${startKey}T00:00:00+05:30`),
    end: new Date(`${endKey}T00:00:00+05:30`),
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<TransactionFilters> }) {
  const filters = await searchParams;
  await connection();
  const selectedPeriod: TransactionPeriod = filters.period === 'TODAY' ? 'TODAY' : 'ALL';
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
  const teams = isAdmin
    ? await Team.find().sort({ name: 1 }).select('_id name').lean()
    : [];
  const selectedTeam = isAdmin && teams.some((team) => String(team._id) === filters.team)
    ? filters.team
    : '';
  const selectedManager = isAdmin && Types.ObjectId.isValid(filters.manager ?? '')
    ? filters.manager
    : '';
  const selectedSector = isIncomeSector(filters.sector ?? '') ? filters.sector! : '';
  const selectedUnit = selectedSector && isUnitForSector(selectedSector, filters.unit ?? '')
    ? filters.unit!
    : '';
  const selectedType = filters.type === 'INCOME' || filters.type === 'EXPENSE' ? filters.type : 'ALL';
  const selectedSort = ['DATE_ASC', 'AMOUNT_DESC', 'AMOUNT_ASC'].includes(filters.sort ?? '')
    ? filters.sort!
    : 'DATE_DESC';
  const activeEvent = isAdmin && data.event
    ? await Event.findById(data.event.id).select('managerIds managerTeams').lean()
    : null;
  let teamManagerIds: string[] = [];
  if (selectedTeam && activeEvent) {
    const explicitAssignments = activeEvent.managerTeams ?? [];
    const explicitManagerIds = new Set(explicitAssignments.map((assignment) => String(assignment.managerId)));
    const explicitMembers = explicitAssignments
      .filter((assignment) => String(assignment.teamId ?? '') === selectedTeam)
      .map((assignment) => String(assignment.managerId));
    const legacyManagerIds = activeEvent.managerIds
      .filter((managerId) => !explicitManagerIds.has(String(managerId)));
    const legacyMembers = legacyManagerIds.length
      ? await User.find({
          _id: { $in: legacyManagerIds },
          role: 'MANAGER',
          teamIds: new Types.ObjectId(selectedTeam),
        }).distinct('_id')
      : [];
    teamManagerIds = [...new Set([...explicitMembers, ...legacyMembers.map(String)])];
  }
  const teamManagerSet = new Set(teamManagerIds);
  const selectedCreatorIds = selectedManager
    ? selectedTeam && !teamManagerSet.has(selectedManager)
      ? []
      : [selectedManager]
    : selectedTeam
      ? teamManagerIds
      : null;
  const hasLocationFilter = Boolean(selectedSector || selectedUnit);
  const items = allItems
    .filter((item) => selectedType === 'ALL' || item.type === selectedType)
    .filter((item) => selectedCreatorIds === null || selectedCreatorIds.includes(item.createdById))
    .filter((item) => !hasLocationFilter || (
      item.type === 'INCOME' &&
      (!selectedSector || item.sector === selectedSector) &&
      (!selectedUnit || item.unit === selectedUnit)
    ))
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
          : selectedCreatorIds !== null
            ? { createdBy: { $in: selectedCreatorIds.map((id) => new Types.ObjectId(id)) } }
            : {}),
        ...(range ? { createdAt: { $gte: range.start, $lt: range.end } } : {}),
      }
    : null;
  const [incomeTotals, expenseTotals] = totalsFilter
    ? await Promise.all([
        selectedType === 'EXPENSE' || hasLocationFilter
          ? Promise.resolve([])
          : Income.aggregate([
              {
                $match: {
                  ...totalsFilter,
                  ...(selectedSector ? { sector: selectedSector } : {}),
                  ...(selectedUnit ? { unit: selectedUnit } : {}),
                },
              },
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
                  <label htmlFor="transaction-team">Team</label>
                  <select id="transaction-team" name="team" defaultValue={selectedTeam}>
                    <option value="">All teams</option>
                    {teams.map((team) => (
                      <option key={String(team._id)} value={String(team._id)}>{team.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
              <TransactionLocationFilters
                defaultSector={selectedSector}
                defaultUnit={selectedUnit}
              />
              <div className="field">
                <fieldset className="filter-chip-group">
                  <legend>Date range</legend>
                  {(['ALL', 'TODAY'] as const).map((period) => (
                    <label className="filter-chip" key={period}>
                      <input
                        type="radio"
                        name="period"
                        value={period}
                        defaultChecked={selectedPeriod === period}
                      />
                      <span>{period === 'ALL' ? 'All' : 'Today'}</span>
                    </label>
                  ))}
                </fieldset>
              </div>
              <div className="field">
                <fieldset className="filter-chip-group">
                  <legend>Transaction type</legend>
                  {(['ALL', 'INCOME', 'EXPENSE'] as const).map((type) => (
                    <label className="filter-chip" key={type}>
                      <input
                        type="radio"
                        name="type"
                        value={type}
                        defaultChecked={selectedType === type}
                      />
                      <span>{type === 'ALL' ? 'All' : type === 'INCOME' ? 'Income' : 'Expense'}</span>
                    </label>
                  ))}
                </fieldset>
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
        {items.length === 0 ? <p>{allItems.length || range || selectedManager || selectedTeam || hasLocationFilter || selectedType !== 'ALL' ? 'No transactions match these filters.' : 'No transactions yet'}</p> : items.map((item) => (
          <div className="listrow transaction-row" key={item.type + item.id}>
            <div>
              <b>{item.category}</b>
              <p className="muted">{item.type} · {new Date(item.date).toLocaleDateString('en-IN')}</p>
              <p className="muted">
                {item.type === 'INCOME'
                  ? `Received from: ${item.from || '—'}`
                  : `Paid to: ${item.paidTo || '—'}`}
              </p>
              {item.type === 'INCOME' && item.sector && (
                <p className="muted">{item.sector} · {item.unit}</p>
              )}
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
                        sector: item.sector,
                        unit: item.unit,
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
