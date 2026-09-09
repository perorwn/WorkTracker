export const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const
export const DAY_LABELS_FULL = [
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
  "일요일",
] as const

/** minutes worked, indexed as data[dayIndex 0-6][hour 0-23] */
export type WeekData = number[][]

/** Returns the Monday (00:00 local) of the week containing `date`. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Minutes -> intensity level 0..5 per the tracking spec. */
export function intensityLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0
  if (minutes < 15) return 1
  if (minutes < 30) return 2
  if (minutes < 45) return 3
  return 4
}

export const HEAT_CLASS: Record<number, string> = {
  0: "bg-heat-0",
  1: "bg-heat-1",
  2: "bg-heat-2",
  3: "bg-heat-3",
  4: "bg-heat-4",
}

export function formatDuration(minutes: number): string {
  const seconds = Math.round(minutes * 60)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const sec = seconds % 60
  return [h ? `${h}시간` : "", m ? `${m}분` : "", sec ? `${sec}초` : ""].filter(Boolean).join(" ") || "0분"
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`
}

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const shortDate = (d: Date) => `${d.getMonth() + 1}. ${d.getDate()}`
  const start = `${weekStart.getFullYear()}. ${shortDate(weekStart)}`
  const finish = weekStart.getFullYear() === end.getFullYear()
    ? shortDate(end) : `${end.getFullYear()}. ${shortDate(end)}`
  return `${start} – ${finish}`
}

export function weekTotalMinutes(data: WeekData): number {
  return data.reduce((sum, day) => sum + day.reduce((a, b) => a + b, 0), 0)
}

export function dayTotalMinutes(data: WeekData, dayIndex: number): number {
  return data[dayIndex]?.reduce((a, b) => a + b, 0) ?? 0
}

export function activeDayCount(data: WeekData): number {
  return data.filter((day) => day.some((m) => m > 0)).length
}

/** Monday-based day index (Mon = 0 … Sun = 6) for a Date. */
export function mondayIndex(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

/**
 * Daily-total intensity scale for the contribution graph. Daily sums span
 * several hours, so this uses coarser buckets than the hourly heatmap while
 * sharing the same 6-step palette.
 */
export function dailyIntensityLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0
  if (minutes < 330) return 1
  if (minutes < 390) return 2
  if (minutes < 450) return 3
  return 4
}

export interface ContributionDay {
  date: Date
  minutes: number
}

export interface WorkRow { date: string; hour: number; seconds: number }

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
}

export function weekFromRows(rows: WorkRow[], weekStart: Date): WeekData {
  const week = Array.from({length: 7}, () => Array<number>(24).fill(0))
  const keys = Array.from({length: 7}, (_, i) => dateKey(addDays(weekStart, i)))
  for (const row of rows) {
    const day = keys.indexOf(row.date)
    if (day >= 0) week[day][row.hour] += row.seconds / 60
  }
  return week
}

export function buildContributionData(rows: WorkRow[], now: Date, days = 365): ContributionDay[] {
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(row.date, (totals.get(row.date) ?? 0) + row.seconds / 60)
  return Array.from({length: days}, (_, i) => {
    const date = addDays(now, i - days + 1)
    return {date, minutes: totals.get(dateKey(date)) ?? 0}
  })
}

export function formatFullDate(date: Date): string {
  return date.toLocaleDateString("ko-KR", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
