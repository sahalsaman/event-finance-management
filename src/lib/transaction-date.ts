const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dateKey(date: Date): string {
  return dateKeyFormatter.format(date);
}

export function formatTransactionDate(value: string | Date, now = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  const todayKey = dateKey(now);

  if (dateKey(date) === todayKey) return 'Today';

  const yesterday = new Date(`${todayKey}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (dateKey(date) === yesterday.toISOString().slice(0, 10)) return 'Yesterday';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}
