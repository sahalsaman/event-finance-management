'use client';

import { useActionState, useEffect, useRef } from 'react';
import { changePassword, type ChangePasswordState } from '@/app/actions';
import { Popup } from '@/components/Popup';
import { SubmitButton } from '@/components/SubmitButton';

const initialState: ChangePasswordState = {};

export function ChangePasswordPopup() {
  const [state, formAction] = useActionState(changePassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <Popup
      title="Change password"
      trigger="Change password"
      triggerLabel="Change password"
      triggerClassName="profile-menu-action"
      onOpen={() => document.querySelector('.profile-menu')?.removeAttribute('open')}
    >
      <form ref={formRef} action={formAction}>
        <div className="field">
          <label htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={6}
            maxLength={72}
            required
          />
          <small className="muted">Use 6 to 72 characters.</small>
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={6}
            maxLength={72}
            required
          />
        </div>
        {state.error && <p className="error" role="alert">{state.error}</p>}
        {state.success && <p className="success-message" role="status">{state.success}</p>}
        <SubmitButton style={{ width: '100%' }} pendingText="Changing password...">
          Change password
        </SubmitButton>
      </form>
    </Popup>
  );
}
