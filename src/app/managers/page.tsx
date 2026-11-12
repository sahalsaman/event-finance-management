import { createManager, updateManager } from '@/app/actions';
import { Frame } from '@/components/Frame';
import { Popup } from '@/components/Popup';
import { admin, rupees } from '@/lib/access';
import { db } from '@/lib/db';
import { User } from '@/models/User';
import { Income } from '@/models/Income';
import { Expense } from '@/models/Expense';
import { Pencil } from 'lucide-react';
import { ManagerSharePopup } from '@/components/ManagerSharePopup';
import { SubmitButton } from '@/components/SubmitButton';
import { Types } from 'mongoose';
import { LiveSearchList } from '@/components/LiveSearchList';

export const instant = false;

function managerPresence(lastSeenAt: Date | null | undefined, active: boolean) {
  if (!lastSeenAt) return { label: 'Not logined', online: false };
  const lastSeen = new Date(lastSeenAt);
  if (active && Date.now() - lastSeen.getTime() <= 5 * 60 * 1000) {
    return { label: 'Online', online: true };
  }
  const dateOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  } as const;
  const formatter = new Intl.DateTimeFormat('en-CA', dateOptions);
  if (formatter.format(lastSeen) === formatter.format(new Date())) {
    return {
      label: `${new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
      }).format(lastSeen)}`,
      online: false,
    };
  }
  return {
    label: `${new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(lastSeen)}`,
    online: false,
  };
}

type ManagerSearchParams = { query?: string };

export default async function Page({ searchParams }: { searchParams: Promise<ManagerSearchParams> }) {
  const { query = '' } = await searchParams;
  const selectedQuery = query.trim().slice(0, 100);
  await admin();
  await db();
  const users = await User.find({ role: 'MANAGER' }).sort({ createdAt: -1 }).lean();
  const managerIds = users.map((manager) => new Types.ObjectId(String(manager._id)));
  const [incomeTotals, expenseTotals] = managerIds.length
    ? await Promise.all([
      Income.aggregate([
        { $match: { createdBy: { $in: managerIds } } },
        { $group: { _id: '$createdBy', total: { $sum: '$amountMinor' } } },
      ]),
      Expense.aggregate([
        { $match: { createdBy: { $in: managerIds }, status: { $in: ['APPROVED', 'PENDING'] } } },
        { $group: { _id: '$createdBy', total: { $sum: '$amountMinor' } } },
      ]),
    ])
    : [[], []];
  const incomeByManager = new Map(incomeTotals.map((result) => [String(result._id), Number(result.total)]));
  const expenseByManager = new Map(expenseTotals.map((result) => [String(result._id), Number(result.total)]));
  return (
    <Frame>
      <div className="sectionhead">
        <h1>Managers</h1>
        <Popup title="Add Manager" trigger="Invite Manager">
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
            <SubmitButton style={{ width: '100%' }} pendingText="Creating...">Create Manager</SubmitButton>
          </form>
        </Popup>
      </div>
      <LiveSearchList
        className="card"
        inputId="manager-search"
        label="Search managers"
        placeholder="Search managers"
        initialQuery={selectedQuery}
        emptyMessage="No managers yet."
        noResultsMessage="No managers match your search."
      >
        {users.map((manager) => (
          <div className="listrow manager-row" data-search={`${manager.name} ${manager.email}`} key={String(manager._id)}>
            <div className="w-full">
              <div className="flex justify-between items-center w-full"><b>{manager.name}</b>
                <div className="flex items-center gap-1">
                  {(() => {
                    const presence = managerPresence(manager.lastSeenAt, manager.active);
                    return (
                      <span className={`pill ${presence.online ? 'approved' : ''}`}>
                        {presence.label}
                      </span>
                    );
                  })()}
                  <span className={`pill ${manager.active ? 'approved' : ''}`}>
                    {manager.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="flex justify-between w-full">
                <div>
                  <p className="muted text-nowrap">{manager.email}</p>
                  <div className="manager-totals">
                    {/* <span className="muted">All events</span> */}
                    <span>+ <b>{rupees(incomeByManager.get(String(manager._id)) ?? 0)}</b></span>
                    <span>- <b>{rupees(expenseByManager.get(String(manager._id)) ?? 0)}</b></span>
                  </div>
                </div>
                <div className="manager-row-actions ">
                  <ManagerSharePopup
                    id={String(manager._id)}
                    name={manager.name}
                    email={manager.email}
                    active={manager.active}
                  />
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
                      <SubmitButton style={{ width: '100%' }} pendingText="Saving...">Save Changes</SubmitButton>
                    </form>
                  </Popup>
                </div>
              </div>

            </div>
          </div>
        ))}
      </LiveSearchList>
    </Frame>
  );
}
