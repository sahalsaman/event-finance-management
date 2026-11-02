'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, ArrowLeftRight, ClipboardCheck, Settings, CalendarDays, Users } from 'lucide-react';

export function Nav({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: '/', label: 'Home', icon: House },
    { href: '/transactions', label: 'Activity', icon: ArrowLeftRight },
    ...(admin
      ? [
          { href: '/approvals', label: 'Approvals', icon: ClipboardCheck },
          { href: '/events', label: 'Events', icon: CalendarDays },
          { href: '/managers', label: 'Managers', icon: Users },
        ]
      : [
          { href: '/income', label: 'Add Income', icon: Settings },
          { href: '/expense', label: 'Add Expense', icon: ClipboardCheck },
        ]),
  ];

  return (
    <>
      <nav className="nav" aria-label="Main navigation">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
      <nav className="desktop-nav" aria-label="Main navigation">
        {items.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
