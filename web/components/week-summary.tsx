import { formatDuration } from "@/lib/work-data"

interface WeekSummaryProps {
  totalMinutes: number
  currentSeconds: number
  currentHour: number
  isLive: boolean
}

export function WeekSummary({ totalMinutes, currentSeconds, currentHour, isLive }: WeekSummaryProps) {
  const dailyAverage = totalMinutes / 7

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
      <Stat
        label={`현재 시간 · ${currentHour}시`}
        value={currentSeconds > 0 ? formatDuration(currentSeconds / 60) : "0분"}
        emphasis
        live={isLive}
        className="col-span-2 sm:col-span-1"
      />
      <Stat
        label="주간 합계"
        value={totalMinutes > 0 ? formatDuration(totalMinutes) : "0분"}
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
  live,
  className = "",
}: {
  label: string
  value: string
  emphasis?: boolean
  live?: boolean
  className?: string
}) {
  return (
    <div className={`bg-card p-4 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium tracking-normal text-muted-foreground">{label}</p>
        {live && <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />기록 중</span>}
      </div>
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
