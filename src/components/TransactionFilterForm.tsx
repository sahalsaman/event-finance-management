'use client';

import { useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

export function TransactionFilterForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (typeof value === 'string' && value && !(key === 'type' && value === 'ALL')) {
        params.set(key, value);
      }
    });
    const dialog = form.closest('dialog');
    if (dialog instanceof HTMLDialogElement) dialog.close();
    const query = params.toString();
    const href = query ? `/transactions?${query}` : '/transactions';
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (href === currentHref) {
      return;
    }
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <>
      <form action="/transactions" method="get" onSubmit={applyFilters}>
        {children}
      </form>
      {loading && createPortal(
        <div className="transaction-loading-overlay" role="status" aria-label="Loading filtered transactions">
          <div className="transaction-loading-content">
            <span className="loading-skeleton loading-title" />
            <span className="loading-skeleton loading-card loading-line" />
            <span className="loading-skeleton loading-card loading-line" />
            <span className="loading-skeleton loading-card loading-line" />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
