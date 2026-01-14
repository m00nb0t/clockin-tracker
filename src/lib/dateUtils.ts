export function getGmt8Date(date: Date = new Date()): Date {
  // Add 8 hours to UTC time
  return new Date(date.getTime() + (8 * 60 * 60 * 1000));
}

export function formatGmt8Date(date: Date = new Date()): string {
  const gmt8Date = getGmt8Date(date);
  return gmt8Date.toISOString().split('T')[0];
}

export function getUtcTimestamp(date: Date = new Date()): Date {
  // Returns a date object representing the current time, but correctly handles UTC for SQLite
  return date;
}

