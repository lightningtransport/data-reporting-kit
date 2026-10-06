import "server-only"
import { fetchDepartureWeek, parseDepartureRange } from "@/lib/departures-gateway"
import { unavailableDepartureWeek } from "@/lib/departures"

export async function getDepartureWeek(outFrom: string, outTo: string) {
  const key = process.env.AGENT_REPORTING_KEY
  if (!key || !parseDepartureRange(new URLSearchParams({ out_from: outFrom, out_to: outTo }))) return unavailableDepartureWeek(outFrom, outTo)
  return fetchDepartureWeek(outFrom, outTo, {
    key,
    endpoint: process.env.AGENT_REPORTING_ENDPOINT || "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting",
  })
}
