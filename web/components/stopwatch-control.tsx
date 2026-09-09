"use client"

import { useEffect, useState } from "react"
import { Pause, Play, RotateCcw } from "lucide-react"

export interface StopwatchState {
  elapsed: number
  running: boolean
  startedAt: number | null
  baseElapsed: number
}

interface StopwatchControlProps {
  stopwatch: StopwatchState
  onToggle: () => void
  onReset: () => void
}

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return [hours, minutes, seconds % 60]
    .map((value) => String(value).padStart(2, "0"))
    .join(":")
}

export function StopwatchControl({ stopwatch, onToggle, onReset }: StopwatchControlProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!stopwatch.running || stopwatch.startedAt === null) return
    let frame = 0
    const tick = () => {
      setNow(Date.now())
      frame = window.requestAnimationFrame(tick)
    }
    tick()
    return () => window.cancelAnimationFrame(frame)
  }, [stopwatch.running, stopwatch.startedAt])

  const elapsed = stopwatch.running && stopwatch.startedAt !== null
    ? stopwatch.baseElapsed + (now - stopwatch.startedAt) / 1000
    : stopwatch.elapsed

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <p className="absolute top-0 left-0 text-[11px] font-medium text-muted-foreground">스톱워치</p>
      <strong className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {formatTime(elapsed)}
      </strong>
      <button
        type="button"
        onClick={onReset}
        disabled={stopwatch.elapsed <= 0 && !stopwatch.running}
        title="초기화"
        aria-label="스톱워치 초기화"
        className="absolute bottom-0 left-0 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onToggle}
        title={stopwatch.running ? "일시정지" : "시작"}
        aria-label={stopwatch.running ? "스톱워치 일시정지" : "스톱워치 시작"}
        className="absolute right-0 bottom-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
      >
        {stopwatch.running ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden /> : <Play className="h-4 w-4" fill="currentColor" aria-hidden />}
      </button>
    </div>
  )
}
