'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Popup } from '@/components/Popup';

export type ExpenseNotification = {
  id: string;
  category: string;
  amount: string;
  managerName: string;
};

export function NotificationBell({ notifications }: { notifications: ExpenseNotification[] }) {
  return (
    <Popup
      title="Expense approval requests"
      trigger={
        <span className="notification-trigger">
          <Bell size={19} aria-hidden="true" />
          {notifications.length > 0 && <span className="notification-count">{notifications.length}</span>}
        </span>
      }
      triggerLabel={`${notifications.length} pending expense approvals`}
      triggerClassName="button ghost icon-button"
    >
      {notifications.length === 0 ? (
        <p className="muted">No pending expense approvals.</p>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <Link
              className="notification-item"
              href={`/expense-approvals#expense-${notification.id}`}
              key={notification.id}
            >
              <span>
                <b>{notification.category}</b>
                <small className="muted">By {notification.managerName}</small>
              </span>
              <b>{notification.amount}</b>
            </Link>
          ))}
          <Link className="button" href="/expense-approvals">View all approvals</Link>
        </div>
      )}
    </Popup>
  );
}
