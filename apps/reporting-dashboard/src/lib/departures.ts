/** Browser-safe governed departure contract. No return formulas or exclusions. */
export type DeparturePeriod = { out_from: string; out_to: string; time_zone: string }
export type DepartureReport = {
  status: "complete" | "incomplete"
  complete: boolean
  period: DeparturePeriod
  reconciliation: {
    driver_pay_count: number | null
    schedule_teams_count: number | null
    driver_pay_only_count: number | null
    schedule_teams_only_count: number | null
    overlap_count: number | null
    combined_distinct_total: number | null
  }
  truck_sets: {
    driver_pay: string[] | null
    schedule_teams: string[] | null
    driver_pay_only: string[] | null
    schedule_teams_only: string[] | null
    overlap: string[] | null
    combined: string[] | null
  }
  source_status?: { driver_pay: { status: "complete" | "failed" }; schedule_teams: { status: "complete" | "failed" } }
  as_of?: string
  source_freshness?: string
  error?: string
}

export function unavailableDepartureWeek(outFrom: string, outTo: string): DepartureReport {
  return {
    status: "incomplete", complete: false,
    period: { out_from: outFrom, out_to: outTo, time_zone: "America/New_York" },
    reconciliation: { driver_pay_count: null, schedule_teams_count: null, driver_pay_only_count: null, schedule_teams_only_count: null, overlap_count: null, combined_distinct_total: null },
    truck_sets: { driver_pay: null, schedule_teams: null, driver_pay_only: null, schedule_teams_only: null, overlap: null, combined: null },
    error: "Departure union unavailable; both sources are required",
  }
}
