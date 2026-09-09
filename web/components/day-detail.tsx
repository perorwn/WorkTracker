"use client"

import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DAY_LABELS_FULL,
  HEAT_CLASS,
  addDays,
  dailyIntensityLevel,
  dayTotalMinutes,
  formatDuration,
  formatHour,
  type WeekData,
} from "@/lib/work-data"

type SelectedCell = { day: number; hour: number } | null

interface DayDetailProps {
  data: WeekData
  weekStart: Date
  selected: SelectedCell
}

export function DayDetail({ data, weekStart, selected }: DayDetailProps) {
  if (!selected) {
    return (
      <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-6 text-center">
        <CalendarDays className="h-5 w-5 text-muted-foreground/50" />
        <p className="max-w-[16rem] text-sm text-muted-foreground text-balance">
          시간대를 선택해 기록을 확인하세요.
        </p>
      </div>
    )
  }

  const dayTotal = dayTotalMinutes(data, selected.day)
  const level = dailyIntensityLevel(dayTotal)
  const hourMinutes = data[selected.day]?.[selected.hour] ?? 0
  const date = addDays(weekStart, selected.day)
  const dateLabel = date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  })

  return (
    <div className="flex h-full flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-normal text-muted-foreground">
            {DAY_LABELS_FULL[selected.day]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{dateLabel}</p>
        </div>
        <span
          className={cn(
            "h-10 w-10 shrink-0 rounded-lg",
            HEAT_CLASS[level],
            level === 0 && "border border-border",
          )}
          aria-hidden
        />
      </div>

      <div>
        <p className="text-[11px] font-medium tracking-normal text-muted-foreground">
          선택 시간&nbsp;
          <span className="font-mono normal-case tracking-normal text-foreground">
            {formatHour(selected.hour)}
          </span>
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
          {hourMinutes > 0 ? formatDuration(hourMinutes) : "0분"}
        </p>
      </div>

      <div className="h-px bg-border" />

      <div className="mt-auto flex items-center justify-between">
        <p className="text-xs text-muted-foreground">일간 합계</p>
        <p className="text-sm font-medium tabular-nums text-foreground">
          {dayTotal > 0 ? formatDuration(dayTotal) : "—"}
        </p>
      </div>
    </div>
  )
}
