'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { resetManagerPasswordForSharing } from '@/app/actions';
import { Popup } from '@/components/Popup';
import { ShareMessage } from '@/components/ShareMessage';

export function ManagerSharePopup({
  id,
  name,
  email,
  active,
}: {
  id: string;
  name: string;
  email: string;
  active: boolean;
}) {
  const [password, setPassword] = useState('');
  const [loginUrl, setLoginUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function generatePassword() {
    setPending(true);
    setError('');
    setPassword('');
    try {
      const newPassword = await resetManagerPasswordForSharing(id);
      setPassword(newPassword);
      setLoginUrl(`${window.location.origin}/login`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not generate a new password.');
    } finally {
      setPending(false);
    }
  }

  const message = password
    ? [
        `Event Finance manager access`,
        `Name: ${name}`,
        `Email: ${email}`,
        `Password: ${password}`,
        `Login: ${loginUrl}`,
        '',
        'Please keep these login details private.',
      ].join('\n')
    : [
        `Event Finance manager access`,
        `Name: ${name}`,
        `Email: ${email}`,
        'Password: Generate a new password before sharing.',
        'Login: /login',
      ].join('\n');

  return (
    <Popup
      title={`Share ${name}'s access`}
      trigger={<Share2 size={17} aria-hidden="true" />}
      triggerLabel={`Share ${name}'s credentials`}
      triggerClassName="button ghost icon-button"
    >
      <div className="share-warning">
        Generating a password immediately replaces the manager&apos;s current password. It remains active until changed.
      </div>
      {!password && (
        <div className="stack share-manager-controls">
          <div className="field share-message-field">
            <label htmlFor={`manager-share-${id}`}>WhatsApp message preview</label>
            <textarea id={`manager-share-${id}`} className="share-message" rows={5} readOnly value={message} />
          </div>
          <button
            className="button"
            style={{ width: '100%' }}
            type="button"
            disabled={!active || pending}
            onClick={generatePassword}
          >
            {pending ? 'Generating...' : 'Generate and reset password'}
          </button>
          {!active && <p className="muted">This manager is inactive. Activate the account before sharing access.</p>}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {password && <ShareMessage message={message} />}
    </Popup>
  );
}
