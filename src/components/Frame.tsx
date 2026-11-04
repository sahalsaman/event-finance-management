import Image from 'next/image';
import { currentUser } from '@/lib/access';
import { Nav } from './Nav';
import { ProfileMenu } from './ProfileMenu';
import { RefreshButton } from './RefreshButton';

export async function Frame({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <main className="shell">
      <header className="top">
        <div className="brand">
          <Image className="brand-logo" src="/logo.png" width={750} height={1600} alt="" />
          <div>
            <h1 className="brand-name" style={{marginTop:"5px"}}><b>Mukkam Division</b></h1>
            <p className="muted" style={{'marginTop':"-5px"}}>Finance Management</p>
          </div>
        </div>
        <div className="top-actions">
          <RefreshButton />
          <ProfileMenu name={user.name} email={user.email} />
        </div>
      </header>
      <Nav admin={user.role === 'SUPER_ADMIN'} />
      <div className="content">{children}</div>
    </main>
  );
}
