import { createManager, updateManager } from '@/app/actions';
import { Frame } from '@/components/Frame';
import { Popup } from '@/components/Popup';
import { admin } from '@/lib/access';
import { db } from '@/lib/db';
import { User } from '@/models/User';
import { Pencil } from 'lucide-react';

export default async function Page() {
  await admin();
  await db();
  const users = await User.find({ role: 'MANAGER' }).sort({ createdAt: -1 }).lean();
  return (
    <Frame>
      <div className="sectionhead">
        <h1>Managers</h1>
        <Popup title="Add Manager" trigger="＋ Add Manager">
          <form action={createManager}>
            <div className="field">
              <label>Full name</label>
              <input name="name" required maxLength={120} />
            </div>
            <div className="field">
              <label>Email</label>
              <input name="email" type="email" required maxLength={254} />
            </div>
            <div className="field">
              <label>Password (at least 6 characters)</label>
              <input name="password" type="password" minLength={6} required autoComplete="new-password" />
            </div>
            <button className="button" style={{ width: '100%' }}>Create Manager</button>
          </form>
        </Popup>
      </div>
      <div className="card">
        <h2>Manager accounts</h2>
        {users.length === 0 && <p className="muted">No managers yet.</p>}
        {users.map((manager) => (
          <div className="listrow manager-row" key={String(manager._id)}>
            <div>
              <b>{manager.name}</b>
              <p className="muted">{manager.email}</p>
            </div>
            <div className="manager-row-actions">
              <span className={`pill ${manager.active ? 'approved' : ''}`}>
                {manager.active ? 'Active' : 'Inactive'}
              </span>
              <Popup title="Edit Manager" trigger={<Pencil size={17} aria-hidden="true" />} triggerLabel={`Edit ${manager.name}`} triggerClassName="button ghost icon-button">
                <form action={updateManager}>
                  <input type="hidden" name="id" value={String(manager._id)} />
                  <div className="field">
                    <label>Full name</label>
                    <input name="name" required maxLength={120} defaultValue={manager.name} />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input name="email" type="email" required maxLength={254} defaultValue={manager.email} />
                  </div>
                  <div className="field">
                    <label>Account status</label>
                    <select name="active" required defaultValue={manager.active ? 'true' : 'false'}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>New password (optional, at least 6 characters)</label>
                    <input name="password" type="password" minLength={6} autoComplete="new-password" />
                  </div>
                  <button className="button" style={{ width: '100%' }}>Save Changes</button>
                </form>
              </Popup>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}
