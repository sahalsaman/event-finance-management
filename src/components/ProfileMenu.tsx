'use client';

import { logout } from '@/app/actions';
import { ChangePasswordPopup } from '@/components/ChangePasswordPopup';
import { SubmitButton } from '@/components/SubmitButton';

export function ProfileMenu({ name, email }: { name: string; email: string }) {
  const initials = name.trim().slice(0, 2).toLocaleUpperCase() || 'U';
  return (
    <details className="profile-menu">
      <summary className="profile-trigger" aria-label="Open profile menu" title="Profile">
        {initials}
      </summary>
      <div className="profile-dropdown">
        <div className="profile-info">
          <b className="profile-name">{name}</b>
          <span className="profile-email">{email}</span>
        </div>
        <hr style={{"color":"rgb(234 234 234)"}}/>
        <ChangePasswordPopup />
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
