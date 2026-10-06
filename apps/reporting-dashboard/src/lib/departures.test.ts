import assert from "node:assert/strict"
import { test } from "node:test"
import { fetchDepartureWeek, parseDepartureRange } from "./departures-gateway.ts"

const period = { out_from: "2026-09-28", out_to: "2026-10-04", time_zone: "America/New_York" }
const fixture = {
  count: 1, page_count: 1, total_count: 1, // Aggregate rows, never truck totals.
  status: "complete", complete: true, period,
  reconciliation: { driver_pay_count: 2, schedule_teams_count: 2, driver_pay_only_count: 1, schedule_teams_only_count: 1, overlap_count: 1, combined_distinct_total: 3 },
  truck_sets: { driver_pay: ["10", "20"], schedule_teams: ["20", "30"], driver_pay_only: ["10"], schedule_teams_only: ["30"], overlap: ["20"], combined: ["10", "20", "30"] },
  as_of: "2026-10-04T12:00:00Z", source_freshness: "live schedule; DriverPay sync unknown",
  source_status: { driver_pay: { status: "complete", error: null }, schedule_teams: { status: "complete", error: null } },
}

test("departure week preserves governed union and sends only same Out Date window", async () => {
  let called = false
  const result = await fetchDepartureWeek(period.out_from, period.out_to, {
    endpoint: "https://example.test/reporting", key: "test-key",
    fetcher: async (url, init) => {
      called = true
      const params = new URL(String(url)).searchParams
      assert.deepEqual(Object.fromEntries(params), { report: "departures", out_from: period.out_from, out_to: period.out_to })
      assert.equal(new Headers(init?.headers).get("x-agent-key"), "test-key")
      assert.equal(init?.redirect, "error")
      assert.equal(init?.cache, "no-store")
      assert.ok(init?.signal)
      return Response.json(fixture)
    },
  })
  assert.ok(called)
  assert.equal(result.reconciliation.combined_distinct_total, 3)
  assert.deepEqual(result.truck_sets, fixture.truck_sets)
  assert.equal(result.complete, true)
  assert.equal(result.source_status?.driver_pay.status, "complete")
  assert.equal(result.source_status?.schedule_teams.status, "complete")
})

test("source failure never becomes a schedule-only total or leaks upstream details", async () => {
  for (const reply of [
    Response.json({ ...fixture, status: "incomplete", complete: false, reconciliation: { ...fixture.reconciliation, combined_distinct_total: 2 } }),
    Response.json({ secret: "test-key" }, { status: 403 }),
  ]) {
    const result = await fetchDepartureWeek(period.out_from, period.out_to, {
      endpoint: "https://example.test/reporting", key: "test-key", fetcher: async () => reply,
    })
    assert.equal(result.complete, false)
    assert.equal(result.reconciliation.combined_distinct_total, null)
    assert.equal(result.truck_sets.combined, null)
    assert.ok(!JSON.stringify(result).includes("test-key"))
  }
})

test("upstream 503 preserves known source evidence but never a combined total", async () => {
  const payload = {
    ...fixture, status: "incomplete", complete: false,
    reconciliation: { driver_pay_count: null, schedule_teams_count: 2, driver_pay_only_count: null, schedule_teams_only_count: null, overlap_count: null, combined_distinct_total: null },
    truck_sets: { driver_pay: null, schedule_teams: ["20", "30"], driver_pay_only: null, schedule_teams_only: null, overlap: null, combined: null },
  }
  const result = await fetchDepartureWeek(period.out_from, period.out_to, {
    endpoint: "https://example.test/reporting", key: "test-key", fetcher: async () => Response.json(payload, { status: 503 }),
  })
  assert.equal(result.reconciliation.schedule_teams_count, 2)
  assert.equal(result.reconciliation.combined_distinct_total, null)
  assert.equal(result.complete, false)
})

test("complete response must match requested period and reconciled sets; unknown fields are not forwarded", async () => {
  for (const payload of [
    { ...fixture, period: { ...period, out_from: "2026-09-21" } },
    { ...fixture, reconciliation: { ...fixture.reconciliation, combined_distinct_total: 99 } },
    { ...fixture, truck_sets: { ...fixture.truck_sets, combined: ["10", "20", "20"] } },
  ]) {
    const result = await fetchDepartureWeek(period.out_from, period.out_to, {
      endpoint: "https://example.test/reporting", key: "test-key", fetcher: async () => Response.json(payload),
    })
    assert.equal(result.complete, false)
    assert.equal(result.reconciliation.combined_distinct_total, null)
  }
  const result = await fetchDepartureWeek(period.out_from, period.out_to, {
    endpoint: "https://example.test/reporting", key: "test-key", fetcher: async () => Response.json({ ...fixture, credentials: "test-key" }),
  })
  assert.ok(!JSON.stringify(result).includes("test-key"))
})

test("route date range rejects duplicate, unknown, invalid, reversed and over-31-day filters", () => {
  assert.deepEqual(parseDepartureRange(new URLSearchParams("out_from=2026-10-01&out_to=2026-10-31")), { outFrom: "2026-10-01", outTo: "2026-10-31" })
  for (const query of ["", "out_from=2026-10-01", "out_from=2026-02-30&out_to=2026-03-01", "out_from=2026-10-02&out_to=2026-10-01", "out_from=2026-10-01&out_to=2026-11-01", "out_from=2026-10-01&out_from=2026-10-01&out_to=2026-10-04", "out_from=2026-10-01&out_to=2026-10-04&owner=CDT"]) {
    assert.equal(parseDepartureRange(new URLSearchParams(query)), null, query)
  }
})
