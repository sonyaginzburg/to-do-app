// Due dates are plain calendar days ("2026-10-15"), never timestamps. Everything here works on
// the browser's local date so "today" matches what the user sees on their own calendar.

export function toISO(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function parseISO(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const today = () => toISO(new Date())

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso)
  date.setDate(date.getDate() + days)
  return toISO(date)
}

// Weeks start on Monday.
export function startOfWeek(iso: string): string {
  const daysSinceMonday = (parseISO(iso).getDay() + 6) % 7
  return addDays(iso, -daysSinceMonday)
}

export const weekDays = (weekStart: string) =>
  Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

const fmt = (options: Intl.DateTimeFormatOptions) => (iso: string) =>
  parseISO(iso).toLocaleDateString('en-US', options)

export const weekdayName = fmt({ weekday: 'long' })
export const shortDate = fmt({ month: 'short', day: 'numeric' })

export function formatRange(weekStart: string): string {
  const end = addDays(weekStart, 6)
  const sameYear = parseISO(weekStart).getFullYear() === parseISO(end).getFullYear()
  const start = sameYear
    ? shortDate(weekStart)
    : `${shortDate(weekStart)}, ${weekStart.slice(0, 4)}`
  return `${start} – ${shortDate(end)}, ${end.slice(0, 4)}`
}
