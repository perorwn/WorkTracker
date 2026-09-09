"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play, Repeat2 } from "lucide-react"

interface PomodoroDialProps {
  remaining: number
  running: boolean
  endsAt: number | null
  repeat: boolean
  phase: "work" | "break"
  workDuration: number
  breakDuration: number
  onSetDuration: (seconds: number) => void
  onToggle: () => void
  onToggleRepeat: () => void
}

export function PomodoroDial({ remaining, running, endsAt, repeat, phase, workDuration, breakDuration, onSetDuration, onToggle, onToggleRepeat }: PomodoroDialProps) {
  const dialRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const [draftSeconds, setDraftSeconds] = useState(remaining)
  const [now, setNow] = useState(() => Date.now())
  const editable = !running && phase === "work"

  useEffect(() => {
    if (!running || endsAt === null) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [running, endsAt])

  useEffect(() => {
    if (!dragging) setDraftSeconds(remaining)
  }, [remaining, dragging])

  const updateFromPointer = (clientX: number, clientY: number) => {
    if (!editable || !dialRef.current) return null
    const bounds = dialRef.current.getBoundingClientRect()
    const x = clientX - (bounds.left + bounds.width / 2)
    const y = clientY - (bounds.top + bounds.height / 2)
    const angle = (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360
    const next = Math.min(60, Math.round(angle / 6)) * 60
    setDraftSeconds(next)
    return next
  }

  const liveSeconds = running && endsAt !== null
    ? Math.max(0, Math.ceil((endsAt - now) / 1000))
    : remaining
  const displaySeconds = dragging ? draftSeconds : liveSeconds
  const displayMinutes = Math.ceil(displaySeconds / 60)
  const workDegrees = Math.max(0, Math.min(360, workDuration / 10))
  const breakDegrees = Math.max(0, Math.min(360, breakDuration / 10))
  let redDegrees = Math.max(0, Math.min(360, displaySeconds / 10))
  let blueDegrees = 0
  if (repeat && !dragging) {
    if (phase === "work") {
      const ratio = workDuration > 0 ? Math.max(0, Math.min(1, displaySeconds / workDuration)) : 0
      redDegrees = workDegrees * ratio
      blueDegrees = breakDegrees * (1 - ratio)
    } else {
      const ratio = breakDuration > 0 ? Math.max(0, Math.min(1, displaySeconds / breakDuration)) : 0
      redDegrees = workDegrees * (1 - ratio)
      blueDegrees = breakDegrees * ratio
    }
  }
  const blueStart = 360 - blueDegrees
  const clockMinutes = Math.floor(displaySeconds / 60)
  const clockSeconds = Math.floor(displaySeconds % 60)
  const clockLabel = `${String(clockMinutes).padStart(2, "0")}:${String(clockSeconds).padStart(2, "0")}`

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <p className="absolute top-0 left-0 text-[11px] font-medium text-muted-foreground">
        뽀모도로{repeat && <span className={phase === "break" ? "text-primary" : ""}> · {phase === "work" ? "집중" : "휴식"}</span>}
      </p>
      <div
        ref={dialRef}
        role="slider"
        tabIndex={0}
        aria-label="뽀모도로 시간"
        aria-valuemin={0}
        aria-valuemax={60}
        aria-valuenow={displayMinutes}
        className={`pomodoro-dial${editable ? " cursor-grab active:cursor-grabbing" : " cursor-default"}`}
        style={{
          "--pomodoro-red": `${redDegrees}deg`,
          "--pomodoro-blue-start": `${blueStart}deg`,
        } as React.CSSProperties}
        onPointerDown={(event) => {
          if (!editable) return
          event.currentTarget.setPointerCapture(event.pointerId)
          draggingRef.current = true
          setDragging(true)
          updateFromPointer(event.clientX, event.clientY)
        }}
        onPointerMove={(event) => {
          if (draggingRef.current) updateFromPointer(event.clientX, event.clientY)
        }}
        onPointerUp={(event) => {
          if (!draggingRef.current) return
          const next = updateFromPointer(event.clientX, event.clientY)
          draggingRef.current = false
          setDragging(false)
          if (next !== null) onSetDuration(next)
        }}
        onKeyDown={(event) => {
          if (!editable || !["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"].includes(event.key)) return
          event.preventDefault()
          const direction = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1
          const next = Math.max(0, Math.min(60, displayMinutes + direction)) * 60
          setDraftSeconds(next)
          onSetDuration(next)
        }}
      >
        <span className="pomodoro-face" aria-hidden="true" />
        <span className="pomodoro-mark pomodoro-mark-top">0</span>
        <span className="pomodoro-mark pomodoro-mark-right">15</span>
        <span className="pomodoro-mark pomodoro-mark-bottom">30</span>
        <span className="pomodoro-mark pomodoro-mark-left">45</span>
        <span className="pomodoro-knob">
          <strong className="font-mono text-base font-semibold tabular-nums">{clockLabel}</strong>
        </span>
      </div>
      <button
        type="button"
        onClick={onToggleRepeat}
        title={repeat ? "반복 끄기" : "반복 켜기"}
        aria-label={repeat ? "뽀모도로 반복 끄기" : "뽀모도로 반복 켜기"}
        aria-pressed={repeat}
        className={`absolute bottom-0 left-0 flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${repeat ? "border-primary bg-primary/12 text-primary" : "border-border bg-muted text-muted-foreground hover:text-foreground"}`}
      >
        <Repeat2 className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onToggle}
        disabled={!running && displaySeconds <= 0}
        title={running ? "일시정지" : "시작"}
        aria-label={running ? "뽀모도로 일시정지" : "뽀모도로 시작"}
        className="absolute right-0 bottom-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
      >
        {running ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden /> : <Play className="h-4 w-4" fill="currentColor" aria-hidden />}
      </button>
    </div>
  )
}
