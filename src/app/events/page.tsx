import { assignManagers, createEvent, createTeam, recordManagerHandover, unassignManager, updateEvent, updateEventManagerAssignment, updateTeam } from '@/app/actions';
import { Frame } from '@/components/Frame';
import { Popup } from '@/components/Popup';
import { admin, rupees } from '@/lib/access';
import { db } from '@/lib/db';
import { Event } from '@/models/Event';
import { Expense } from '@/models/Expense';
import { Income } from '@/models/Income';
import { ManagerHandover } from '@/models/ManagerHandover';
import { User } from '@/models/User';
import { Team } from '@/models/Team';
import { Pencil } from 'lucide-react';
import { EventAssignedTabs } from '@/components/EventAssignedTabs';
import { SubmitButton } from '@/components/SubmitButton';
import { Types } from 'mongoose';
import { SECTORS, UNITS_BY_SECTOR } from '@/lib/sectors';

function getTodayRange(now = new Date()) {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => dateParts.find((entry) => entry.type === type)?.value ?? '';
  const todayKey = `${part('year')}-${part('month')}-${part('day')}`;
  const todayUtc = Date.parse(`${todayKey}T00:00:00Z`);
  const endKey = new Date(todayUtc + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    start: new Date(`${todayKey}T00:00:00+05:30`),
    end: new Date(`${endKey}T00:00:00+05:30`),
  };
}

export default async function Page() {
  await admin();
  await db();
  const todayRange = getTodayRange();
  const [events, managers, teams] = await Promise.all([
    Event.find().sort({ createdAt: -1 }).lean(),
    User.find({ role: 'MANAGER' }).sort({ name: 1 }).lean(),
    Team.find().sort({ name: 1 }).lean(),
  ]);
  const managersById = new Map(managers.map((manager) => [String(manager._id), manager]));
  const superAdminIds = [...new Set(events.map((event) => String(event.createdBy)))];
  const superAdmins = superAdminIds.length
    ? await User.find({
        _id: { $in: superAdminIds.map((id) => new Types.ObjectId(id)) },
        role: 'SUPER_ADMIN',
      }).lean()
    : [];
  const eventIds = events.map((event) => new Types.ObjectId(String(event._id)));
  const assignedManagerIds = [...new Set(events.flatMap((event) => event.managerIds.map(String)))];
  const participantIds = [...new Set([...assignedManagerIds, ...superAdminIds])];
  const managerIds = participantIds.map((id) => new Types.ObjectId(id));
  const [incomeTotals, expenseTotals, todayIncomeTotals, todayExpenseTotals] = eventIds.length && managerIds.length
    ? await Promise.all([
        Income.aggregate([
          { $match: { eventId: { $in: eventIds }, createdBy: { $in: managerIds } } },
          {
            $group: {
              _id: { eventId: '$eventId', managerId: '$createdBy' },
              total: { $sum: '$amountMinor' },
            },
          },
        ]),
        Expense.aggregate([
          {
            $match: {
              eventId: { $in: eventIds },
              createdBy: { $in: managerIds },
              status: { $in: ['APPROVED', 'PENDING'] },
            },
          },
          {
            $group: {
              _id: { eventId: '$eventId', managerId: '$createdBy' },
              total: { $sum: '$amountMinor' },
            },
          },
        ]),
        Income.aggregate([
          {
            $match: {
              eventId: { $in: eventIds },
              createdBy: { $in: managerIds },
              createdAt: { $gte: todayRange.start, $lt: todayRange.end },
            },
          },
          {
            $group: {
              _id: { eventId: '$eventId', managerId: '$createdBy' },
              total: { $sum: '$amountMinor' },
            },
          },
        ]),
        Expense.aggregate([
          {
            $match: {
              eventId: { $in: eventIds },
              createdBy: { $in: managerIds },
              status: { $in: ['APPROVED', 'PENDING'] },
              createdAt: { $gte: todayRange.start, $lt: todayRange.end },
            },
          },
          {
            $group: {
              _id: { eventId: '$eventId', managerId: '$createdBy' },
              total: { $sum: '$amountMinor' },
            },
          },
        ]),
      ])
    : [[], [], [], []];
  const handoverTotals = eventIds.length && assignedManagerIds.length
    ? await ManagerHandover.aggregate([
        {
          $match: {
            eventId: { $in: eventIds },
            managerId: { $in: assignedManagerIds.map((id) => new Types.ObjectId(id)) },
          },
        },
        {
          $group: {
            _id: { eventId: '$eventId', managerId: '$managerId' },
            total: { $sum: '$totalMinor' },
          },
        },
      ])
    : [];
  const handoverByEventManager = new Map(
    handoverTotals.map((entry) => [
      `${String(entry._id.eventId)}:${String(entry._id.managerId)}`,
      Number(entry.total),
    ]),
  );
  const eventIncomeTotals = eventIds.length
    ? await Income.aggregate([
        { $match: { eventId: { $in: eventIds } } },
        { $group: { _id: '$eventId', total: { $sum: '$amountMinor' } } },
      ])
    : [];
  const incomeLocationTotals = eventIds.length
    ? await Income.aggregate([
        { $match: { eventId: { $in: eventIds } } },
        {
          $group: {
            _id: {
              eventId: '$eventId',
              sector: '$sector',
              unit: '$unit',
              managerId: '$createdBy',
            },
            total: { $sum: '$amountMinor' },
          },
        },
      ])
    : [];
  const todayIncomeLocationTotals = eventIds.length
    ? await Income.aggregate([
        {
          $match: {
            eventId: { $in: eventIds },
            createdAt: { $gte: todayRange.start, $lt: todayRange.end },
          },
        },
        {
          $group: {
            _id: {
              eventId: '$eventId',
              sector: '$sector',
              unit: '$unit',
              managerId: '$createdBy',
            },
            total: { $sum: '$amountMinor' },
          },
        },
      ])
    : [];
  const eventIncomeById = new Map(
    eventIncomeTotals.map((entry) => [String(entry._id), Number(entry.total)]),
  );
  const eventTodayIncomeById = new Map<string, number>();
  for (const entry of todayIncomeTotals) {
    const eventId = String(entry._id.eventId);
    eventTodayIncomeById.set(eventId, (eventTodayIncomeById.get(eventId) ?? 0) + Number(entry.total));
  }
  const incomeLocationsByEvent = new Map<string, {
    sectors: Array<{ name: string; income: number; todayIncome: number; managerCount: number; todayManagerCount: number }>;
    units: Array<{ name: string; sector: string; income: number; todayIncome: number; managerCount: number; todayManagerCount: number }>;
  }>();
  const locationTotalsByEvent = new Map<string, {
    sectors: Map<string, { income: number; todayIncome: number; managerIds: Set<string>; todayManagerIds: Set<string> }>;
    units: Map<string, { name: string; sector: string; income: number; todayIncome: number; managerIds: Set<string>; todayManagerIds: Set<string> }>;
  }>();
  const managerSectorsByEvent = new Map<string, Map<string, Set<string>>>();
  const addLocationTotals = (entries: typeof incomeLocationTotals, todayOnly: boolean) => {
    for (const entry of entries) {
      const eventId = String(entry._id.eventId);
      const sector = entry._id.sector;
      const unit = entry._id.unit;
      if (typeof sector !== 'string' || !sector || typeof unit !== 'string' || !unit) continue;
      const managerId = String(entry._id.managerId);
      const totals = locationTotalsByEvent.get(eventId) ?? {
        sectors: new Map(),
        units: new Map(),
      };
      const sectorTotal = totals.sectors.get(sector) ?? {
        income: 0,
        todayIncome: 0,
        managerIds: new Set<string>(),
        todayManagerIds: new Set<string>(),
      };
      if (todayOnly) {
        sectorTotal.todayIncome += Number(entry.total);
        sectorTotal.todayManagerIds.add(managerId);
      } else {
        const managerSectors = managerSectorsByEvent.get(eventId) ?? new Map<string, Set<string>>();
        const managerSectorSet = managerSectors.get(managerId) ?? new Set<string>();
        managerSectorSet.add(sector);
        managerSectors.set(managerId, managerSectorSet);
        managerSectorsByEvent.set(eventId, managerSectors);
        sectorTotal.income += Number(entry.total);
        sectorTotal.managerIds.add(managerId);
      }
      totals.sectors.set(sector, sectorTotal);
      const unitKey = `${sector}:${unit}`;
      const unitTotal = totals.units.get(unitKey) ?? {
        name: unit,
        sector,
        income: 0,
        todayIncome: 0,
        managerIds: new Set<string>(),
        todayManagerIds: new Set<string>(),
      };
      if (todayOnly) {
        unitTotal.todayIncome += Number(entry.total);
        unitTotal.todayManagerIds.add(managerId);
      } else {
        unitTotal.income += Number(entry.total);
        unitTotal.managerIds.add(managerId);
      }
      totals.units.set(unitKey, unitTotal);
      locationTotalsByEvent.set(eventId, totals);
    }
  };
  addLocationTotals(incomeLocationTotals, false);
  addLocationTotals(todayIncomeLocationTotals, true);
  for (const [eventId, totals] of locationTotalsByEvent) {
    incomeLocationsByEvent.set(eventId, {
      sectors: [...totals.sectors].map(([name, value]) => ({
        name,
        income: value.income,
        todayIncome: value.todayIncome,
        managerCount: value.managerIds.size,
        todayManagerCount: value.todayManagerIds.size,
      })).sort((a, b) => a.name.localeCompare(b.name)),
      units: [...totals.units.values()].map((value) => ({
        name: value.name,
        sector: value.sector,
        income: value.income,
        todayIncome: value.todayIncome,
        managerCount: value.managerIds.size,
        todayManagerCount: value.todayManagerIds.size,
      })).sort((a, b) => a.sector.localeCompare(b.sector) || a.name.localeCompare(b.name)),
    });
  }
  const toTotalsByEventManager = (totals: typeof incomeTotals) =>
    new Map(totals.map((entry) => [
      `${String(entry._id.eventId)}:${String(entry._id.managerId)}`,
      Number(entry.total),
    ]));
  const incomeByEventManager = toTotalsByEventManager(incomeTotals);
  const expenseByEventManager = toTotalsByEventManager(expenseTotals);
  const todayIncomeByEventManager = toTotalsByEventManager(todayIncomeTotals);
  const todayExpenseByEventManager = toTotalsByEventManager(todayExpenseTotals);
  return (
    <Frame>
      <div className="sectionhead">
        <h1>Manage Events</h1>
        <Popup title="Create Event" trigger="＋ Create Event">
          <form action={createEvent}>
            <div className="field">
              <label>Event name</label>
              <input name="name" required maxLength={120} />
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" name="date" required />
            </div>
            <div className="field">
              <label>Location (optional)</label>
              <input name="location" maxLength={250} />
            </div>
            <div className="field">
              <label>Event target (optional)</label>
              <input name="target" type="number" min="0" step="0.01" placeholder="0.00" />
            </div>
            <div className="field">
              <label>Event status</label>
              <select name="status" defaultValue="UPCOMING" required>
                <option value="UPCOMING">Upcoming</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <SubmitButton style={{ width: '100%' }} pendingText="Creating...">Create Event</SubmitButton>
          </form>
        </Popup>
      </div>
      <div className="stack">
        {events.length === 0 && <div className="card">No events yet.</div>}
        {events.map((event) => {
          const eventId = String(event._id);
          const assignedIds = event.managerIds.map(String);
          const eventTeamByManager = new Map(
            (event.managerTeams ?? []).map((assignment) => [
              String(assignment.managerId),
              String(assignment.teamId ?? ''),
            ]),
          );
          const assignedManagers = managers.filter((manager) => assignedIds.includes(String(manager._id)));
          const eventSuperAdmin = superAdmins.find((user) => String(user._id) === String(event.createdBy));
          const participants = [
            ...assignedManagers.map((manager) => ({
              id: String(manager._id),
              name: manager.name,
              isSuperAdmin: false,
            })),
            ...(eventSuperAdmin
              ? [{
                  id: String(eventSuperAdmin._id),
                  name: eventSuperAdmin.name,
                  isSuperAdmin: true,
                }]
              : []),
          ];
          const managerProgress = participants
            .map((participant) => {
              const managerId = participant.id;
              const key = `${eventId}:${managerId}`;
              const income = incomeByEventManager.get(key) ?? 0;
              const todayIncome = todayIncomeByEventManager.get(key) ?? 0;
              const expense = expenseByEventManager.get(key) ?? 0;
              const todayExpense = todayExpenseByEventManager.get(key) ?? 0;
              const handedOver = participant.isSuperAdmin ? 0 : handoverByEventManager.get(key) ?? 0;
              const managerTarget = Number(
                participant.isSuperAdmin
                  ? 0
                  : event.managerTargets?.find((target) => String(target.managerId) === managerId)?.targetMinor || 0,
              );
              const assignedManager = assignedManagers.find(
                (manager) => String(manager._id) === managerId,
              );
              return {
                ...participant,
                managerId,
                teamId: eventTeamByManager.has(managerId)
                  ? eventTeamByManager.get(managerId) ?? ''
                  : String(assignedManager?.teamIds?.[0] ?? ''),
                income,
                todayIncome,
                expense,
                todayExpense,
                handedOver,
                managerTarget,
                achieved: managerTarget > 0 ? Math.round((income / managerTarget) * 100) : 0,
                canUnassign: !participant.isSuperAdmin && income === 0 && expense === 0,
              };
            })
            .sort((a, b) => b.income - a.income || a.name.localeCompare(b.name));
          const teamProgress = teams.flatMap((team) => {
            const teamId = String(team._id);
            const members = assignedManagers.filter((manager) =>
              eventTeamByManager.has(String(manager._id))
                ? eventTeamByManager.get(String(manager._id)) === teamId
                : manager.teamIds?.some((id) => String(id) === teamId),
            );
            const income = members.reduce(
              (total, manager) => total + (incomeByEventManager.get(`${eventId}:${String(manager._id)}`) ?? 0),
              0,
            );
            const todayIncome = members.reduce(
              (total, manager) => total + (todayIncomeByEventManager.get(`${eventId}:${String(manager._id)}`) ?? 0),
              0,
            );
            const teamTarget = Number(
              event.teamTargets?.find((target) => String(target.teamId) === teamId)?.targetMinor ?? 0,
            );
            return [{
              id: teamId,
              name: String(team.name),
              income,
              todayIncome,
              target: teamTarget,
              achieved: teamTarget > 0 ? Math.round((income / teamTarget) * 100) : 0,
              memberCount: members.length,
            }];
          });
          const managerRows = managerProgress.map((manager) => {
            const assignedManager = assignedManagers.find(
              (candidate) => String(candidate._id) === manager.managerId,
            );
            return {
              id: manager.managerId,
              name: manager.name,
              sectors: [...(managerSectorsByEvent.get(eventId)?.get(manager.managerId) ?? [])],
              teamId: eventTeamByManager.has(manager.managerId)
                ? eventTeamByManager.get(manager.managerId) ?? ''
                : assignedManager?.teamIds?.length ? String(assignedManager.teamIds[0]) : '',
              teamName: teams.find((team) =>
                String(team._id) === (eventTeamByManager.get(manager.managerId) ??
                  (assignedManager?.teamIds?.length ? String(assignedManager.teamIds[0]) : '')),
              )?.name ?? '',
              income: manager.income,
              todayIncome: manager.todayIncome,
              target: manager.managerTarget,
              expense: manager.expense,
              todayExpense: manager.todayExpense,
              handedOver: manager.handedOver,
              isSuperAdmin: manager.isSuperAdmin,
            };
          });
          const teamRows = teamProgress.map(({ id, name, income, todayIncome, target: teamTarget, memberCount }) => ({
            id,
            name,
            income,
            todayIncome,
            target: teamTarget,
            memberCount,
          }));
          const locationRows = incomeLocationsByEvent.get(eventId) ?? { sectors: [], units: [] };
          const observedSectors = new Map(locationRows.sectors.map((sector) => [sector.name, sector]));
          const sectorRows = [...new Set([...SECTORS, ...observedSectors.keys()])]
            .sort((a, b) => a.localeCompare(b))
            .map((name) => observedSectors.get(name) ?? {
              name,
              income: 0,
              todayIncome: 0,
              managerCount: 0,
              todayManagerCount: 0,
            });
          const allUnits = new Map<string, {
            name: string;
            sector: string;
            income: number;
            todayIncome: number;
            managerCount: number;
            todayManagerCount: number;
          }>();
          for (const [sector, unitNames] of Object.entries(UNITS_BY_SECTOR)) {
            for (const name of unitNames) {
              allUnits.set(`${sector}:${name}`, {
                name,
                sector,
                income: 0,
                todayIncome: 0,
                managerCount: 0,
                todayManagerCount: 0,
              });
            }
          }
          for (const unit of locationRows.units) allUnits.set(`${unit.sector}:${unit.name}`, unit);
          const unitRows = [...allUnits.values()].sort(
            (a, b) => a.sector.localeCompare(b.sector) || a.name.localeCompare(b.name),
          );
          const managerActions = managerProgress.map(({
            name,
            isSuperAdmin,
            managerId,
            teamId,
            income,
            handedOver,
            managerTarget,
            canUnassign,
          }) => ({
            id: managerId,
            content: (
              <>
                  {!isSuperAdmin && event.status !== 'COMPLETED' && <Popup
                    title={`Edit ${name}'s event assignment`}
                    trigger={<Pencil size={15} aria-hidden="true" />}
                    triggerLabel={`Edit ${name}'s event team and target`}
                    triggerClassName="button ghost icon-button"
                  >
                    <form action={updateEventManagerAssignment}>
                      <input type="hidden" name="eventId" value={eventId} />
                      <input type="hidden" name="managerId" value={managerId} />
                      <div className="field">
                        <label htmlFor={`edit-manager-team-${eventId}-${managerId}`}>Select team</label>
                        <select
                          id={`edit-manager-team-${eventId}-${managerId}`}
                          name="teamId"
                          defaultValue={teamId}
                        >
                          <option value="">No team</option>
                          {teams.map((team) => (
                            <option key={String(team._id)} value={String(team._id)}>{team.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Manager target</label>
                        <input
                          name="managerTarget"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={managerTarget > 0 ? (managerTarget / 100).toFixed(2) : ''}
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <SubmitButton style={{ width: '100%' }} pendingText="Saving...">Save Assignment</SubmitButton>
                    </form>
                  </Popup>}
             
                  {canUnassign && (
                    <form action={unassignManager}>
                      <input type="hidden" name="eventId" value={eventId} />
                      <input type="hidden" name="managerId" value={managerId} />
                      <SubmitButton
                        className="button ghost unassign-icon"
                        pendingText="Removing..."
                        ariaLabel={`Unassign ${name}`}
                      >
                        −
                      </SubmitButton>
                    </form>
                  )}
              </>
            ),
          }));
          const teamActions = teamProgress.map(({
            id,
            name,
            target: teamTarget,
          }) => ({
            id,
            content: (
              <>
                {event.status !== 'COMPLETED' && (
                    <Popup
                      title={`Edit ${name}`}
                      trigger={<Pencil size={15} aria-hidden="true" />}
                      triggerLabel={`Edit ${name}`}
                      triggerClassName="button ghost icon-button"
                    >
                      <form action={updateTeam}>
                        <input type="hidden" name="teamId" value={id} />
                        <input type="hidden" name="teamTargetEventId" value={eventId} />
                        <div className="field">
                          <label htmlFor={`team-name-${eventId}-${id}`}>Team name</label>
                          <input
                            id={`team-name-${eventId}-${id}`}
                            name="name"
                            required
                            maxLength={80}
                            defaultValue={name}
                          />
                        </div>
                        <div className="field">
                          <label>Target amount</label>
                          <input
                            name="teamTarget"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={teamTarget > 0 ? (teamTarget / 100).toFixed(2) : ''}
                            placeholder="Leave blank to keep unchanged; enter 0 to clear"
                          />
                        </div>
                        <SubmitButton style={{ width: '100%' }} pendingText="Saving...">Save Team</SubmitButton>
                      </form>
                    </Popup>
                  )}
              </>
            ),
          }));
          return (
            <div className="card" key={eventId}>
              <div className="event-card-heading">
                <div>
                  <h2>{event.name}</h2>
                  <p className="muted">
                    {new Date(event.eventDate).toLocaleDateString('en-IN')} · {event.location || 'No location'}
                  </p>
                </div>
                <div className="event-card-controls">
                  <span className="pill">{event.status}</span>
                  <div className="event-card-actions">
                    <div id={`event-filter-${eventId}`} />
                    <div id={`event-share-${eventId}`} />
                    <Popup title="Edit Event" trigger={<Pencil size={17} aria-hidden="true" />} triggerLabel="Edit event" triggerClassName="button ghost icon-button">
                    <form action={updateEvent}>
                      <input type="hidden" name="id" value={eventId} />
                      <div className="field">
                        <label>Event name</label>
                        <input name="name" required maxLength={120} defaultValue={event.name} />
                      </div>
                      <div className="field">
                        <label>Date</label>
                        <input
                          type="date"
                          name="date"
                          required
                          defaultValue={new Date(event.eventDate).toISOString().slice(0, 10)}
                        />
                      </div>
                      <div className="field">
                        <label>Location (optional)</label>
                        <input name="location" maxLength={250} defaultValue={event.location} />
                      </div>
                      <div className="field">
                        <label>Event target (optional)</label>
                        <input
                          name="target"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={Number(event.targetMinor || 0) > 0 ? (Number(event.targetMinor) / 100).toFixed(2) : ''}
                        />
                      </div>
                      <div className="field">
                        <label>Event status</label>
                        <select name="status" defaultValue={event.status} required>
                          <option value="UPCOMING">Upcoming</option>
                          <option value="ACTIVE">Active</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </div>
                      <SubmitButton style={{ width: '100%' }} pendingText="Saving...">Save Changes</SubmitButton>
                    </form>
                    </Popup>
                  </div>
                </div>
              </div>
              <EventAssignedTabs
                eventName={String(event.name)}
                eventDateLabel={new Intl.DateTimeFormat('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                  timeZone: 'Asia/Kolkata',
                }).format(new Date(event.eventDate))}
                eventTarget={Number(event.targetMinor || 0)}
                eventCollected={eventIncomeById.get(eventId) ?? 0}
                eventTodayCollected={eventTodayIncomeById.get(eventId) ?? 0}
                shareTargetId={`event-share-${eventId}`}
                filterTargetId={`event-filter-${eventId}`}
                managers={managerRows}
                managerActions={managerActions}
                teams={teamRows}
                teamActions={teamActions}
                teamHeaderAction={event.status !== 'COMPLETED' ? (
                  <Popup
                    title={`Add team to ${event.name}`}
                    trigger="＋ Add Team"
                    triggerClassName="button secondary"
                  >
                    <form action={createTeam}>
                      <input type="hidden" name="teamTargetEventId" value={eventId} />
                      <div className="field">
                        <label htmlFor={`new-team-name-${eventId}`}>Team name</label>
                        <input
                          id={`new-team-name-${eventId}`}
                          name="names"
                          required
                          maxLength={80}
                          placeholder="Team name"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`new-team-target-${eventId}`}>Team target (optional)</label>
                        <input
                          id={`new-team-target-${eventId}`}
                          name="teamTarget"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </div>
                      <SubmitButton style={{ width: '100%' }} pendingText="Creating...">Add Team</SubmitButton>
                    </form>
                  </Popup>
                ) : null}
                sectors={sectorRows}
                units={unitRows}
                headerAction={event.status !== 'COMPLETED' ? (
                  <Popup
                    title={`Assign managers to ${event.name}`}
                    trigger="Assign Manager"
                    triggerClassName="button ghost"
                  >
                    <form action={assignManagers}>
                      <input type="hidden" name="eventId" value={eventId} />
                      <div className="field">
                        <label htmlFor={`assign-team-${eventId}`}>Select team (optional)</label>
                        <select id={`assign-team-${eventId}`} name="teamId" defaultValue="">
                          <option value="">No team</option>
                          {teams.map((team) => (
                            <option key={String(team._id)} value={String(team._id)}>{team.name}</option>
                          ))}
                        </select>
                        <small className="muted">All selected managers will be assigned to this team for this event.</small>
                      </div>
                      <div className="field">
                        <label htmlFor={`assign-manager-target-${eventId}`}>Manager target (optional)</label>
                        <input
                          id={`assign-manager-target-${eventId}`}
                          name="managerTarget"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                        />
                        <small className="muted">This target will be set for each selected manager.</small>
                      </div>
                      <fieldset className="manager-picker">
                        <legend>Select managers</legend>
                        {managers.filter((manager) => manager.active && !assignedIds.includes(String(manager._id))).length ? (
                          managers
                            .filter((manager) => manager.active && !assignedIds.includes(String(manager._id)))
                            .map((manager) => (
                              <label className="manager-option" key={String(manager._id)}>
                                <input type="checkbox" name="managerIds" value={String(manager._id)} />
                                {manager.name}
                              </label>
                            ))
                        ) : <p className="muted">No new active managers available.</p>}
                      </fieldset>
                      <SubmitButton
                        className="button"
                        style={{ width: '100%' }}
                        pendingText="Assigning..."
                        disabled={!managers.some((manager) => manager.active && !assignedIds.includes(String(manager._id)))}
                      >
                        Add Selected Managers
                      </SubmitButton>
                    </form>
                  </Popup>
                ) : undefined}
              />
            </div>
          );
        })}
      </div>
    </Frame>
  );
}
