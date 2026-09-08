"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface WeekNavProps {
  rangeLabel: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  isCurrentWeek: boolean
}

export function WeekNav({ rangeLabel, onPrev, onNext, onToday, isCurrentWeek }: WeekNavProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous week"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={isCurrentWeek}
            aria-label="Next week"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Week of
          </p>
          <p className="font-mono text-sm font-medium text-foreground tabular-nums">
            {rangeLabel}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToday}
        disabled={isCurrentWeek}
        className={cn(
          "rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
          isCurrentWeek
            ? "cursor-default border-border/60 text-muted-foreground/60"
            : "border-border bg-card text-foreground hover:bg-muted",
        )}
      >
        {isCurrentWeek ? "This week" : "Today"}
      </button>
    </div>
  )
}
