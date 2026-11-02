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
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  name?: string;
  value?: string;
  formNoValidate?: boolean;
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
    >
      {pending && <span className="loader-spinner" aria-hidden="true" />}
      <span>{pending ? pendingText : children}</span>
    </button>
  );
}
