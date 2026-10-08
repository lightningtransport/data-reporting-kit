import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime"
import { DashboardChrome } from "./dashboard-shell"
import { TrucksReturnDashboard } from "./trucks-return-dashboard"
import type { ReturnsPayload } from "../lib/returns"
import type { TrucksCurrentlyOutPayload } from "../lib/trucks-currently-out"

const meta = { as_of: "2026-10-08T12:00:00Z", source_freshness: "synthetic fixture", total_count: 0, fetched_count: 0, pagination_complete: true, live: true, dataset: "synthetic", filters: {} }
const data: ReturnsPayload = { rows: [], meta: { ...meta, distinct_trucks: 0 } }
function render(currentlyOut: TrucksCurrentlyOutPayload) {
  return renderToStaticMarkup(<PathnameContext.Provider value="/trucks-return"><DashboardChrome><TrucksReturnDashboard data={data} currentlyOut={currentlyOut} /></DashboardChrome></PathnameContext.Provider>)
}

test("Trucks Return current working KPI names the live source and preserves unavailable vs zero", () => {
  const current: TrucksCurrentlyOutPayload = { count: 7, meta: { ...meta, dataset: "live_ninox_on_road", fetch_started_at: "2026-10-08T11:59:59Z", filters: { source_url: "https://synthetic.invalid/on-road", Status: "On The Road Working" } } }
  const html = render(current)
  assert.match(html, /Live Ninox · working membership/)
  assert.doesNotMatch(html, /On road today \(DriverPay\)|active date interval|on_road_at=/)
  const failed = render({ count: null, meta: { ...current.meta, error: "Unavailable", live: false, pagination_complete: false, total_count: null, fetched_count: null } })
  assert.match(failed, /Live on-road source unavailable/)
  assert.doesNotMatch(failed, />null</)
  const empty = render({ ...current, count: 0 })
  assert.match(empty, /Live Ninox · working membership/)
})
