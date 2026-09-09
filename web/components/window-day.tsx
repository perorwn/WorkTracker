"use client"

import { cn } from "@/lib/utils"
import { formatDuration, HEAT_CLASS, intensityLevel } from "@/lib/work-data"
import { FlipDuration } from "@/components/flip-duration"
import { RecordStatus } from "@/components/record-status"
import { Activity, Focus, Hourglass, Timer } from "lucide-react"

export type WindowMode = "tracking" | "pomodoro" | "timer" | "stopwatch"

interface WindowDayProps {
  date: Date
  hours: number[]
  currentHour: number
  currentSeconds: number
  isLive: boolean
  activeMode: WindowMode
  onModeChange: (mode: WindowMode) => void
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

const MODE_ITEMS = [
  { mode: "tracking", label: "작업 시간 측정", shortcut: "F1", icon: Activity },
  { mode: "pomodoro", label: "뽀모도로", shortcut: "F2", icon: Focus },
  { mode: "timer", label: "타이머", shortcut: "F3", icon: Hourglass },
  { mode: "stopwatch", label: "스톱워치", shortcut: "F4", icon: Timer },
] as const

export function WindowDay({ date, hours, currentHour, currentSeconds, isLive, activeMode, onModeChange }: WindowDayProps) {
  const totalMinutes = hours.reduce((sum, minutes) => sum + minutes, 0)
  const currentTimeLabel = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
  const dateLabel = date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  })

  return (
    <div className="flex h-screen min-h-[210px] min-w-[980px] items-stretch gap-4 bg-background p-4">
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

      <nav className="grid w-12 shrink-0 grid-rows-4 overflow-hidden rounded-xl border border-border bg-card" aria-label="창모드 기능">
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

      <aside className="relative flex w-52 shrink-0 items-center justify-center rounded-xl border border-border bg-card p-5">
        <div className="absolute top-5 right-5 left-5 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">현재 시간 · {currentTimeLabel}</p>
          <RecordStatus working={isLive} />
        </div>
        <FlipDuration seconds={currentSeconds} />
      </aside>
    </div>
  )
}
