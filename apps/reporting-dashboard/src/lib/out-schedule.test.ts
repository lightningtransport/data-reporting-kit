import assert from "node:assert/strict"
import { test } from "node:test"
import { getOutSchedule, SCHEDULE_TEAMS_URL } from "./out-schedule"

test("live table preserves exact Ninox URL with no redirects or credentials and bounded fetch", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, SCHEDULE_TEAMS_URL)
    assert.equal(url, "https://lightningtransport.ninoxdb.com/share/p10ce94o8paa2q4a1z4nw0emznn2ubhriza6?locale=en&utcoffset=-240")
    assert.equal(init.redirect, "error")
    assert.equal(init.credentials, "omit")
    assert.ok(init.signal)
    assert.equal(new Headers(init.headers).get("x-agent-key"), null)
    return Response.json([{ Truck: 10, "Out Date": "2026-10-05", "Driver 1": "A", "Driver 2": "B" }])
  })
  const result = await getOutSchedule()
  assert.equal(result.meta.live, true)
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].driver2, "B")
})
