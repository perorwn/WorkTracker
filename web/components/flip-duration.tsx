"use client"

import { useEffect, useState } from "react"

function FlipDigit({ digit, small = false }: { digit: string; small?: boolean }) {
  const [shown, setShown] = useState(digit)
  const [previous, setPrevious] = useState(digit)
  const [sequence, setSequence] = useState(0)

  useEffect(() => {
    if (digit === shown) return
    setPrevious(shown)
    setShown(digit)
    setSequence((value) => value + 1)
  }, [digit, shown])

  return (
    <span className={`split-flap-digit${small ? " split-flap-digit-small" : ""}`} aria-hidden="true">
      <span className="split-flap-half split-flap-top"><span>{shown}</span></span>
      <span className="split-flap-half split-flap-bottom"><span>{shown}</span></span>
      {sequence > 0 && (
        <>
          <span key={`fold-${sequence}`} className="split-flap-half split-flap-top split-flap-fold"><span>{previous}</span></span>
          <span key={`unfold-${sequence}`} className="split-flap-half split-flap-bottom split-flap-unfold"><span>{shown}</span></span>
        </>
      )}
    </span>
  )
}

function Separator({ children, small = false }: { children: string; small?: boolean }) {
  return <span className={`split-flap-colon${small ? " split-flap-colon-small" : ""}`} aria-hidden="true">{children}</span>
}

export function FlipDuration({ seconds, showHours = false, small = false }: { seconds: number; showHours?: boolean; small?: boolean }) {
  const bounded = Math.max(0, Math.min(showHours ? 359999 : 3599, Math.floor(seconds)))
  const hours = Math.floor(bounded / 3600)
  const minutes = Math.floor((bounded % 3600) / 60)
  const remainingSeconds = bounded % 60
  const value = `${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}${String(remainingSeconds).padStart(2, "0")}`
  const groups = showHours ? [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)] : [value.slice(2, 4), value.slice(4, 6)]

  return (
    <div
      className="flex items-center justify-center gap-1.5"
      role="timer"
      aria-label={`${hours ? `${hours}시간 ` : ""}${minutes}분 ${remainingSeconds}초`}
    >
      {groups.map((group, groupIndex) => (
        <span key={groupIndex} className="contents">
          {groupIndex > 0 && <Separator small={small}>:</Separator>}
          <FlipDigit digit={group[0]} small={small} />
          <FlipDigit digit={group[1]} small={small} />
        </span>
      ))}
    </div>
  )
}

export function FlipDate({ date }: { date: Date }) {
  const value = `${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`
  const weekday = date.toLocaleDateString("ko-KR", { weekday: "short" })
  return (
    <div className="flex items-center gap-1.5" aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일 ${weekday}`}>
      <FlipDigit digit={value[0]} small />
      <FlipDigit digit={value[1]} small />
      <Separator small>.</Separator>
      <FlipDigit digit={value[2]} small />
      <FlipDigit digit={value[3]} small />
      <span className="ml-1 text-xs font-medium text-muted-foreground" aria-hidden="true">{weekday}</span>
    </div>
  )
}
