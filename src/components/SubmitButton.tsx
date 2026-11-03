'use client';

import { useFormStatus } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';

export function SubmitButton({
  children,
  pendingText = 'Please wait...',
  className = 'button',
  style,
  disabled = false,
  name,
  value,
  formNoValidate = false,
  ariaLabel,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  name?: string;
  value?: string;
  formNoValidate?: boolean;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      style={style}
      type="submit"
      disabled={disabled || pending}
      name={name}
      value={value}
      formNoValidate={formNoValidate}
      aria-label={ariaLabel}
    >
      {pending && <span className="loader-spinner" aria-hidden="true" />}
      <span>{pending ? pendingText : children}</span>
    </button>
  );
}
