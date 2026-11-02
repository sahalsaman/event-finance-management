'use client';

import { useEffect, useState } from 'react';

export function LoginErrorToast({ message }: { message: string | null }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  if (!message || !visible) return null;

  return (
    <div className="login-error-toast" role="alert">
      <span>{message}</span>
      <button
        type="button"
        className="login-error-toast-close"
        aria-label="Dismiss error"
        onClick={() => setVisible(false)}
      >
        ×
      </button>
    </div>
  );
}
