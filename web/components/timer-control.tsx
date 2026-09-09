"use client"

import { useEffect, useState } from "react"
import { Pause, Play, RotateCcw } from "lucide-react"

export interface TimerState {
  duration: number
  remaining: number
  running: boolean
  endsAt: number | null
}

interface TimerControlProps {
  timer: TimerState
  onSet: (seconds: number) => void
  onToggle: () => void
  onReset: () => void
}

function splitTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  }
}

function formatTime(totalSeconds: number) {
  const time = splitTime(totalSeconds)
  return [time.hours, time.minutes, time.seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":")
}

export function TimerControl({ timer, onSet, onToggle, onReset }: TimerControlProps) {
  const [now, setNow] = useState(() => Date.now())
  const [draft, setDraft] = useState(() => splitTime(timer.remaining))

  useEffect(() => {
    if (!timer.running) setDraft(splitTime(timer.remaining))
  }, [timer.remaining, timer.running])

  useEffect(() => {
    if (!timer.running || timer.endsAt === null) return
    let frame = 0
    const tick = () => {
      setNow(Date.now())
      frame = window.requestAnimationFrame(tick)
    }
    tick()
    return () => window.cancelAnimationFrame(frame)
  }, [timer.running, timer.endsAt])

  const remaining = timer.running && timer.endsAt !== null
    ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000))
    : timer.remaining

  const updatePart = (part: keyof typeof draft, raw: string) => {
    const maximum = part === "hours" ? 99 : 59
    const value = Math.max(0, Math.min(maximum, Number.parseInt(raw || "0", 10) || 0))
    const next = { ...draft, [part]: value }
    setDraft(next)
    onSet(next.hours * 3600 + next.minutes * 60 + next.seconds)
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <p className="absolute top-0 left-0 text-[11px] font-medium text-muted-foreground">타이머</p>
      {timer.running ? (
        <strong className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          {formatTime(remaining)}
        </strong>
      ) : (
        <div className="flex items-center gap-1.5" aria-label="타이머 시간 설정">
          {(["hours", "minutes", "seconds"] as const).map((part, index) => (
            <div key={part} className="flex items-center gap-1.5">
              {index > 0 && <span className="mb-4 font-mono text-lg text-muted-foreground">:</span>}
              <label className="flex flex-col items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={part === "hours" ? 99 : 59}
                  value={draft[part]}
                  onChange={(event) => updatePart(part, event.target.value)}
                  className="h-12 w-12 rounded-lg border border-border bg-muted/60 text-center font-mono text-lg font-semibold tabular-nums text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  aria-label={part === "hours" ? "시간" : part === "minutes" ? "분" : "초"}
                />
                <span className="text-[9px] text-muted-foreground">
                  {part === "hours" ? "시간" : part === "minutes" ? "분" : "초"}
                </span>
              </label>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onReset}
        disabled={timer.duration <= 0 && timer.remaining <= 0}
        title="초기화"
        aria-label="타이머 초기화"
        className="absolute bottom-0 left-0 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onToggle}
        disabled={!timer.running && remaining <= 0}
        title={timer.running ? "일시정지" : "시작"}
        aria-label={timer.running ? "타이머 일시정지" : "타이머 시작"}
        className="absolute right-0 bottom-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-35"
      >
        {timer.running ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden /> : <Play className="h-4 w-4" fill="currentColor" aria-hidden />}
      </button>
    </div>
  )
}
