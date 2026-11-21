'use client';

import { useState } from 'react';
import { rupees } from '@/lib/currency';
import { formatTransactionDate } from '@/lib/transaction-date';

type Activity = {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  createdByName: string;
  status?: string;
};

export function RecentActivity({ activities, isAdmin }: { activities: Activity[]; isAdmin: boolean }) {
  const [visibleCount, setVisibleCount] = useState(20);
  const visibleActivities = activities.slice(0, visibleCount);

  return <>
    {visibleActivities.map((transaction) => (
      <div key={transaction.type + transaction.id} className="listrow">
        <div>
          <b>{transaction.category}</b>
          <p className="muted">
            {formatTransactionDate(transaction.date)} · {transaction.type === 'income' ? 'Income' : 'Expense'}
          </p>
          {isAdmin && <p className="muted">By {transaction.createdByName || 'Admin'}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <b style={{ color: transaction.type === 'income' ? '#138343' : '#bd5d25' }}>
            {transaction.type === 'income' ? '+' : '−'}{rupees(transaction.amount)}
          </b>
          {transaction.status && (
            <p>
              <span className={`pill ${transaction.status === 'APPROVED' ? 'approved' : transaction.status === 'REJECTED' ? 'rejected' : ''}`}>
                {transaction.status}
              </span>
            </p>
          )}
        </div>
      </div>
    ))}
    {activities.length > visibleActivities.length && (
      <button className="button ghost activity-load-more" type="button" onClick={() => setVisibleCount((count) => count + 20)}>
        Load more
      </button>
    )}
  </>;
}
