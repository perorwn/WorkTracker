"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  HEAT_CLASS,
  dailyIntensityLevel,
  formatDuration,
  formatFullDate,
  isSameDay,
  mondayIndex,
  type ContributionDay,
} from "@/lib/work-data"

type Cell = ContributionDay | null

const WEEKDAY_LABELS = ["월", "", "수", "", "금", "", ""]

interface ContributionGraphProps {
  data: ContributionDay[]
  onSelectDate?: (date: Date) => void
  selectedDate?: Date | null
}

export function ContributionGraph({
  data,
  onSelectDate,
  selectedDate,
}: ContributionGraphProps) {
  const { weeks, monthLabels, total } = useMemo(() => {
    const cells: Cell[] = []
    // Pad the front so the first column starts on a Monday row.
    const offset = data.length > 0 ? mondayIndex(data[0].date) : 0
    for (let i = 0; i < offset; i++) cells.push(null)
    for (const d of data) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    const weeks: Cell[][] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

    // Align each month with the week containing its first day.
    const monthLabels: { col: number; label: string }[] = []
    let lastLabelCol = -3
    weeks.forEach((week, col) => {
      const firstReal = week.find((c): c is ContributionDay => c !== null)
      if (!firstReal) return
      const monthStart = week.find((c) => c?.date.getDate() === 1)
      if (col === 0 || monthStart) {
        if (col - lastLabelCol < 4) return
        monthLabels.push({
          col,
          label: (monthStart ?? firstReal).date.toLocaleDateString("ko-KR", { month: "short" }),
        })
        lastLabelCol = col
      }
    })

    const total = data.reduce((sum, d) => sum + d.minutes, 0)
    return { weeks, monthLabels, total }
  }, [data])

  return (
    <section
      aria-label="최근 1년 작업 기록"
      className="rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium text-foreground">최근 1년</h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          합계 {formatDuration(total)}
        </p>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-flex w-max flex-col gap-1.5 pr-6 [--dot:11px]">
          {/* Month axis */}
          <div className="relative ml-[35px] h-4">
            {monthLabels.map(({ col, label }) => (
              <span
                key={`${col}-${label}`}
                className="absolute top-0 w-max whitespace-nowrap text-[10px] leading-none text-muted-foreground"
                style={{ left: `calc(${col} * (var(--dot) + 3px))` }}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {/* Weekday axis */}
            <div className="mr-1 flex w-7 shrink-0 flex-col gap-[3px]">
              {WEEKDAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="flex h-[var(--dot)] items-center text-[9px] leading-none text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {weeks.map((week, col) => (
              <div key={col} className="flex flex-col gap-[3px]">
                {week.map((cell, row) => {
                  if (!cell) {
                    return (
                      <div
                        key={row}
                        className="h-[var(--dot)] w-[var(--dot)]"
                        aria-hidden
                      />
                    )
                  }
                  const level = dailyIntensityLevel(cell.minutes)
                  const isSelected =
                    selectedDate != null && isSameDay(cell.date, selectedDate)
                  return (
                    <button
                      key={row}
                      type="button"
                      onClick={() => onSelectDate?.(cell.date)}
                      title={`${formatFullDate(cell.date)} — ${
                        cell.minutes > 0 ? formatDuration(cell.minutes) : "기록 없음"
                      }`}
                      aria-label={`${formatFullDate(cell.date)}, ${
                        cell.minutes > 0 ? formatDuration(cell.minutes) : "기록 없음"
                      }`}
                      className={cn(
                        "h-[var(--dot)] w-[var(--dot)] rounded-[2px] transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
                        HEAT_CLASS[level],
                        level === 0 && "border border-border/60",
                        isSelected &&
                          "ring-2 ring-ring ring-offset-1 ring-offset-card",
                      )}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>적음</span>
        <div className="flex items-center gap-[3px]">
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={cn(
                "h-3 w-3 rounded-[2px]",
                HEAT_CLASS[level],
                level === 0 && "border border-border/60",
              )}
            />
          ))}
        </div>
        <span>많음</span>
      </div>
    </section>
  )
}
