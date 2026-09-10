"use client"

import { cn } from "@/lib/utils"
import { formatDuration, HEAT_CLASS, intensityLevel } from "@/lib/work-data"
import { FlipDuration } from "@/components/flip-duration"
import { RecordStatus } from "@/components/record-status"
import { Hourglass, Timer } from "lucide-react"
import { PomodoroDial } from "@/components/pomodoro-dial"
import { TimerControl, type TimerState } from "@/components/timer-control"
import { StopwatchControl, type StopwatchState } from "@/components/stopwatch-control"

export type WindowMode = "pomodoro" | "timer" | "stopwatch"

interface WindowDayProps {
  date: Date
  hours: number[]
  currentHour: number
  currentSeconds: number
  isLive: boolean
  activeMode: WindowMode
  onModeChange: (mode: WindowMode) => void
  pomodoro: {
    duration: number
    remaining: number
    running: boolean
    endsAt: number | null
    repeat: boolean
    phase: "work" | "break"
    workDuration: number
    breakDuration: number
  }
  onSetPomodoro: (seconds: number) => void
  onTogglePomodoro: () => void
  onTogglePomodoroRepeat: () => void
  timer: TimerState
  onSetTimer: (seconds: number) => void
  onToggleTimer: () => void
  onResetTimer: () => void
  stopwatch: StopwatchState
  onToggleStopwatch: () => void
  onResetStopwatch: () => void
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

const MODE_ITEMS = [
  { mode: "pomodoro", label: "뽀모도로", shortcut: "F1", icon: FocusSessionIcon },
  { mode: "timer", label: "타이머", shortcut: "F2", icon: Hourglass },
  { mode: "stopwatch", label: "스톱워치", shortcut: "F3", icon: Timer },
] as const

function FocusSessionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="5.5" />
      <path d="M12 12V6.5a5.5 5.5 0 0 1 4.76 8.25Z" fill="currentColor" stroke="none" />
      <path d="M12 2.5a9.5 9.5 0 0 1 6.72 2.78M21.5 12a9.5 9.5 0 0 1-2.78 6.72M12 21.5a9.5 9.5 0 0 1-6.72-2.78M2.5 12a9.5 9.5 0 0 1 2.78-6.72" />
    </svg>
  )
}

export function WindowDay({ date, hours, currentHour, currentSeconds, isLive, activeMode, onModeChange, pomodoro, onSetPomodoro, onTogglePomodoro, onTogglePomodoroRepeat, timer, onSetTimer, onToggleTimer, onResetTimer, stopwatch, onToggleStopwatch, onResetStopwatch }: WindowDayProps) {
  const totalMinutes = hours.reduce((sum, minutes) => sum + minutes, 0)
  const currentTimeLabel = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
  const dateLabel = date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  })

  return (
    <div className="flex h-screen min-h-[210px] min-w-[1160px] items-stretch gap-4 bg-background p-4">
      <section className="flex min-w-0 flex-1 flex-col justify-between rounded-xl border border-border bg-card p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">오늘 기록</p>
            <h1 className="mt-1 text-lg font-semibold text-foreground">{dateLabel}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            합계 <span className="ml-1 font-medium tabular-nums text-foreground">{formatDuration(totalMinutes)}</span>
          </p>
        </div>

        <div className="mt-5 grid [grid-template-columns:repeat(24,minmax(0,1fr))] gap-1.5">
          {HOURS.map((hour) => {
            const minutes = hour === currentHour ? currentSeconds / 60 : (hours[hour] ?? 0)
            const level = intensityLevel(minutes)
            const current = hour === currentHour
            return (
              <div key={hour} className="flex min-w-0 flex-col items-center gap-2">
                <span className={cn(
                  "font-mono text-[10px] tabular-nums",
                  current ? "font-semibold text-primary" : "text-muted-foreground/70",
                )}>
                  {String(hour).padStart(2, "0")}
                </span>
                <div
                  title={`${hour}시 · ${formatDuration(minutes)}`}
                  aria-label={`${hour}시 ${formatDuration(minutes)}`}
                  className={cn(
                    "h-10 w-full rounded-[4px]",
                    HEAT_CLASS[level],
                    level === 0 && "border border-border/60",
                    current && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  )}
                />
              </div>
            )
          })}
        </div>
      </section>

      <section aria-label="작업 시간 측정" className="relative flex h-full w-52 shrink-0 items-center justify-center rounded-xl border border-border bg-card p-4">
        <div className="absolute top-4 right-4 left-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">작업 시간 측정</p>
            <RecordStatus working={isLive} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">현재 시간 · {currentTimeLabel}</p>
        </div>
        <FlipDuration seconds={currentSeconds} />
      </section>

      <nav className="grid w-12 shrink-0 grid-rows-3 overflow-hidden rounded-xl border border-border bg-card" aria-label="창모드 기능">
        {MODE_ITEMS.map(({ mode, label, shortcut, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onModeChange(mode)}
            title={`${label} (Ctrl+Shift+${shortcut})`}
            aria-label={`${label}, Ctrl+Shift+${shortcut}`}
            aria-pressed={activeMode === mode}
            className={cn(
              "relative flex items-center justify-center border-b border-border text-muted-foreground transition-colors last:border-b-0 hover:bg-muted hover:text-foreground focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring",
              activeMode === mode && "bg-accent text-primary",
            )}
          >
            {activeMode === mode && <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-r bg-primary" />}
            <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
          </button>
        ))}
      </nav>

      <aside className="relative aspect-square h-full max-h-56 shrink-0 self-center rounded-xl border border-border bg-card p-4">
        {activeMode === "pomodoro" && (
          <PomodoroDial
            remaining={pomodoro.remaining}
            running={pomodoro.running}
            endsAt={pomodoro.endsAt}
            repeat={pomodoro.repeat}
            phase={pomodoro.phase}
            workDuration={pomodoro.workDuration}
            breakDuration={pomodoro.breakDuration}
            onSetDuration={onSetPomodoro}
            onToggle={onTogglePomodoro}
            onToggleRepeat={onTogglePomodoroRepeat}
          />
        )}
        {activeMode === "timer" && (
          <TimerControl timer={timer} onSet={onSetTimer} onToggle={onToggleTimer} onReset={onResetTimer} />
        )}
        {activeMode === "stopwatch" && (
          <StopwatchControl stopwatch={stopwatch} onToggle={onToggleStopwatch} onReset={onResetStopwatch} />
        )}
      </aside>
    </div>
  )
}
