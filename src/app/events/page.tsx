import { assignManagers, createEvent, recordManagerHandover, setManagerTarget, unassignManager, updateEvent } from '@/app/actions';
import { Frame } from '@/components/Frame';
import { Popup } from '@/components/Popup';
import { admin, rupees } from '@/lib/access';
import { db } from '@/lib/db';
import { Event } from '@/models/Event';
import { Expense } from '@/models/Expense';
import { Income } from '@/models/Income';
import { ManagerHandover } from '@/models/ManagerHandover';
import { User } from '@/models/User';
import { Pencil } from 'lucide-react';
import { SubmitButton } from '@/components/SubmitButton';
import { Types } from 'mongoose';

export default async function Page() {
  await admin();
  await db();
  const [events, managers] = await Promise.all([
    Event.find().sort({ createdAt: -1 }).lean(),
    User.find({ role: 'MANAGER' }).sort({ name: 1 }).lean(),
  ]);
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
  const [incomeTotals, expenseTotals] = eventIds.length && managerIds.length
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
      ])
    : [[], []];
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
  const eventIncomeById = new Map(
    eventIncomeTotals.map((entry) => [String(entry._id), Number(entry.total)]),
  );
  const toTotalsByEventManager = (totals: typeof incomeTotals) =>
    new Map(totals.map((entry) => [
      `${String(entry._id.eventId)}:${String(entry._id.managerId)}`,
      Number(entry.total),
    ]));
  const incomeByEventManager = toTotalsByEventManager(incomeTotals);
  const expenseByEventManager = toTotalsByEventManager(expenseTotals);
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
              const expense = expenseByEventManager.get(key) ?? 0;
              const handedOver = participant.isSuperAdmin ? 0 : handoverByEventManager.get(key) ?? 0;
              const managerTarget = Number(
                participant.isSuperAdmin
                  ? 0
                  : event.managerTargets?.find((target) => String(target.managerId) === managerId)?.targetMinor || 0,
              );
              return {
                ...participant,
                managerId,
                income,
                expense,
                handedOver,
                managerTarget,
                achieved: managerTarget > 0 ? Math.round((income / managerTarget) * 100) : 0,
                canUnassign: !participant.isSuperAdmin && income === 0 && expense === 0,
              };
            })
            .sort((a, b) => b.income - a.income || a.name.localeCompare(b.name));
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
              {(() => {
                const target = Number(event.targetMinor || 0);
                const collected = eventIncomeById.get(eventId) ?? 0;
                const achieved = target > 0 ? Math.round((collected / target) * 100) : 0;
                return (
                  <div className="event-goal">
                    <div className="event-goal-values">
                      <span>Collected <b>{rupees(collected)}</b></span>
                      <span>Target <b>{target > 0 ? rupees(target) : 'Not set'}</b></span>
                    </div>
                    {target > 0 && (
                      <>
                        <div className="goal-progress-track" role="progressbar" aria-valuenow={Math.min(achieved, 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${achieved}% of event target achieved`}>
                          <span className="goal-progress-fill" style={{ width: `${Math.min(achieved, 100)}%` }} />
                        </div>
                        <div className="event-goal-values muted">
                          <span>Balance {rupees(Math.max(target - collected, 0))}</span>
                          <b>{achieved}% achieved</b>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
              <div className="manager-assign">
                <div className="assigned-manager-title">
                  <p><b>Assigned managers</b></p>
                  {event.status !== 'COMPLETED' && (
                    <Popup
                      title={`Add managers to ${event.name}`}
                      trigger="＋ Add Manager"
                      triggerClassName="button ghost"
                    >
                      <form action={assignManagers}>
                        <input type="hidden" name="eventId" value={eventId} />
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
                  )}
                </div>
                {managerProgress.length ? (
                  <div className="assigned-manager-list">
                    {managerProgress.map(({ name, isSuperAdmin, managerId, income, expense, handedOver, managerTarget, achieved, canUnassign }, index) => (
                        <div className="assigned-manager-card" key={managerId}>
                          <div className="assigned-manager-heading">
                            <span className="manager-rank">{index + 1}</span>
                            <div>
                              <b>{name}</b>
                              {isSuperAdmin && <span className="super-admin-badge">Super Admin</span>}
                            </div>
                            <div className="manager-collected">
                              <strong>{rupees(income)}</strong>
                              <span>{isSuperAdmin ? 'collected' : `of ${managerTarget > 0 ? rupees(managerTarget) : 'target not set'}`}</span>
                            </div>
                          </div>
                          {managerTarget > 0 && (
                            <div className="manager-progress-row">
                              <div className="goal-progress-track" role="progressbar" aria-valuenow={Math.min(achieved, 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${name}: ${achieved}% of target achieved`}>
                                <span className="goal-progress-fill" style={{ width: `${Math.min(achieved, 100)}%` }} />
                              </div>
                              <b>{achieved}%</b>
                            </div>
                          )}
                          <div className="manager-card-footer">
                            <span>Balance <b>{managerTarget > 0 ? rupees(Math.max(managerTarget - income, 0)) : '—'}</b></span>
                            <span className="expense-total">Expenses {rupees(expense)}</span>
                            {!isSuperAdmin && (
                              <span className="handover-total">Paid to admin <b>{rupees(handedOver)}</b></span>
                            )}
                            {!isSuperAdmin && <Popup
                              title={`Set ${name}'s target`}
                              trigger={<Pencil size={15} aria-hidden="true" />}
                              triggerLabel={`Set ${name}'s event target`}
                              triggerClassName="button ghost icon-button"
                            >
                              <form action={setManagerTarget}>
                                <input type="hidden" name="eventId" value={eventId} />
                                <input type="hidden" name="managerId" value={managerId} />
                                <div className="field">
                                  <label>Target amount</label>
                                  <input
                                    name="target"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={managerTarget > 0 ? (managerTarget / 100).toFixed(2) : ''}
                                    placeholder="0.00"
                                    required
                                  />
                                </div>
                                <SubmitButton style={{ width: '100%' }} pendingText="Saving...">Save Target</SubmitButton>
                              </form>
                            </Popup>}
                            {!isSuperAdmin && income > handedOver && (
                              <Popup
                                title={`Record handover from ${name}`}
                                trigger="＋ Add paid amount"
                                triggerClassName="button ghost handover-button"
                              >
                                <form action={recordManagerHandover}>
                                  <input type="hidden" name="eventId" value={eventId} />
                                  <input type="hidden" name="managerId" value={managerId} />
                                  <div className="field">
                                    <label>Amount paid to admin</label>
                                    <input
                                      name="amount"
                                      type="number"
                                      min="0.01"
                                      max={((income - handedOver) / 100).toFixed(2)}
                                      step="0.01"
                                      required
                                      placeholder="0.00"
                                    />
                                    <small className="muted">Available to hand over: {rupees(income - handedOver)}</small>
                                  </div>
                                  <SubmitButton style={{ width: '100%' }} pendingText="Recording...">Record handover</SubmitButton>
                                </form>
                              </Popup>
                            )}
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
                          </div>
                        </div>
                    ))}
                  </div>
                ) : <p className="muted">No managers or Super Admin found</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}
