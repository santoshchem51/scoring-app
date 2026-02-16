/** Given a day name (e.g. "Saturday"), return the next occurrence as YYYY-MM-DD. */
export function getNextOccurrence(dayName: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetIndex = days.indexOf(dayName);
  if (targetIndex === -1) return '';
  const today = new Date();
  const todayIndex = today.getDay();
  let daysUntil = targetIndex - todayIndex;
  if (daysUntil <= 0) daysUntil += 7;
  const next = new Date(today);
  next.setDate(today.getDate() + daysUntil);
  return next.toISOString().split('T')[0];
}
