import assert from "node:assert/strict"
import { test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DepartureKpis } from "./departure-kpis"
import type { DepartureReport } from "../lib/departures"

function report(from: string, to: string, total: number | null): DepartureReport {
  return {
    status: total === null ? "incomplete" : "complete", complete: total !== null,
    period: { out_from: from, out_to: to, time_zone: "America/New_York" },
    reconciliation: { driver_pay_count: 8, schedule_teams_count: 5, driver_pay_only_count: 6, schedule_teams_only_count: 3, overlap_count: 2, combined_distinct_total: total },
    truck_sets: { driver_pay: null, schedule_teams: null, driver_pay_only: null, schedule_teams_only: null, overlap: null, combined: null },
  }
}

test("departure cards show governed union, both source counts and reconciliation, not schedule count", () => {
  const html = renderToStaticMarkup(<DepartureKpis thisWeek={report("2026-09-28", "2026-10-04", 11)} nextWeek={report("2026-10-05", "2026-10-11", 12)} />)
  assert.match(html, /Leaving selected week/)
  assert.match(html, /Leaving following week/)
  assert.match(html, />11</)
  assert.match(html, />12</)
  assert.match(html, /DriverPay: 8/)
  assert.match(html, /Schedule_Teams: 5/)
  assert.match(html, /Overlap: 2/)
  assert.match(html, /DriverPay-only: 6/)
  assert.match(html, /Schedule-only: 3/)
})

test("incomplete departure source renders unavailable, never partial source as total", () => {
  const html = renderToStaticMarkup(<DepartureKpis thisWeek={report("2026-09-28", "2026-10-04", null)} nextWeek={null} />)
  assert.match(html, /Unavailable/)
  assert.match(html, /Loading/)
  assert.match(html, /Both sources required/)
})
