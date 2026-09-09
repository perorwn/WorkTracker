"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  addDays,
  buildContributionData,
  formatWeekRange,
  weekFromRows,
  dateKey,
  getWeekStart,
  mondayIndex,
  weekTotalMinutes,
} from "@/lib/work-data"
import { Heatmap } from "@/components/heatmap"
import { DayDetail } from "@/components/day-detail"
import { WeekNav } from "@/components/week-nav"
import { WeekSummary } from "@/components/week-summary"
import { ContributionGraph } from "@/components/contribution-graph"

import { fetchWorkRow, fetchWorkRows, type WorkRow } from "@/lib/supabase"

type SelectedCell = { day: number; hour: number } | null

export function Dashboard() {
  const [today, setToday] = useState(() => new Date())
  const [rows, setRows] = useState<WorkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)
  const [loadedRange, setLoadedRange] = useState<{start: string; end: string} | null>(null)
  const [retry, setRetry] = useState(0)
  const [currentSeconds, setCurrentSeconds] = useState(0)
  const [isLive, setIsLive] = useState(false)
  const lastCurrentRow = useRef<{ key: string; seconds: number } | null>(null)
  const currentWeekStart = useMemo(() => getWeekStart(today), [today])

  const [weekOffset, setWeekOffset] = useState(0)
  const [selected, setSelected] = useState<SelectedCell>(null)

  const weekStart = useMemo(
    () => addDays(currentWeekStart, weekOffset * 7),
    [currentWeekStart, weekOffset],
  )

  const data = useMemo(() => weekFromRows(rows, weekStart), [rows, weekStart])
  const total = useMemo(() => weekTotalMinutes(data), [data])
  const yearData = useMemo(() => buildContributionData(rows, today), [rows, today])

  const startKey = dateKey(new Date(Math.min(addDays(today, -364).getTime(), weekStart.getTime())))
  const endKey = dateKey(today)
  const currentHour = today.getHours()
  const currentRowKey = `${endKey}-${currentHour}`

  useEffect(() => {
    const timer = setInterval(() => {
      setToday(new Date())
      if (isLive) setCurrentSeconds((seconds) => seconds + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [isLive])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let controller: AbortController

    async function refreshCurrentHour() {
      controller = new AbortController()
      try {
        const row = await fetchWorkRow(endKey, currentHour, controller.signal)
        if (stopped) return
        const seconds = row?.seconds ?? 0
        const previous = lastCurrentRow.current
        setIsLive(previous?.key === currentRowKey && seconds > previous.seconds)
        lastCurrentRow.current = { key: currentRowKey, seconds }
        setCurrentSeconds(seconds)
        if (row) {
          setRows((existing) => {
            const index = existing.findIndex((item) => item.date === row.date && item.hour === row.hour)
            if (index < 0) return [...existing, row]
            const next = [...existing]
            next[index] = row
            return next
          })
        }
      } catch (error) {
        if (!stopped && !(error instanceof Error && error.name === "AbortError")) setIsLive(false)
      } finally {
        if (!stopped) timer = setTimeout(refreshCurrentHour, 5000)
      }
    }

    setIsLive(false)
    setCurrentSeconds(0)
    void refreshCurrentHour()
    return () => { stopped = true; clearTimeout(timer); controller?.abort() }
  }, [endKey, currentHour, currentRowKey])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let controller: AbortController
    async function refresh() {
      controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000)
      setLoading(true)
      try {
        const nextRows = await fetchWorkRows(startKey, endKey, controller.signal)
        if (!stopped) {
          setRows(nextRows)
          setLoadedRange({start: startKey, end: endKey})
          setUpdated(new Date())
          setError(null)
        }
      } catch (e) {
        if (!stopped) setError(e instanceof Error && e.name !== "AbortError" ? e.message : "연결 시간이 초과되었습니다.")
      } finally {
        clearTimeout(timeout)
        if (!stopped) {
          setLoading(false)
          timer = setTimeout(refresh, 60000)
        }
      }
    }
    void refresh()
    return () => { stopped = true; clearTimeout(timer); controller?.abort() }
  }, [startKey, endKey, retry])

  const isCurrentWeek = weekOffset === 0

  const selectedDate = useMemo(
    () => (selected ? addDays(weekStart, selected.day) : null),
    [selected, weekStart],
  )

  const handleSelectDate = (date: Date) => {
    const targetWeekStart = getWeekStart(date)
    const offset = Math.round(
      (targetWeekStart.getTime() - currentWeekStart.getTime()) /
        (7 * 86_400_000),
    )
    const clampedOffset = Math.min(0, offset)
    setWeekOffset(clampedOffset)

    // Pick the busiest hour of the clicked date so the detail panel opens on
    // something meaningful; fall back to midday when the day has no sessions.
    const dayIdx = mondayIndex(date)
    const targetWeek = weekFromRows(rows, addDays(currentWeekStart, clampedOffset * 7))
    const hours = targetWeek[dayIdx] ?? []
    let bestHour = 12
    let bestVal = 0
    hours.forEach((m, h) => {
      if (m > bestVal) {
        bestVal = m
        bestHour = h
      }
    })
    setSelected({ day: dayIdx, hour: bestHour })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:gap-8 sm:px-8 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
        작업 기록
      </h1>

      <WeekNav
        rangeLabel={formatWeekRange(weekStart)}
        onPrev={() => {
          setWeekOffset((o) => o - 1)
          setSelected(null)
        }}
        onNext={() => {
          setWeekOffset((o) => Math.min(0, o + 1))
          setSelected(null)
        }}
        onToday={() => {
          setWeekOffset(0)
          setSelected(null)
        }}
        isCurrentWeek={isCurrentWeek}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
        <span suppressHydrationWarning>{loading ? "기록 불러오는 중…" : error ? error : updated ? `최근 갱신 ${updated.toLocaleTimeString()} · 현재 시간 5초마다 갱신${rows.length ? "" : " · 저장된 기록이 없습니다"}` : ""}</span>
        <button type="button" disabled={loading} onClick={() => setRetry(v => v + 1)} className="rounded-lg border border-border px-3 py-2 hover:bg-muted disabled:opacity-50">{error ? "다시 시도" : "새로고침"}</button>
      </div>
      {(!loadedRange || loadedRange.start > startKey || loadedRange.end < endKey) ? <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">{error ? "연결을 확인한 뒤 다시 시도해주세요." : "작업 기록을 불러오고 있습니다."}</div> : <>
      <WeekSummary totalMinutes={total} currentSeconds={currentSeconds} currentHour={currentHour} isLive={isLive} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <section
          aria-label="주간 작업 기록"
          className="rounded-xl border border-border bg-card p-5 sm:p-6"
        >
          <Heatmap
            data={data}
            weekStart={weekStart}
            today={today}
            selected={selected}
            onSelect={setSelected}
          />
        </section>

        <aside aria-label="선택한 날짜 상세">
          <DayDetail data={data} weekStart={weekStart} selected={selected} />
        </aside>
      </div>

      <div className="hidden sm:block">
        <ContributionGraph
          data={yearData}
          onSelectDate={handleSelectDate}
          selectedDate={selectedDate}
        />
      </div>
      </>}
    </div>
  )
}
