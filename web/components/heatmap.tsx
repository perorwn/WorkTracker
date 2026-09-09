"use client"

import { cn } from "@/lib/utils"
import {
  DAY_LABELS,
  HEAT_CLASS,
  addDays,
  intensityLevel,
  formatDuration,
  isSameDay,
  type WeekData,
} from "@/lib/work-data"

type SelectedCell = { day: number; hour: number } | null

interface HeatmapProps {
  data: WeekData
  weekStart: Date
  today: Date
  selected: SelectedCell
  onSelect: (cell: { day: number; hour: number }) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function Heatmap({ data, weekStart, today, selected, onSelect }: HeatmapProps) {
  const todayIndex = DAY_LABELS.findIndex((_, i) => isSameDay(addDays(weekStart, i), today))

  return (
    <div
      className="w-full [--cell:16px] sm:[--cell:18px] lg:[--cell:20px]"
    >
      <div className="flex w-full">
        {/* Hour axis */}
        <div className="flex shrink-0 flex-col gap-[3px] pt-[35px] pr-2">
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex h-[var(--cell)] items-center justify-end font-mono text-[10px] leading-none text-muted-foreground/70 tabular-nums"
            >
              {h % 3 === 0 ? `${String(h).padStart(2, "0")}` : ""}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid flex-1 grid-cols-7 gap-[3px]">
          {DAY_LABELS.map((label, dayIndex) => {
            const isToday = dayIndex === todayIndex
            const isDaySelected = selected?.day === dayIndex
            return (
              <div
                key={label}
                className={cn(
                  "flex flex-col gap-[3px] rounded-md px-0.5 transition-colors",
                  isDaySelected && "bg-accent/60",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 items-center justify-center text-xs font-medium tracking-wide",
                    isDaySelected
                      ? "text-accent-foreground"
                      : isToday
                        ? "text-primary"
                        : "text-muted-foreground",
                  )}
                >
                  <span className="relative">
                    {label}
                    {isToday && (
                      <span className="absolute top-1/2 left-full ml-1.5 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary" aria-hidden />
                    )}
                  </span>
                </div>
                {HOURS.map((hour) => {
                  const minutes = data[dayIndex]?.[hour] ?? 0
                  const level = intensityLevel(minutes)
                  const isSelected =
                    selected?.day === dayIndex && selected?.hour === hour
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => onSelect({ day: dayIndex, hour })}
                      aria-label={`${label} ${String(hour).padStart(2, "0")}:00 — ${formatDuration(minutes)}`}
                      aria-pressed={isSelected}
                      className={cn(
                        "h-[var(--cell)] w-full rounded-[3px] ring-offset-2 ring-offset-background transition-[transform,box-shadow] duration-150 outline-none",
                        HEAT_CLASS[level],
                        level === 0 && "border border-border/60",
                        "hover:scale-[1.12] hover:ring-1 hover:ring-ring/40 focus-visible:ring-2 focus-visible:ring-ring",
                        isToday && "shadow-[inset_0_0_0_1px] shadow-primary/10",
                        isSelected && "scale-[1.12] ring-2 ring-ring",
                      )}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <Legend />
    </div>
  )
}

function Legend() {
  return (
    <div className="mt-6 flex items-center justify-end gap-2 text-xs text-muted-foreground">
      <span>적음</span>
      <div className="flex items-center gap-[3px]">
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={cn(
              "h-3 w-3 rounded-[3px]",
              HEAT_CLASS[level],
              level === 0 && "border border-border/60",
            )}
          />
        ))}
      </div>
      <span>많음</span>
    </div>
  )
}
