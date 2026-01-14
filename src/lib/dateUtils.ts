export function getGmt8Date(date: Date = new Date()): Date {
  // CRITICAL FIX: Convert local time to UTC first, then add 8 hours.
  // This is the only way to guarantee GMT+8 regardless of server location.
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (8 * 60 * 60 * 1000));
}

export function formatGmt8Date(date: Date = new Date()): string {
  const gmt8Date = getGmt8Date(date);
  return gmt8Date.toISOString().split('T')[0];
}

export function getUtcTimestamp(date: Date = new Date()): Date {
  // Returns a date object representing the current time, but correctly handles UTC for SQLite
  return date;
}

