"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { WindowDay, type WindowMode } from "@/components/window-day"
import { ThemeToggle, type Theme } from "@/components/theme-toggle"
import { RecordStatus } from "@/components/record-status"
import type { TimerState } from "@/components/timer-control"
import type { StopwatchState } from "@/components/stopwatch-control"

import { fetchWorkRow, fetchWorkRows, type WorkRow } from "@/lib/supabase"

const LOCAL_API = "http://127.0.0.1:8765"

type SelectedCell = { day: number; hour: number } | null
type LocalStatus = {
  running: boolean
  working: boolean
  date: string
  hour: number
  seconds: number
  hours: number[]
  mode: WindowMode
  pomodoro: PomodoroState
  timer: TimerState
  stopwatch: StopwatchState
  theme?: Theme
}
type PomodoroState = {
  duration: number
  remaining: number
  running: boolean
  endsAt: number | null
  repeat: boolean
  phase: "work" | "break"
  workDuration: number
  breakDuration: number
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
  const [trackerAvailable, setTrackerAvailable] = useState(false)
  const [theme, setTheme] = useState<Theme>("light")
  const [themeReady, setThemeReady] = useState(false)
  const [activeWindowMode, setActiveWindowMode] = useState<WindowMode>("tracking")
  const [pomodoro, setPomodoro] = useState<PomodoroState>({
    duration: 1500,
    remaining: 1500,
    running: false,
    endsAt: null,
    repeat: false,
    phase: "work",
    workDuration: 1500,
    breakDuration: 2100,
  })
  const [timerState, setTimerState] = useState<TimerState>({ duration: 0, remaining: 0, running: false, endsAt: null })
  const [stopwatch, setStopwatch] = useState<StopwatchState>({ elapsed: 0, running: false, startedAt: null, baseElapsed: 0 })
  const pendingMode = useRef<WindowMode | null>(null)
  const windowModeRef = useRef(false)
  const pomodoroRequestId = useRef(0)
  const pomodoroRequestPending = useRef(false)
  const timerRequestId = useRef(0)
  const timerRequestPending = useRef(false)
  const stopwatchRequestId = useRef(0)
  const stopwatchRequestPending = useRef(false)
  const lastRemoteSeconds = useRef<{ key: string; seconds: number } | null>(null)
  const currentWeekStart = useMemo(() => getWeekStart(today), [today])

  const [weekOffset, setWeekOffset] = useState(0)
  const [selected, setSelected] = useState<SelectedCell>(() => {
    const now = new Date()
    return { day: mondayIndex(now), hour: now.getHours() }
  })

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
    const searchParams = new URLSearchParams(window.location.search)
    const windowMode = searchParams.get("window") === "1"
    windowModeRef.current = windowMode
    setIsWindowMode(windowMode)
    if (!windowMode) return
    const previousTitle = document.title
    const previousOverflow = document.body.style.overflow
    const windowToken = searchParams.get("windowToken")
    document.title = windowToken ? `WORK TRACKER · ${windowToken}` : "WORK TRACKER"
    const titleTimer = windowToken
      ? window.setTimeout(() => { document.title = "WORK TRACKER" }, 3000)
      : null
    document.body.style.overflow = "hidden"
    return () => {
      if (titleTimer !== null) window.clearTimeout(titleTimer)
      document.title = previousTitle
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("theme")
    const saved = localStorage.getItem("worktracker-theme")
    const initialTheme = requested === "dark" || requested === "light"
      ? requested
      : saved === "dark" || saved === "light" ? saved : "light"
    document.documentElement.classList.toggle("dark", initialTheme === "dark")
    document.documentElement.classList.toggle("light", initialTheme === "light")
    setTheme(initialTheme)
    setThemeReady(true)
  }, [])

  useEffect(() => {
    if (!themeReady) return
    document.documentElement.classList.add('theme-changing')
    document.documentElement.classList.toggle("dark", theme === "dark")
    document.documentElement.classList.toggle("light", theme === "light")
    localStorage.setItem("worktracker-theme", theme)
    const transitionTimer = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-changing')
    }, 100)
    return () => window.clearTimeout(transitionTimer)
  }, [theme, themeReady])

  useEffect(() => {
    if (!themeReady || windowModeRef.current) return
    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    const syncTheme = async () => {
      const options = {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "theme", theme }),
        signal: controller.signal,
        cache: "no-store",
        mode: "cors",
        targetAddressSpace: "loopback",
      } as RequestInit & { targetAddressSpace: "loopback" }
      try {
        const response = await fetch(`${LOCAL_API}/window`, options)
        if (!response.ok) throw new Error("theme update failed")
      } catch {
        if (!stopped) retryTimer = setTimeout(syncTheme, 1000)
      }
    }
    void syncTheme()
    return () => { stopped = true; clearTimeout(retryTimer); controller.abort() }
  }, [theme, themeReady, trackerAvailable])

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
      const pomodoroVersion = pomodoroRequestId.current
      const timerVersion = timerRequestId.current
      const stopwatchVersion = stopwatchRequestId.current
      const pomodoroWasPending = pomodoroRequestPending.current
      const timerWasPending = timerRequestPending.current
      const stopwatchWasPending = stopwatchRequestPending.current
      controller = new AbortController()
      try {
        const options = {
          signal: controller.signal,
          cache: "no-store",
          mode: "cors",
          targetAddressSpace: "loopback",
        } as RequestInit & { targetAddressSpace: "loopback" }
        const response = await fetch(`${LOCAL_API}/status`, options)
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
          if (["tracking", "pomodoro", "timer", "stopwatch"].includes(status.mode)) {
            if (pendingMode.current === status.mode) pendingMode.current = null
            if (pendingMode.current === null) setActiveWindowMode(status.mode)
          }
          if (status.pomodoro && !pomodoroWasPending && !pomodoroRequestPending.current && pomodoroVersion === pomodoroRequestId.current) setPomodoro(status.pomodoro)
          if (status.timer && !timerWasPending && !timerRequestPending.current && timerVersion === timerRequestId.current) setTimerState(status.timer)
          if (status.stopwatch && !stopwatchWasPending && !stopwatchRequestPending.current && stopwatchVersion === stopwatchRequestId.current) setStopwatch(status.stopwatch)
          if (windowModeRef.current && (status.theme === "dark" || status.theme === "light")) {
            setTheme(status.theme)
          }
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
        const key = `${endKey}-${currentHour}`
        const previous = lastRemoteSeconds.current
        setIsLive(previous?.key === key && seconds > previous.seconds)
        lastRemoteSeconds.current = { key, seconds }
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
    const launcherUrl = `${LOCAL_API}/open?theme=${theme}&t=${Date.now()}`
    const launcher = window.open(
      launcherUrl,
      "WorkTrackerLauncher",
      "popup=yes,width=360,height=160,toolbar=no,location=no,menubar=no,status=no,resizable=no",
    )
    if (launcher) {
      launcher.focus()
      return
    }

    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open", theme }),
      cache: "no-store",
      mode: "cors",
      targetAddressSpace: "loopback",
    } as RequestInit & { targetAddressSpace: "loopback" }
    await fetch(`${LOCAL_API}/window`, options).catch(() => undefined)
  }

  const changeWindowMode = (mode: WindowMode) => {
    pendingMode.current = mode
    setActiveWindowMode(mode)
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
      cache: "no-store",
      mode: "cors",
      targetAddressSpace: "loopback",
    } as RequestInit & { targetAddressSpace: "loopback" }
    void fetch(`${LOCAL_API}/mode`, options)
      .then(async (response) => {
        if (!response.ok) throw new Error("mode update failed")
        const result = await response.json() as { mode: WindowMode }
        if (pendingMode.current === mode) {
          pendingMode.current = null
          setActiveWindowMode(result.mode)
        }
      })
      .catch(() => {
        if (pendingMode.current === mode) pendingMode.current = null
      })
  }

  const sendPomodoroAction = (payload: { action: "set"; seconds: number } | { action: "toggle" } | { action: "repeat"; enabled: boolean }) => {
    const requestId = ++pomodoroRequestId.current
    pomodoroRequestPending.current = true
    if (payload.action === "set") {
      setPomodoro((current) => ({
        ...current,
        duration: payload.seconds,
        remaining: payload.seconds,
        running: false,
        endsAt: null,
        phase: "work",
        workDuration: payload.seconds,
        breakDuration: Math.max(0, 3600 - payload.seconds),
      }))
    } else if (payload.action === "repeat") {
      setPomodoro((current) => ({ ...current, repeat: payload.enabled }))
    } else {
      setPomodoro((current) => {
        if (current.running) {
          const remaining = current.endsAt === null ? current.remaining : Math.max(0, (current.endsAt - Date.now()) / 1000)
          return { ...current, remaining, running: false, endsAt: null }
        }
        return current.remaining > 0
          ? { ...current, running: true, endsAt: Date.now() + current.remaining * 1000 }
          : current
      })
    }
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      mode: "cors",
      targetAddressSpace: "loopback",
    } as RequestInit & { targetAddressSpace: "loopback" }
    void fetch(`${LOCAL_API}/pomodoro`, options)
      .then(async (response) => {
        if (!response.ok) throw new Error("pomodoro update failed")
        const result = await response.json() as PomodoroState
        if (requestId === pomodoroRequestId.current) {
          pomodoroRequestPending.current = false
          setPomodoro(result)
        }
      })
      .catch(() => {
        if (requestId === pomodoroRequestId.current) pomodoroRequestPending.current = false
      })
  }

  const sendTimerAction = (payload: { action: "set"; seconds: number } | { action: "toggle" } | { action: "reset" }) => {
    const requestId = ++timerRequestId.current
    timerRequestPending.current = true
    if (payload.action === "set") {
      setTimerState({ duration: payload.seconds, remaining: payload.seconds, running: false, endsAt: null })
    } else if (payload.action === "reset") {
      setTimerState((current) => ({ ...current, remaining: current.duration, running: false, endsAt: null }))
    } else {
      setTimerState((current) => {
        if (current.running) {
          const remaining = current.endsAt === null ? current.remaining : Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000))
          return { ...current, remaining, running: false, endsAt: null }
        }
        return current.remaining > 0
          ? { ...current, running: true, endsAt: Date.now() + current.remaining * 1000 }
          : current
      })
    }
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      mode: "cors",
      targetAddressSpace: "loopback",
    } as RequestInit & { targetAddressSpace: "loopback" }
    void fetch(`${LOCAL_API}/timer`, options)
      .then(async (response) => {
        if (!response.ok) throw new Error("timer update failed")
        const result = await response.json() as TimerState
        if (requestId === timerRequestId.current) {
          timerRequestPending.current = false
          setTimerState(result)
        }
      })
      .catch(() => {
        if (requestId === timerRequestId.current) timerRequestPending.current = false
      })
  }

  const sendStopwatchAction = (action: "toggle" | "reset") => {
    const requestId = ++stopwatchRequestId.current
    stopwatchRequestPending.current = true
    if (action === "reset") {
      setStopwatch({ elapsed: 0, running: false, startedAt: null, baseElapsed: 0 })
    } else {
      setStopwatch((current) => {
        if (current.running && current.startedAt !== null) {
          const baseElapsed = current.baseElapsed + (Date.now() - current.startedAt) / 1000
          return { elapsed: Math.floor(baseElapsed), running: false, startedAt: null, baseElapsed }
        }
        return { ...current, running: true, startedAt: Date.now(), baseElapsed: current.elapsed }
      })
    }
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      cache: "no-store",
      mode: "cors",
      targetAddressSpace: "loopback",
    } as RequestInit & { targetAddressSpace: "loopback" }
    void fetch(`${LOCAL_API}/stopwatch`, options)
      .then(async (response) => {
        if (!response.ok) throw new Error("stopwatch update failed")
        const result = await response.json() as StopwatchState
        if (requestId === stopwatchRequestId.current) {
          stopwatchRequestPending.current = false
          setStopwatch(result)
        }
      })
      .catch(() => {
        if (requestId === stopwatchRequestId.current) stopwatchRequestPending.current = false
      })
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
        activeMode={activeWindowMode}
        onModeChange={changeWindowMode}
        pomodoro={pomodoro}
        onSetPomodoro={(seconds) => sendPomodoroAction({ action: "set", seconds })}
        onTogglePomodoro={() => sendPomodoroAction({ action: "toggle" })}
        onTogglePomodoroRepeat={() => sendPomodoroAction({ action: "repeat", enabled: !pomodoro.repeat })}
        timer={timerState}
        onSetTimer={(seconds) => sendTimerAction({ action: "set", seconds })}
        onToggleTimer={() => sendTimerAction({ action: "toggle" })}
        onResetTimer={() => sendTimerAction({ action: "reset" })}
        stopwatch={stopwatch}
        onToggleStopwatch={() => sendStopwatchAction("toggle")}
        onResetStopwatch={() => sendStopwatchAction("reset")}
      />
    )
  }

  return (
    <>
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:gap-8 sm:px-8 sm:py-14">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
            작업 기록
          </h1>
          <RecordStatus working={isLive} />
        </div>
        <button
          type="button"
          onClick={() => void openWindowMode()}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <PanelTopOpen className="h-4 w-4" aria-hidden />
          창모드
        </button>
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

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground" aria-live="polite">
        <span>CLIP STUDIO PAINT 측정{!rows.length && !loading ? " · 저장된 기록이 없습니다" : ""}</span>
        <div className="ml-auto flex items-center gap-3">
          <span suppressHydrationWarning>{loading ? "기록 불러오는 중…" : error ? error : updated ? `최근 갱신 ${updated.toLocaleTimeString()}` : ""}</span>
          <button type="button" disabled={loading} onClick={() => setRetry(v => v + 1)} className="rounded-lg border border-border px-3 py-2 hover:bg-muted disabled:opacity-50">{error ? "다시 시도" : "새로고침"}</button>
        </div>
      </div>
      {(!loadedRange || loadedRange.start > startKey || loadedRange.end < endKey) ? <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">{error ? "연결을 확인한 뒤 다시 시도해주세요." : "작업 기록을 불러오고 있습니다."}</div> : <>
      <WeekSummary totalMinutes={total} />

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
