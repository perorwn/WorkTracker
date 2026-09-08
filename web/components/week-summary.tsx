import { formatDuration } from "@/lib/work-data"

interface WeekSummaryProps {
  totalMinutes: number
}

export function WeekSummary({ totalMinutes }: WeekSummaryProps) {
  const dailyAverage = totalMinutes / 7

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
      <Stat
        label="주간 합계"
        value={totalMinutes > 0 ? formatDuration(totalMinutes) : "0분"}
        emphasis
      />
      <Stat
        label="일평균"
        value={dailyAverage > 0 ? formatDuration(dailyAverage) : "—"}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="bg-card p-4 sm:p-5">
      <p className="text-[11px] font-medium tracking-normal text-muted-foreground">
        {label}
      </p>
      <p
        className={
          emphasis
            ? "mt-2 text-2xl font-semibold tabular-nums text-foreground"
            : "mt-2 text-2xl font-semibold tabular-nums text-foreground/90"
        }
      >
        {value}
      </p>
    </div>
  )
}
