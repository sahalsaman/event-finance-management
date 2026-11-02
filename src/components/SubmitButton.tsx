'use client';

import { useFormStatus } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';

export function SubmitButton({
  children,
  pendingText = 'Please wait...',
  className = 'button',
  style,
  disabled = false,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} style={style} type="submit" disabled={disabled || pending}>
      {pending && <span className="loader-spinner" aria-hidden="true" />}
      <span>{pending ? pendingText : children}</span>
    </button>
  );
}
