"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { PanelTopOpen } from "lucide-react"
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
import { WindowDay } from "@/components/window-day"
import { ThemeToggle, type Theme } from "@/components/theme-toggle"

import { fetchWorkRow, fetchWorkRows, type WorkRow } from "@/lib/supabase"

type SelectedCell = { day: number; hour: number } | null
type PictureInPictureApi = {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>
}
type LocalStatus = {
  running: boolean
  working: boolean
  date: string
  hour: number
  seconds: number
  hours: number[]
}

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
  const [isWindowMode, setIsWindowMode] = useState<boolean | null>(null)
  const [pictureWindow, setPictureWindow] = useState<Window | null>(null)
  const [trackerAvailable, setTrackerAvailable] = useState(false)
  const [theme, setTheme] = useState<Theme>("light")
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
  const todayHours = useMemo(() => {
    const hours = Array<number>(24).fill(0)
    for (const row of rows) if (row.date === endKey) hours[row.hour] += row.seconds / 60
    hours[currentHour] = currentSeconds / 60
    return hours
  }, [rows, endKey, currentHour, currentSeconds])

  useEffect(() => {
    const windowMode = new URLSearchParams(window.location.search).get("window") === "1"
    setIsWindowMode(windowMode)
    if (!windowMode) return
    const previousTitle = document.title
    const previousOverflow = document.body.style.overflow
    document.title = "오늘 작업 기록"
    document.body.style.overflow = "hidden"
    return () => {
      document.title = previousTitle
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem("worktracker-theme")
    if (saved === "dark" || saved === "light") setTheme(saved)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    document.documentElement.classList.toggle("light", theme === "light")
    localStorage.setItem("worktracker-theme", theme)
    if (pictureWindow) pictureWindow.document.documentElement.className = document.documentElement.className
  }, [theme, pictureWindow])

  const toggleTheme = () => setTheme((value) => value === "light" ? "dark" : "light")

  useEffect(() => {
    const timer = setInterval(() => {
      setToday(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let controller: AbortController
    let lastSnapshot = ""

    async function readLocalStatus() {
      controller = new AbortController()
      try {
        const options = {
          signal: controller.signal,
          cache: "no-store",
          mode: "cors",
          targetAddressSpace: "loopback",
        } as RequestInit & { targetAddressSpace: "loopback" }
        const response = await fetch("http://localhost:8765/status", options)
        if (!response.ok) throw new Error("tracker unavailable")
        const status = await response.json() as LocalStatus
        if (!status.running || !Array.isArray(status.hours) || status.hours.length !== 24) {
          throw new Error("invalid tracker status")
        }
        if (stopped) return
        setTrackerAvailable(true)
        const snapshot = JSON.stringify(status)
        if (snapshot !== lastSnapshot) {
          lastSnapshot = snapshot
          setCurrentSeconds(status.seconds)
          setIsLive(status.working)
          setRows((existing) => [
            ...existing.filter((row) => row.date !== status.date),
            ...status.hours.flatMap((seconds, hour) => seconds > 0
              ? [{ date: status.date, hour, seconds }]
              : []),
          ])
        }
      } catch {
        if (!stopped) {
          setTrackerAvailable(false)
          setIsLive(false)
        }
      } finally {
        if (!stopped) timer = setTimeout(readLocalStatus, 500)
      }
    }

    void readLocalStatus()
    return () => { stopped = true; clearTimeout(timer); controller?.abort() }
  }, [])

  useEffect(() => {
    if (trackerAvailable) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let controller: AbortController

    async function refreshCurrentHour() {
      controller = new AbortController()
      try {
        const row = await fetchWorkRow(endKey, currentHour, controller.signal)
        if (stopped) return
        const seconds = row?.seconds ?? 0
        setIsLive(false)
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
  }, [endKey, currentHour, trackerAvailable])

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

  const openWindowMode = async () => {
    const pictureInPicture = (window as Window & {
      documentPictureInPicture?: PictureInPictureApi
    }).documentPictureInPicture

    if (pictureInPicture) {
      try {
        const nextWindow = await pictureInPicture.requestWindow({ width: 1180, height: 260 })
        document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
          nextWindow.document.head.appendChild(node.cloneNode(true))
        })
        nextWindow.document.documentElement.className = document.documentElement.className
        nextWindow.document.body.className = document.body.className
        nextWindow.document.body.style.margin = "0"
        nextWindow.addEventListener("pagehide", () => setPictureWindow(null), { once: true })
        setPictureWindow(nextWindow)
        return
      } catch {
        // Fall through to a regular popup when the browser denies this mode.
      }
    }

    const url = new URL(window.location.href)
    url.search = "?window=1"
    const popup = window.open(
      url.toString(),
      "WorkTrackerWindow",
      "popup=yes,width=1180,height=260,toolbar=no,location=no,menubar=no,status=no,scrollbars=no,resizable=yes",
    )
    popup?.focus()
  }

  if (isWindowMode === null) return <div className="h-screen bg-background" />

  if (isWindowMode) {
    return (
      <WindowDay
        date={today}
        hours={todayHours}
        currentHour={currentHour}
        currentSeconds={currentSeconds}
        isLive={isLive}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    )
  }

  return (
    <>
    {pictureWindow && createPortal(
      <WindowDay
        date={today}
        hours={todayHours}
        currentHour={currentHour}
        currentSeconds={currentSeconds}
        isLive={isLive}
        theme={theme}
        onToggleTheme={toggleTheme}
      />,
      pictureWindow.document.body,
    )}
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:gap-8 sm:px-8 sm:py-14">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
          작업 기록
        </h1>
        {trackerAvailable && <button
          type="button"
          onClick={() => void openWindowMode()}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <PanelTopOpen className="h-4 w-4" aria-hidden />
          창모드
        </button>}
      </div>

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
        <span suppressHydrationWarning>{loading ? "기록 불러오는 중…" : error ? error : updated ? `최근 갱신 ${updated.toLocaleTimeString()}${trackerAvailable ? " · 측정 프로그램 직접 연결" : " · 현재 시간 5초마다 갱신"}${rows.length ? "" : " · 저장된 기록이 없습니다"}` : ""}</span>
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
    <ThemeToggle theme={theme} onToggle={toggleTheme} />
    </>
  )
}
