/** Convert the visit picker label to the 24-hour time expected by Laravel. */
export function toApiAppointmentTime(label: string): string {
  const match = /^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i.exec(label.trim());
  if (!match) throw new Error('Choose a valid appointment time.');

  const hour = Number(match[1]);
  if (hour < 1 || hour > 12) throw new Error('Choose a valid appointment time.');

  const hour24 = (hour % 12) + (match[3]!.toUpperCase() === 'PM' ? 12 : 0);
  return `${String(hour24).padStart(2, '0')}:${match[2]}`;
}
