'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { changePassword, type ChangePasswordState } from '@/app/actions';
import { SubmitButton } from '@/components/SubmitButton';
import { createPortal } from 'react-dom';

const initialState: ChangePasswordState = {};

export function ChangePasswordPopup() {
  const [state, formAction] = useActionState(changePassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        className="profile-menu-action"
        onClick={() => {
          document.querySelector('.profile-menu')?.removeAttribute('open');
          dialogRef.current?.showModal();
        }}
      >
        Change password
      </button>
      {portalReady && createPortal(
        <dialog
          ref={dialogRef}
          className="popup-dialog"
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close();
          }}
        >
          <div className="popup-content">
            <header className="popup-header">
              <h2>Change password</h2>
              <button
                type="button"
                className="button ghost popup-close"
                aria-label="Close"
                onClick={() => dialogRef.current?.close()}
              >
                ×
              </button>
            </header>
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
          </div>
        </dialog>,
        document.body,
      )}
    </>
  );
}
