"use client"

import { useEffect, useState } from "react"
import { Minus, X } from "lucide-react"

export function WindowTitlebar() {
  const [native, setNative] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    setNative(window.location.origin === "http://127.0.0.1:8765" && new URLSearchParams(window.location.search).get("native") === "1")
  }, [])

  const control = async (action: "titlebar-ready" | "move" | "minimize" | "close") => {
    try {
      const response = await fetch("/window", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!response.ok) throw new Error("window control unavailable")
      setError(false)
    } catch { setError(true) }
  }

  useEffect(() => {
    if (!native) return
    // Hide the OS caption only after this replacement is mounted.
    void control("titlebar-ready")
  }, [native])

  if (!native) return null
  return (
    <div className="window-titlebar-zone fixed inset-x-0 top-0 z-[100] h-3">
      <div className="window-titlebar flex h-9 items-center border-b border-border bg-card text-foreground shadow-sm" role="toolbar" aria-label="창 제어">
        <div className="flex h-full flex-1 cursor-move select-none items-center px-4 text-xs font-medium"
          onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); void control("move") } }}>
          WORK TRACKER
          {error && <span role="status" className="ml-3 text-muted-foreground">측정 프로그램을 다시 실행해주세요</span>}
        </div>
        <button type="button" onClick={() => void control("minimize")} aria-label="창 최소화" title="최소화" className="flex h-9 w-11 items-center justify-center hover:bg-muted focus-visible:bg-muted"><Minus className="h-4 w-4" /></button>
        <button type="button" onClick={() => void control("close")} aria-label="창 닫기" title="닫기" className="flex h-9 w-11 items-center justify-center hover:bg-destructive hover:text-white focus-visible:bg-destructive"><X className="h-4 w-4" /></button>
      </div>
    </div>
  )
}
