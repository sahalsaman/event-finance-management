import { Suspense } from 'react';
import { connection } from 'next/server';
import { auth } from '@/auth';
import { Nav } from '@/components/Nav';

async function LoadingNav() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) return null;
  return <Nav admin={session.user.role === 'SUPER_ADMIN'} />;
}

export default function Loading() {
  return (
    <main className="shell" aria-busy="true" aria-label="Loading page">
      <div className="top loading-header">
        <div className="loading-brand">
          <span className="loading-skeleton loading-brand-mark" />
          <span className="loading-skeleton loading-brand-name" />
          <span className="loading-skeleton loading-greeting" />
        </div>
        <span className="loading-skeleton loading-profile" />
      </div>
      <div className="loading-content">
        <span className="loading-skeleton loading-title" />
        <section className="loading-skeleton loading-card loading-hero">
          <span className="loading-skeleton loading-line short" />
          <span className="loading-skeleton loading-line medium" />
          <span className="loading-skeleton loading-amount" />
          <div className="loading-grid">
            <span className="loading-skeleton loading-line" />
            <span className="loading-skeleton loading-line" />
          </div>
        </section>
        <div className="loading-grid">
          <span className="loading-skeleton loading-action" />
          <span className="loading-skeleton loading-action" />
        </div>
        <section className="loading-skeleton loading-card loading-activity">
          <span className="loading-skeleton loading-line medium" />
          <span className="loading-skeleton loading-line" />
          <span className="loading-skeleton loading-line" />
          <span className="loading-skeleton loading-line short" />
        </section>
      </div>
      <Suspense fallback={null}>
        <LoadingNav />
      </Suspense>
    </main>
  );
}
