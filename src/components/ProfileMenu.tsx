'use client';

import { logout } from '@/app/actions';
import { SubmitButton } from '@/components/SubmitButton';

export function ProfileMenu({ name }: { name: string }) {
  const initials = name.trim().slice(0, 2).toLocaleUpperCase() || 'U';
  return (
    <details className="profile-menu">
      <summary className="profile-trigger" aria-label="Open profile menu" title="Profile">
        {initials}
      </summary>
      <div className="profile-dropdown">
        <b className="profile-name">{name}</b>
        <a
          className="profile-support"
          href="https://wa.me/918547929822"
          target="_blank"
          rel="noopener noreferrer"
        >
          Help &amp; Support
        </a>
        <form action={logout}>
          <SubmitButton className="button ghost profile-logout" pendingText="Logging out...">Logout</SubmitButton>
        </form>
      </div>
    </details>
  );
}
