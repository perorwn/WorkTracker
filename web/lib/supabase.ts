export interface WorkRow { date: string; hour: number; seconds: number }

// Browser-safe publishable key from the existing graph.html. Never use a secret key here.
const URL_ROOT = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hmaicgmzobzolwydkysc.supabase.co"
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_N51dEQq1SRYJrKrgH79zOA_ZnnQ7juR"

export async function fetchWorkRows(start: string, end: string, signal: AbortSignal): Promise<WorkRow[]> {
  const result: WorkRow[] = []
  let offset = 0
  // Continue until empty, including servers with a row cap below our page size.
  while (true) {
    const url = new URL(`${URL_ROOT}/rest/v1/work_time`)
    url.searchParams.set("select", "date,hour,seconds")
    url.searchParams.append("date", `gte.${start}`)
    url.searchParams.append("date", `lte.${end}`)
    url.searchParams.set("order", "date.asc,hour.asc")
    url.searchParams.set("limit", "1000")
    url.searchParams.set("offset", String(offset))
    const response = await fetch(url, {
      headers: { apikey: PUBLIC_KEY }, signal, cache: "no-store",
    })
    if (!response.ok) throw new Error(`기록을 불러오지 못했습니다 (${response.status}).`)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows)) throw new Error("기록 응답 형식이 올바르지 않습니다.")
    if (!rows.length) break
    for (const row of rows) {
      if (typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
          !Number.isInteger(row.hour) || row.hour < 0 || row.hour > 23 ||
          typeof row.seconds !== "number" || !Number.isFinite(row.seconds) || row.seconds < 0) {
        throw new Error("기록에 잘못된 날짜 또는 작업 시간이 있습니다.")
      }
      result.push(row)
    }
    offset += rows.length
  }
  return result
}
