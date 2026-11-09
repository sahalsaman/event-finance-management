'use client';

import { Children, isValidElement, ReactNode, useState } from 'react';

type LiveSearchListProps = {
  children: ReactNode;
  className: string;
  emptyMessage: string;
  emptyMessageClassName?: string;
  inputId: string;
  initialQuery?: string;
  label: string;
  noResultsMessage: string;
  placeholder: string;
};

export function LiveSearchList({
  children,
  className,
  emptyMessage,
  emptyMessageClassName = 'muted',
  inputId,
  initialQuery = '',
  label,
  noResultsMessage,
  placeholder,
}: LiveSearchListProps) {
  const [query, setQuery] = useState(initialQuery);
  const items = Children.toArray(children);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleItems = normalizedQuery
    ? items.filter((item) => {
        if (!isValidElement<{ 'data-search'?: string }>(item)) return true;
        return (item.props['data-search'] ?? '').toLocaleLowerCase().includes(normalizedQuery);
      })
    : items;

  return (
    <>
      <div className="transaction-search" role="search">
        <label className="sr-only" htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          type="search"
          value={query}
          maxLength={100}
          placeholder={placeholder}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className={className}>
        {items.length === 0
          ? <p className={emptyMessageClassName}>{emptyMessage}</p>
          : visibleItems.length === 0
            ? <p className="muted">{noResultsMessage}</p>
            : visibleItems}
      </div>
    </>
  );
}
