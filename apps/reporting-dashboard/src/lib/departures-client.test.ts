import assert from "node:assert/strict"
import { test } from "node:test"
import { loadDepartureWeeks } from "./departures-client"

test("calendar navigation requests both selected and following weeks through same-origin route without secrets", async () => {
  const urls: string[] = []
  const signal = new AbortController().signal
  await loadDepartureWeeks("2026-10-05", signal, async (url, init) => {
    urls.push(String(url))
    assert.equal(init?.signal, signal)
    assert.equal(init?.cache, "no-store")
    assert.equal(init?.headers, undefined)
    return Response.json({ complete: true })
  })
  assert.deepEqual(urls, [
    "/api/reporting/departures?out_from=2026-10-05&out_to=2026-10-11",
    "/api/reporting/departures?out_from=2026-10-12&out_to=2026-10-18",
  ])
})

test("client retains validated incomplete source evidence returned by the local route", async () => {
  const pair = await loadDepartureWeeks("2026-10-05", new AbortController().signal, async (url) => {
    const params = new URL(String(url), "http://localhost").searchParams
    return Response.json({ status: "incomplete", complete: false,
      period: { out_from: params.get("out_from"), out_to: params.get("out_to"), time_zone: "America/New_York" },
      reconciliation: { schedule_teams_count: 4, combined_distinct_total: null }, truck_sets: { combined: null },
    }, { status: 502 })
  })
  assert.equal(pair.thisWeek.reconciliation.schedule_teams_count, 4)
  assert.equal(pair.thisWeek.reconciliation.combined_distinct_total, null)
})

test("failed client week request cannot produce a zero or schedule-only total", async () => {
  const pair = await loadDepartureWeeks("2026-10-05", new AbortController().signal, async () => new Response("upstream error", { status: 502 }))
  assert.equal(pair.thisWeek.complete, false)
  assert.equal(pair.thisWeek.reconciliation.combined_distinct_total, null)
  assert.equal(pair.nextWeek.reconciliation.combined_distinct_total, null)
})
