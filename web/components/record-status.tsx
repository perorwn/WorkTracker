import { cn } from "@/lib/utils"

export function RecordStatus({ working }: { working: boolean }) {
  return (
    <span className={cn(
      "flex shrink-0 items-center gap-1.5 text-[11px] font-medium",
      working ? "text-emerald-600" : "text-muted-foreground",
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        working ? "bg-emerald-500" : "bg-muted-foreground/50",
      )} />
      {working ? "기록 중" : "대기 중"}
    </span>
  )
}
