import assert from "node:assert/strict"
import { test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime"
import { DashboardChrome } from "./dashboard-shell"
import { OutScheduleDashboard } from "./out-schedule-dashboard"
import { unavailableDepartureWeek } from "../lib/departures"
import type { OutSchedulePayload } from "../lib/out-schedule"
import type { TrucksCurrentlyOutPayload } from "../lib/trucks-currently-out"

const data: OutSchedulePayload = {
  rows: [{ id: "1", truck: "10", outDate: "2026-10-05", day: "Monday", team: "A", driver2: "B", owner: "CDT", dispatch: "Dispatch", flatbed: "No", solo: "No" }],
  meta: { as_of: "2026-10-05T12:00:00Z", source_freshness: "live", total_count: 1, fetched_count: 1, pagination_complete: true, live: true, dataset: "Schedule_Teams", filters: {} },
}
const currentlyOut: TrucksCurrentlyOutPayload = { count: 7, meta: { ...data.meta, filters: { on_road_at: "2026-10-05" } } }

test("Out Schedule integrates union KPIs and explicitly labels filters, day strip and table as source-only", () => {
  const from = "2026-10-05"
  const thisWeek = unavailableDepartureWeek(from, "2026-10-11")
  thisWeek.complete = true
  thisWeek.status = "complete"
  thisWeek.reconciliation.combined_distinct_total = 17
  const html = renderToStaticMarkup(
    <PathnameContext.Provider value="/out-schedule"><DashboardChrome>
      <OutScheduleDashboard data={data} currentlyOut={currentlyOut} initialMonday={from} initialDepartureWeeks={{ thisWeek, nextWeek: unavailableDepartureWeek("2026-10-12", "2026-10-18") }} />
    </DashboardChrome></PathnameContext.Provider>
  )
  assert.match(html, />17</)
  assert.match(html, /Leaving selected week/)
  assert.match(html, /Schedule_Teams-only filters/)
  assert.match(html, /Schedule_Teams-only day strip/)
  assert.match(html, /Schedule_Teams-only planned departures/)
  assert.match(html, /do not filter the combined departure KPIs/)
  assert.doesNotMatch(html, /KPIs and table use distinct trucks after collapsing/)
})
