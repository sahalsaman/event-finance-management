import { activateEvent, assignManagers, completeEvent, createEvent, updateEvent } from '@/app/actions';
import { Frame } from '@/components/Frame';
import { Popup } from '@/components/Popup';
import { admin } from '@/lib/access';
import { db } from '@/lib/db';
import { Event } from '@/models/Event';
import { User } from '@/models/User';
import { Pencil } from 'lucide-react';

export default async function Page() {
  await admin();
  await db();
  const [events, managers] = await Promise.all([
    Event.find().sort({ createdAt: -1 }).lean(),
    User.find({ role: 'MANAGER', active: true }).sort({ name: 1 }).lean(),
  ]);
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
            <button className="button" style={{ width: '100%' }}>Create Event</button>
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
                    <button className="button" style={{ width: '100%' }}>Save Changes</button>
                  </form>
                </Popup>
                {event.status === 'UPCOMING' && (
                  <form action={activateEvent}>
                    <input type="hidden" name="id" value={eventId} />
                    <button className="button">Activate</button>
                  </form>
                )}
                {event.status === 'ACTIVE' && (
                  <form action={completeEvent}>
                    <input type="hidden" name="id" value={eventId} />
                    <button className="button secondary">Complete Event</button>
                  </form>
                )}
              </div>
              {event.status !== 'COMPLETED' && (
                <div className="manager-assign">
                  <p><b>Assigned managers</b></p>
                  <p className="muted">
                    {assignedManagers.length
                      ? assignedManagers.map((manager) => manager.name).join(', ')
                      : 'No managers assigned'}
                  </p>
                  <form action={assignManagers}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <fieldset className="manager-picker">
                      <legend>Add managers</legend>
                      {managers.length ? managers.map((manager) => (
                        <label className="manager-option" key={String(manager._id)}>
                          <input
                            type="checkbox"
                            name="managerIds"
                            value={String(manager._id)}
                            disabled={assignedIds.includes(String(manager._id))}
                          />
                          {manager.name}
                          {assignedIds.includes(String(manager._id)) && ' (assigned)'}
                        </label>
                      )) : <p className="muted">Create a manager first.</p>}
                    </fieldset>
                    <button className="button ghost" disabled={managers.length === assignedManagers.length}>
                      Add Selected Managers
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Frame>
  );
}
