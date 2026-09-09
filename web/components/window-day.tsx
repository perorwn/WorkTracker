"use client"

import { cn } from "@/lib/utils"
import { formatDuration, HEAT_CLASS, intensityLevel } from "@/lib/work-data"
import { FlipDate, FlipDuration } from "@/components/flip-duration"

interface WindowDayProps {
  date: Date
  hours: number[]
  currentHour: number
  currentSeconds: number
  isLive: boolean
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

export function WindowDay({ date, hours, currentHour, currentSeconds, isLive }: WindowDayProps) {
  const totalMinutes = hours.reduce((sum, minutes) => sum + minutes, 0)

  return (
    <div className="flex h-screen min-h-[210px] min-w-[980px] items-stretch gap-4 bg-background p-4">
      <section className="flex min-w-0 flex-1 flex-col justify-between rounded-xl border border-border bg-card p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">오늘 기록</p>
            <div className="mt-2"><FlipDate date={date} /></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">합계</span>
            <FlipDuration seconds={totalMinutes * 60} showHours small />
          </div>
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

      <aside className="relative flex w-52 shrink-0 items-center justify-center rounded-xl border border-border bg-card p-5">
        <div className="absolute top-5 right-5 left-5 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">현재 시간 · {currentHour}시</p>
          {isLive && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              기록 중
            </span>
          )}
        </div>
        <FlipDuration seconds={currentSeconds} />
      </aside>
    </div>
  )
}
