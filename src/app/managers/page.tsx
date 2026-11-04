import { createManager, createTeam, deleteTeam, updateManager } from '@/app/actions';
import { Frame } from '@/components/Frame';
import { Popup } from '@/components/Popup';
import { admin, rupees } from '@/lib/access';
import { db } from '@/lib/db';
import { User } from '@/models/User';
import { Event } from '@/models/Event';
import { Team } from '@/models/Team';
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
  const [users, teams, events] = await Promise.all([
    User.find({ role: 'MANAGER' }).sort({ createdAt: -1 }).lean(),
    Team.find().sort({ name: 1 }).lean(),
    Event.find().select('managerIds managerTeams').lean(),
  ]);
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
        <Popup title="Manage Teams" trigger="Manage Teams" triggerClassName="button secondary">
          <div className="team-chips">
            {teams.length ? teams.map((team) => {
              const teamId = String(team._id);
              const assignedCount = events.reduce((count, event) => {
                const explicitAssignments = event.managerTeams ?? [];
                const explicitManagerIds = new Set(explicitAssignments.map((assignment) => String(assignment.managerId)));
                const explicitCount = explicitAssignments.filter((assignment) =>
                  String(assignment.teamId) === teamId,
                ).length;
                const legacyCount = users.filter((manager) =>
                  event.managerIds.some((id) => String(id) === String(manager._id)) &&
                  !explicitManagerIds.has(String(manager._id)) &&
                  manager.teamIds?.some((id) => String(id) === teamId),
                ).length;
                return count + explicitCount + legacyCount;
              }, 0);
              return (
                <div className="team-chip" key={teamId}>
                  <span>{team.name}</span>
                  {assignedCount > 0 && <small>{assignedCount} assigned</small>}
                  <form action={deleteTeam}>
                    <input type="hidden" name="teamId" value={teamId} />
                    <SubmitButton
                      className="team-chip-remove"
                      pendingText="..."
                      disabled={assignedCount > 0}
                      ariaLabel={assignedCount > 0
                        ? `Cannot remove ${team.name}; it has assigned managers`
                        : `Remove ${team.name}`}
                    >
                      ×
                    </SubmitButton>
                  </form>
                </div>
              );
            }) : <p className="muted">No teams added yet.</p>}
          </div>
          <p className="muted">Teams can be removed only when no event has managers assigned to them.</p>
          <form action={createTeam}>
            <div className="field">
              <label>New team names (one per line)</label>
              <textarea name="names" required maxLength={5000} rows={4} placeholder={'Team A\nTeam B\nTeam C'} />
            </div>
            <SubmitButton style={{ width: '100%' }} pendingText="Creating...">Create Teams</SubmitButton>
          </form>
        </Popup>
        <Popup title="Add Manager" trigger="＋ Manager">
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
