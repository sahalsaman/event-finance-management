import Image from 'next/image';
import { currentUser, rupees } from '@/lib/access';
import { Nav } from './Nav';
import { ProfileMenu } from './ProfileMenu';
import { RefreshButton } from './RefreshButton';
import { NotificationBell } from './NotificationBell';
import { db } from '@/lib/db';
import { Event } from '@/models/Event';
import { Expense } from '@/models/Expense';

export async function Frame({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const isAdmin = user.role === 'SUPER_ADMIN';
  let notifications: { id: string; category: string; amount: string; managerName: string }[] = [];
  if (isAdmin) {
    await db();
    const event = await Event.findOne({ status: 'ACTIVE' }).select('_id').lean();
    if (event) {
      const pending = await Expense.find({ eventId: event._id, status: 'PENDING' })
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .lean();
      notifications = pending.map((expense) => ({
        id: String(expense._id),
        category: String(expense.category),
        amount: rupees(Number(expense.amountMinor)),
        managerName: typeof expense.createdBy === 'object' && expense.createdBy !== null && 'name' in expense.createdBy
          ? String(expense.createdBy.name)
          : 'Manager',
      }));
    }
  }

  return (
    <main className="shell">
      <header className="top">
        <div className="brand">
          <Image className="brand-logo" src="/logo.png" width={750} height={1600} alt="" />
          <div>
            <h1 className="brand-name" style={{marginTop:"5px",fontSize:"18px"}}><b>Mukkam Division</b></h1>
            <p className="muted" style={{'marginTop':"-5px"}}>Finance Management</p>
          </div>
        </div>
        <div className="top-actions">
          <RefreshButton />
          {isAdmin && <NotificationBell notifications={notifications} />}
          <ProfileMenu name={user.name} email={user.email} />
        </div>
      </header>
      <Nav admin={isAdmin} />
      <div className="content">{children}</div>
    </main>
  );
}
