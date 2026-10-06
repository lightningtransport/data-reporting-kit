import { addDaysIso } from "@/lib/ops-table"
import { unavailableDepartureWeek, type DepartureReport } from "@/lib/departures"

export type DepartureWeeks = { thisWeek: DepartureReport; nextWeek: DepartureReport }

export async function loadDepartureWeeks(monday: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<DepartureWeeks> {
  async function week(from: string): Promise<DepartureReport> {
    const to = addDaysIso(from, 6)
    try {
      const response = await fetcher(`/api/reporting/departures?${new URLSearchParams({ out_from: from, out_to: to })}`, { signal, cache: "no-store" })
      if (!response.ok && response.status !== 502) return unavailableDepartureWeek(from, to)
      const report = await response.json() as DepartureReport
      if (report.period?.out_from !== from || report.period?.out_to !== to || report.period?.time_zone !== "America/New_York" || !report.reconciliation || !report.truck_sets) return unavailableDepartureWeek(from, to)
      return report
    } catch {
      return unavailableDepartureWeek(from, to)
    }
  }
  const [thisWeek, nextWeek] = await Promise.all([week(monday), week(addDaysIso(monday, 7))])
  return { thisWeek, nextWeek }
}
