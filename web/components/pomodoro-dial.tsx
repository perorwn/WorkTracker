"use client"

import { useEffect, useRef, useState } from "react"

interface PomodoroDialProps {
  remaining: number
  running: boolean
  onSetDuration: (seconds: number) => void
  onToggle: () => void
}

export function PomodoroDial({ remaining, running, onSetDuration, onToggle }: PomodoroDialProps) {
  const dialRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const [draftSeconds, setDraftSeconds] = useState(remaining)

  useEffect(() => {
    if (!dragging) setDraftSeconds(remaining)
  }, [remaining, dragging])

  const updateFromPointer = (clientX: number, clientY: number) => {
    if (running || !dialRef.current) return null
    const bounds = dialRef.current.getBoundingClientRect()
    const x = clientX - (bounds.left + bounds.width / 2)
    const y = clientY - (bounds.top + bounds.height / 2)
    const angle = (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360
    const next = Math.min(60, Math.round(angle / 6)) * 60
    setDraftSeconds(next)
    return next
  }

  const displaySeconds = dragging ? draftSeconds : remaining
  const displayMinutes = Math.ceil(displaySeconds / 60)
  const fillDegrees = Math.max(0, Math.min(360, displaySeconds / 10))

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2">
      <p className="text-[11px] font-medium text-muted-foreground">뽀모도로</p>
      <div
        ref={dialRef}
        role="slider"
        tabIndex={0}
        aria-label="뽀모도로 시간"
        aria-valuemin={0}
        aria-valuemax={60}
        aria-valuenow={displayMinutes}
        className={`pomodoro-dial${running ? " cursor-default" : " cursor-grab active:cursor-grabbing"}`}
        style={{ "--pomodoro-fill": `${fillDegrees}deg` } as React.CSSProperties}
        onPointerDown={(event) => {
          if (running) return
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
          if (running || !["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"].includes(event.key)) return
          event.preventDefault()
          const direction = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1
          const next = Math.max(0, Math.min(60, displayMinutes + direction)) * 60
          setDraftSeconds(next)
          onSetDuration(next)
        }}
      >
        <span className="pomodoro-mark pomodoro-mark-top">0</span>
        <span className="pomodoro-mark pomodoro-mark-right">15</span>
        <span className="pomodoro-mark pomodoro-mark-bottom">30</span>
        <span className="pomodoro-mark pomodoro-mark-left">45</span>
        <span className="pomodoro-knob">
          <strong className="font-mono text-xl tabular-nums">{String(displayMinutes).padStart(2, "0")}</strong>
          <small>분</small>
        </span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={!running && displaySeconds <= 0}
        className="min-w-20 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
      >
        {running ? "일시정지" : "시작"}
      </button>
    </div>
  )
}
