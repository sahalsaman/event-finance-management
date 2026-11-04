'use client';

import { logout } from '@/app/actions';
import { useEffect, useRef } from 'react';

export function ClearStaleSession() {
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    formRef.current?.requestSubmit();
  }, []);

  return (
    <main className="shell" style={{ maxWidth: 430, paddingTop: 85 }}>
      <div className="card stack">
        <div>
          <h1>Session expired</h1>
          <p className="muted">Please sign in again to continue.</p>
        </div>
        <form ref={formRef} action={logout}>
          <button className="button" type="submit" style={{ width: '100%' }}>
            Continue to login
          </button>
        </form>
      </div>
    </main>
  );
}
