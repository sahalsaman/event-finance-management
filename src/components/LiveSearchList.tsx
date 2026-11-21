'use client';

import { Children, isValidElement, ReactNode, useEffect, useState } from 'react';

type LiveSearchListProps = {
  children: ReactNode;
  className: string;
  emptyMessage: string;
  emptyMessageClassName?: string;
  inputId: string;
  initialQuery?: string;
  label: string;
  noResultsMessage: string;
  pageSize?: number;
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
  pageSize,
  placeholder,
}: LiveSearchListProps) {
  const [query, setQuery] = useState(initialQuery);
  const [visibleCount, setVisibleCount] = useState(pageSize ?? Number.MAX_SAFE_INTEGER);
  const items = Children.toArray(children);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleItems = normalizedQuery
    ? items.filter((item) => {
        if (!isValidElement<{ 'data-search'?: string }>(item)) return true;
        return (item.props['data-search'] ?? '').toLocaleLowerCase().includes(normalizedQuery);
      })
    : items;
  useEffect(() => {
    setVisibleCount(pageSize ?? Number.MAX_SAFE_INTEGER);
  }, [pageSize, query]);
  const displayedItems = pageSize ? visibleItems.slice(0, visibleCount) : visibleItems;

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
            : displayedItems}
        {pageSize && visibleItems.length > displayedItems.length && (
          <button className="button ghost activity-load-more" type="button" onClick={() => setVisibleCount((count) => count + pageSize)}>
            Load more
          </button>
        )}
      </div>
    </>
  );
}
