import { getDepartureWeek } from "@/lib/departures-server"
import { parseDepartureRange } from "@/lib/departures-gateway"

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const range = parseDepartureRange(new URL(request.url).searchParams)
  if (!range) return Response.json({ error: "Use only out_from and out_to: valid YYYY-MM-DD dates, inclusive range up to 31 days" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const report = await getDepartureWeek(range.outFrom, range.outTo)
  return Response.json(report, { status: report.complete ? 200 : 502, headers: { "Cache-Control": "no-store" } })
}
