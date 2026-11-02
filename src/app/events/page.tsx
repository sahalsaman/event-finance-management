import { assignManagers, createEvent, unassignManager, updateEvent } from '@/app/actions';
import { Frame } from '@/components/Frame';
import { Popup } from '@/components/Popup';
import { admin, rupees } from '@/lib/access';
import { db } from '@/lib/db';
import { Event } from '@/models/Event';
import { Expense } from '@/models/Expense';
import { Income } from '@/models/Income';
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
  const eventIds = events.map((event) => new Types.ObjectId(String(event._id)));
  const assignedManagerIds = [...new Set(events.flatMap((event) => event.managerIds.map(String)))];
  const managerIds = assignedManagerIds.map((id) => new Types.ObjectId(id));
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
          return (
            <div className="card" key={eventId}>
              <div className="sectionhead">
                <h2>{event.name}</h2>
                <span className="pill">{event.status}</span>
              </div>
              <p className="muted">
                {new Date(event.eventDate).toLocaleDateString('en-IN')} · {event.location || 'No location'}
              </p>
              <div className="event-actions">
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
              <div className="manager-assign">
                <p><b>Assigned managers</b></p>
                {assignedManagers.length ? (
                  <div className="assigned-manager-list">
                    {assignedManagers.map((manager) => {
                      const managerId = String(manager._id);
                      const key = `${eventId}:${managerId}`;
                      const income = incomeByEventManager.get(key) ?? 0;
                      const expense = expenseByEventManager.get(key) ?? 0;
                      const canUnassign = income === 0 && expense === 0;
                      return (
                        <div className="assigned-manager-row" key={managerId}>
                          <div>
                            <b>{manager.name}</b>
                            <div className="manager-finance">
                              <span className="income-total" aria-label={`Income ${rupees(income)}`}>+{rupees(income)}</span>
                              <span className="expense-total" aria-label={`Expenses ${rupees(expense)}`}>−{rupees(expense)}</span>
                            </div>
                          </div>
                          {canUnassign && (
                            <form action={unassignManager}>
                              <input type="hidden" name="eventId" value={eventId} />
                              <input type="hidden" name="managerId" value={managerId} />
                              <SubmitButton
                                className="button ghost"
                                pendingText="Removing..."
                              >
                                − Unassign
                              </SubmitButton>
                            </form>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="muted">No managers assigned</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}
