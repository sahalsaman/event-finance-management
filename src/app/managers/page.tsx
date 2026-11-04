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
import { SECTORS } from '@/lib/sectors';

export const instant = false;

export default async function Page() {
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
            <div className="field">
              <label htmlFor="new-manager-sector">Select sector</label>
              <select id="new-manager-sector" name="sector" required defaultValue="">
                <option value="" disabled>Select a sector</option>
                {SECTORS.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
              </select>
            </div>
            <SubmitButton style={{ width: '100%' }} pendingText="Creating...">Create Manager</SubmitButton>
          </form>
        </Popup>
      </div>
      <div className="card">
        {users.length === 0 && <p className="muted">No managers yet.</p>}
        {users.map((manager) => (
          <div className="listrow manager-row" key={String(manager._id)}>
            <div className="w-full">
              <div className="flex justify-between items-center w-full"><b>{manager.name}</b>
                <span className={`pill ${manager.active ? 'approved' : ''}`}>
                  {manager.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between w-full">
                <div>
                  <p className="muted text-nowrap">{manager.email}</p>
                  <p className="muted">{manager.sector || 'No sector assigned'}</p>
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
                        <label htmlFor={`manager-sector-${manager._id}`}>Select sector</label>
                        <select id={`manager-sector-${manager._id}`} name="sector" required defaultValue={manager.sector || ''}>
                          <option value="" disabled>Select a sector</option>
                          {SECTORS.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
                        </select>
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
      </div>
    </Frame>
  );
}
