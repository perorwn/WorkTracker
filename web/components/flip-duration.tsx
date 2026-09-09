"use client"

import { useEffect, useState } from "react"

function FlipDigit({ digit }: { digit: string }) {
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
    <span className="split-flap-digit" aria-hidden="true">
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

export function FlipDuration({ seconds }: { seconds: number }) {
  const bounded = Math.max(0, Math.min(3599, Math.floor(seconds)))
  const minutes = Math.floor(bounded / 60)
  const remainingSeconds = bounded % 60
  const value = `${String(minutes).padStart(2, "0")}${String(remainingSeconds).padStart(2, "0")}`

  return (
    <div
      className="flex items-center justify-center gap-1.5"
      role="timer"
      aria-label={`${minutes}분 ${remainingSeconds}초`}
    >
      <FlipDigit digit={value[0]} />
      <FlipDigit digit={value[1]} />
      <span className="split-flap-colon" aria-hidden="true">:</span>
      <FlipDigit digit={value[2]} />
      <FlipDigit digit={value[3]} />
    </div>
  )
}
