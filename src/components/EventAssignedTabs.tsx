'use client';

import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import { Filter, Share2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Popup } from '@/components/Popup';
import { ShareMessage } from '@/components/ShareMessage';
import { rupees } from '@/lib/currency';

type Tab = 'managers' | 'teams' | 'sectors' | 'units';
type DayFilter = 'ALL' | 'TODAY';
type TransactionType = 'ALL' | 'INCOME' | 'EXPENSE';
type SortOrder = 'COLLECTION_DESC' | 'COLLECTION_ASC' | 'NAME_ASC';

type ManagerRow = {
  id: string;
  name: string;
  sectors: string[];
  teamId: string;
  teamName: string;
  income: number;
  todayIncome: number;
  target: number;
  expense: number;
  todayExpense: number;
  handedOver: number;
  isSuperAdmin: boolean;
};

type TeamRow = {
  id: string;
  name: string;
  income: number;
  todayIncome: number;
  target: number;
  memberCount: number;
  canDelete: boolean;
};

type CollectionRow = {
  name: string;
  income: number;
  todayIncome: number;
  managerCount: number;
  todayManagerCount: number;
};

type ContentRow = {
  id: string;
  content: ReactNode;
};

function compareRows<T extends { name: string }>(
  rows: T[],
  order: SortOrder,
  amount: (row: T) => number,
) {
  return [...rows].sort((a, b) => {
    if (order === 'NAME_ASC') return a.name.localeCompare(b.name);
    const difference = amount(b) - amount(a);
    return (order === 'COLLECTION_ASC' ? -difference : difference) || a.name.localeCompare(b.name);
  });
}

function formatCollection(amountMinor: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(amountMinor / 100);
}

export function EventAssignedTabs({
  eventName,
  eventDateLabel,
  shareTargetId,
  filterTargetId,
  headerAction,
  managers,
  managerActions,
  teams,
  teamActions,
  teamHeaderAction,
  sectors,
  units,
}: {
  eventName: string;
  eventDateLabel: string;
  shareTargetId: string;
  filterTargetId: string;
  headerAction?: ReactNode;
  managers: ManagerRow[];
  managerActions: ContentRow[];
  teams: TeamRow[];
  teamActions: ContentRow[];
  teamHeaderAction?: ReactNode;
  sectors: CollectionRow[];
  units: Array<CollectionRow & { sector: string }>;
}) {
  const instanceId = useId();
  const [shareHost, setShareHost] = useState<HTMLElement | null>(null);
  const [filterHost, setFilterHost] = useState<HTMLElement | null>(null);
  const [tab, setTab] = useState<Tab>('managers');
  const [day, setDay] = useState<DayFilter>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('COLLECTION_DESC');
  const [transactionType, setTransactionType] = useState<TransactionType>('ALL');
  const [managerTeam, setManagerTeam] = useState('');
  const [managerSector, setManagerSector] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [unitSector, setUnitSector] = useState('');
  const [unitFilter, setUnitFilter] = useState('');

  useEffect(() => {
    setShareHost(document.getElementById(shareTargetId));
    setFilterHost(document.getElementById(filterTargetId));
  }, [filterTargetId, shareTargetId]);

  const incomeFor = (row: { income: number; todayIncome: number }) =>
    day === 'TODAY' ? row.todayIncome : row.income;
  const expenseFor = (row: { expense: number; todayExpense: number }) =>
    day === 'TODAY' ? row.todayExpense : row.expense;
  const filteredManagers = managers.filter((manager) =>
    (!managerTeam || manager.teamId === managerTeam) &&
    (!managerSector || manager.sectors.includes(managerSector)) &&
    (transactionType !== 'INCOME' || incomeFor(manager) > 0) &&
    (transactionType !== 'EXPENSE' || expenseFor(manager) > 0),
  );
  const sortedManagers = compareRows(filteredManagers, sortOrder, (manager) =>
    transactionType === 'EXPENSE' ? expenseFor(manager) : incomeFor(manager),
  );
  const filteredTeams = teams.filter((team) => !teamFilter || team.id === teamFilter);
  const sortedTeams = compareRows(filteredTeams, sortOrder, incomeFor);
  const filteredSectors = sectors.filter((sector) => !sectorFilter || sector.name === sectorFilter);
  const sortedSectors = compareRows(filteredSectors, sortOrder, incomeFor);
  const sectorUnits = units.filter((unit) => !unitSector || unit.sector === unitSector);
  const filteredUnits = sectorUnits.filter((unit) => !unitFilter || unit.name === unitFilter);
  const sortedUnits = compareRows(filteredUnits, sortOrder, incomeFor);
  const managerActionsById = new Map(managerActions.map((item) => [item.id, item.content]));
  const teamActionsById = new Map(teamActions.map((item) => [item.id, item.content]));

  const summaryLines = useMemo(() => {
    let rows: string[];
    let breakdown: string;
    if (tab === 'managers') {
      breakdown = 'Managers';
      rows = sortedManagers
        .filter((manager) => !manager.isSuperAdmin)
        .slice(0, 10)
        .map((manager, index) => `${index + 1}. ${manager.name}: ${formatCollection(incomeFor(manager))}`);
    } else if (tab === 'teams') {
      breakdown = 'Teams';
      rows = sortedTeams.slice(0, 10).map((team, index) =>
        `${index + 1}. ${team.name}: ${formatCollection(incomeFor(team))}`,
      );
    } else if (tab === 'sectors') {
      breakdown = 'Sectors';
      rows = sortedSectors.slice(0, 10).map((sector, index) =>
        `${index + 1}. ${sector.name}: ${formatCollection(incomeFor(sector))}`,
      );
    } else {
      breakdown = 'Units';
      rows = sortedUnits.map((unit, index) =>
        `${index + 1}. ${unit.name}: ${formatCollection(incomeFor(unit))}`,
      );
    }

    const sortLabel = sortOrder === 'COLLECTION_ASC'
      ? 'Ascending'
      : sortOrder === 'NAME_ASC'
        ? 'Name A–Z'
        : 'Descending';
    const heading = `*🏆 ${breakdown} Breakdown – Collection status*`;
    const activeFilter = tab === 'managers'
      ? `${day === 'TODAY' ? 'Today' : 'All dates'} · ${transactionType === 'ALL' ? 'All transactions' : transactionType === 'INCOME' ? 'Income' : 'Expense'}`
      : day === 'TODAY'
        ? 'Today'
        : 'All';
    return [
      `*${eventName}*`,
      `📅 This event (${eventDateLabel})`,
      '',
      heading,
      activeFilter,
      ...(rows.length ? rows : ['No data for the selected filters.']),
    ].join('\n');
  }, [
    day,
    eventDateLabel,
    eventName,
    sortedManagers,
    sortedTeams,
    sortedSectors,
    sortedUnits,
    tab,
    transactionType,
    sortOrder,
  ]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'managers', label: 'Managers' },
    { id: 'teams', label: 'Teams' },
    { id: 'sectors', label: 'Sector' },
    { id: 'units', label: 'Unit' },
  ];
  const sharePopup = shareHost
    ? createPortal(
        <Popup
          title={`Share ${eventName} ${tabs.find((item) => item.id === tab)?.label.toLowerCase()} update`}
          trigger={<Share2 size={17} aria-hidden="true" />}
          triggerLabel="Share selected tab and filtered data"
          triggerClassName="button ghost icon-button"
        >
          <ShareMessage message={summaryLines} />
        </Popup>,
        shareHost,
      )
    : null;
  const filterPopup = filterHost
      ? createPortal(
          <Popup
            title={`Filter ${tabs.find((item) => item.id === tab)?.label.toLowerCase()}`}
            trigger={<Filter size={17} aria-hidden="true" />}
            triggerLabel={`Filter ${tabs.find((item) => item.id === tab)?.label.toLowerCase()}`}
            triggerClassName="button ghost icon-button"
          >
            <div className="event-filter-popup">{filterOptions()}</div>
          </Popup>,
          filterHost,
        )
      : null;

  function filterOptions() {
    return (
      <>
        <div className="field">
          <label htmlFor={`${instanceId}-day`}>Day</label>
          <select id={`${instanceId}-day`} value={day} onChange={(event) => setDay(event.target.value as DayFilter)}>
            <option value="ALL">All</option>
            <option value="TODAY">Today</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${instanceId}-sort`}>Sort by</label>
          <select id={`${instanceId}-sort`} value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
            <option value="COLLECTION_DESC">Collection: highest first</option>
            <option value="COLLECTION_ASC">Collection: lowest first</option>
            <option value="NAME_ASC">Name: A to Z</option>
          </select>
        </div>
        {tab === 'managers' && (
          <>
            <div className="field">
              <label htmlFor={`${instanceId}-transaction-type`}>Transaction type</label>
              <select
                id={`${instanceId}-transaction-type`}
                value={transactionType}
                onChange={(event) => setTransactionType(event.target.value as TransactionType)}
              >
                <option value="ALL">All</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${instanceId}-manager-team`}>Filter by team</label>
              <select id={`${instanceId}-manager-team`} value={managerTeam} onChange={(event) => setManagerTeam(event.target.value)}>
                <option value="">All teams</option>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${instanceId}-manager-sector`}>Filter by sector</label>
              <select id={`${instanceId}-manager-sector`} value={managerSector} onChange={(event) => setManagerSector(event.target.value)}>
                <option value="">All sectors</option>
                {[...new Set(managers.flatMap((manager) => manager.sectors))].sort().map((sector) => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </div>
          </>
        )}
        {tab === 'teams' && (
          <div className="field">
            <label htmlFor={`${instanceId}-team`}>Filter by team</label>
            <select id={`${instanceId}-team`} value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
              <option value="">All teams</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
        )}
        {tab === 'sectors' && (
          <div className="field">
            <label htmlFor={`${instanceId}-sector`}>Filter by sector</label>
            <select id={`${instanceId}-sector`} value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}>
              <option value="">All sectors</option>
              {sectors.map((sector) => <option key={sector.name} value={sector.name}>{sector.name}</option>)}
            </select>
          </div>
        )}
        {tab === 'units' && (
          <>
            <div className="field">
              <label htmlFor={`${instanceId}-unit-sector`}>Filter by sector</label>
              <select
                id={`${instanceId}-unit-sector`}
                value={unitSector}
                onChange={(event) => {
                  setUnitSector(event.target.value);
                  setUnitFilter('');
                }}
              >
                <option value="">All sectors</option>
                {[...new Set(units.map((unit) => unit.sector))].sort().map((sector) => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${instanceId}-unit`}>Filter by unit</label>
              <select
                id={`${instanceId}-unit`}
                value={unitFilter}
                onChange={(event) => setUnitFilter(event.target.value)}
              >
                <option value="">All units</option>
                {[...new Set(sectorUnits.map((unit) => unit.name))].sort().map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <section className="manager-assign">

      <div className="event-overview-tabs" role="tablist" aria-label="Assigned collection views">
        {tabs.map((item) => (
          <button
            key={item.id}
            id={`${instanceId}-tab-${item.id}`}
            type="button"
            role="tab"
            className={`event-overview-tab${tab === item.id ? ' active' : ''}`}
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        id={`${instanceId}-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`${instanceId}-tab-${tab}`}
        tabIndex={0}
        className="event-overview-panel"
      >
        {tab === 'managers' && (
          <>
            <div className="assigned-manager-title">
              <p><b>Assigned managers</b></p>
              <div className="event-overview-actions">{headerAction}</div>
            </div>
            <div className="assigned-manager-list">
            {sortedManagers.map((manager, index) => {
              const income = incomeFor(manager);
              const expense = expenseFor(manager);
              const displayAmount = transactionType === 'EXPENSE' ? expense : income;
              const achieved = manager.target > 0 ? Math.round((income / manager.target) * 100) : 0;
              return (
                <div className="assigned-manager-card" key={manager.id}>

                  <div className="assigned-manager-heading">
                    <span className="manager-rank">{index + 1}</span>
                    <div>
                      <b>{manager.name}</b>
                      {manager.isSuperAdmin && <span className="super-admin-badge">Super Admin</span>}
                      <p className="muted">Team: {manager.teamName || 'None'}</p>
                    </div>
                    <div className={`manager-collected${transactionType === 'EXPENSE' ? ' expense-total' : ''}`}>
                      <strong>{rupees(displayAmount)}</strong>
                      <span>
                        {transactionType === 'EXPENSE'
                          ? 'expenses'
                          : day === 'TODAY'
                            ? 'collected today'
                            : transactionType === 'INCOME'
                              ? 'collected'
                              : `of ${manager.target > 0 ? rupees(manager.target) : 'target not set'}`}
                      </span>
                    </div>
                  </div>
                  {day === 'ALL' && transactionType !== 'EXPENSE' && manager.target > 0 && (
                    <div className="manager-progress-row">
                      <div className="goal-progress-track" role="progressbar" aria-valuenow={Math.min(achieved, 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${manager.name}: ${achieved}% of target achieved`}>
                        <span className="goal-progress-fill" style={{ width: `${Math.min(achieved, 100)}%` }} />
                      </div>
                      <b>{achieved}%</b>
                    </div>
                  )}
                  <div className="manager-card-footer">
                    {day === 'ALL' && transactionType !== 'EXPENSE' && (
                      <span>Balance <b>{manager.target > 0 ? rupees(Math.max(manager.target - income, 0)) : '—'}</b></span>
                    )}
                    {transactionType !== 'INCOME' && <span className="expense-total">Expenses {rupees(expense)}</span>}
                    {!manager.isSuperAdmin && day === 'ALL' && transactionType !== 'EXPENSE' && (
                      <span className="handover-total">Paid to admin <b>{rupees(manager.handedOver)}</b></span>
                    )}
                    {managerActionsById.get(manager.id)}
                  </div>
                </div>
              );
            })}
            {sortedManagers.length === 0 && <p className="muted">No managers match these filters.</p>}
            </div>
          </>
        )}

        {tab === 'teams' && (
          <>
            <div className="assigned-manager-title">
              <p><b>Teams</b></p>
              <div className="event-overview-actions">{teamHeaderAction}</div>
            </div>
            <div className="assigned-manager-list">
              {sortedTeams.map((team) => {
                const income = incomeFor(team);
                const achieved = team.target > 0 ? Math.round((income / team.target) * 100) : 0;
                return (
                  <div className="assigned-manager-card" key={team.id}>
                    <div className="assigned-manager-heading team-assigned-heading">
                      <div>
                        <b>{team.name}</b>
                        <p className="muted">{team.memberCount} {team.memberCount === 1 ? 'manager' : 'managers'}</p>
                      </div>
                      <div className="manager-collected">
                        <strong>{rupees(income)}</strong>
                        <span>{day === 'TODAY' ? 'collected today' : `of ${team.target > 0 ? rupees(team.target) : 'target not set'}`}</span>
                      </div>
                    </div>
                    {day === 'ALL' && team.target > 0 && (
                      <div className="manager-progress-row">
                        <div className="goal-progress-track" role="progressbar" aria-valuenow={Math.min(achieved, 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${team.name}: ${achieved}% of team target achieved`}>
                          <span className="goal-progress-fill" style={{ width: `${Math.min(achieved, 100)}%` }} />
                        </div>
                        <b>{achieved}%</b>
                      </div>
                    )}
                    <div className="manager-card-footer">
                      {day === 'ALL' && (
                        <span>Balance <b>{team.target > 0 ? rupees(Math.max(team.target - income, 0)) : '—'}</b></span>
                      )}
                      {teamActionsById.get(team.id)}
                    </div>
                  </div>
                );
              })}
              {sortedTeams.length === 0 && <p className="muted">No teams match this filter.</p>}
            </div>
          </>
        )}

        {tab === 'sectors' && (
          <div className="assigned-manager-list">
            {sortedSectors.map((sector) => (
              <div className="assigned-manager-card" key={sector.name}>
                <div className="assigned-manager-heading">
                  <div><b>{sector.name}</b><p className="muted text-nowrap">{day === 'TODAY' ? sector.todayManagerCount : sector.managerCount} contributors</p></div>
                  <div className="manager-collected"><strong>{rupees(incomeFor(sector))}</strong>                  <span>{day === 'TODAY' ? 'collected today' : 'collected'}</span></div>
                </div>
              </div>
            ))}
            {sortedSectors.length === 0 && <p className="muted">No sectors match this filter.</p>}
          </div>
        )}

        {tab === 'units' && (
          <div className="assigned-manager-list">
            {sortedUnits.map((unit) => (
                <div className="assigned-manager-card" key={`${unit.sector}:${unit.name}`}>
                  <div className="assigned-manager-heading">
                    <div><b>{unit.name}</b><p className="muted text-nowrap">{unit.sector} · {day === 'TODAY' ? unit.todayManagerCount : unit.managerCount} contributors</p></div>
                    <div className="manager-collected"><strong>{rupees(incomeFor(unit))}</strong><span>{day === 'TODAY' ? 'collected today' : 'collected'}</span></div>
                  </div>
                </div>
              ))}
            {sortedUnits.length === 0 && <p className="muted">No units match these filters.</p>}
          </div>
        )}
      </div>
      {filterPopup}
      {sharePopup}
    </section>
  );
}
