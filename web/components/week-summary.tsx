import { FlipDuration } from "@/components/flip-duration"

interface WeekSummaryProps {
  totalMinutes: number
}

export function WeekSummary({ totalMinutes }: WeekSummaryProps) {
  const dailyAverage = totalMinutes / 7

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
      <Stat
        label="주간 합계"
        seconds={totalMinutes * 60}
        emphasis
      />
      <Stat
        label="일평균"
        seconds={dailyAverage * 60}
      />
    </div>
  )
}

function Stat({
  label,
  seconds,
  emphasis,
}: {
  label: string
  seconds: number
  emphasis?: boolean
}) {
  return (
    <div className="bg-card p-4 sm:p-5">
      <p className="text-[11px] font-medium tracking-normal text-muted-foreground">{label}</p>
      <div className={`mt-3 ${emphasis ? "opacity-100" : "opacity-90"}`}>
        <FlipDuration seconds={seconds} showHours small />
      </div>
    </div>
  )
}
