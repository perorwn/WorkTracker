"use client"

import { Moon, Sun } from "lucide-react"

export type Theme = "light" | "dark"

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const nextLabel = theme === "light" ? "어두운 테마" : "밝은 테마"
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${nextLabel}로 전환`}
      title={nextLabel}
      className="fixed right-4 bottom-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  )
}
