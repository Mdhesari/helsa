import type { ReportPeriod } from '../api/types'

/** Local YYYY-MM-DD (matches how the backend interprets dates: user tz). */
export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr(): string {
  return toDateStr(new Date())
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

export function addMonths(dateStr: string, months: number): string {
  const d = parseDateStr(dateStr)
  d.setDate(1) // avoid month-length overflow
  d.setMonth(d.getMonth() + months)
  return toDateStr(d)
}

export function stepDate(dateStr: string, period: ReportPeriod, dir: 1 | -1): string {
  switch (period) {
    case 'daily':
      return addDays(dateStr, dir)
    case 'weekly':
      return addDays(dateStr, 7 * dir)
    case 'monthly':
      return addMonths(dateStr, dir)
  }
}

const SHORT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

export function formatDay(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    ...SHORT,
  })
}

export function formatRange(start: string, end: string): string {
  const s = parseDateStr(start).toLocaleDateString(undefined, SHORT)
  const e = parseDateStr(end).toLocaleDateString(undefined, SHORT)
  return `${s} – ${e}`
}

export function formatMonth(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}
