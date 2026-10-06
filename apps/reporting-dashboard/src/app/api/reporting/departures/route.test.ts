import assert from "node:assert/strict"
import { test } from "node:test"
import { GET } from "./route"

test("departures route rejects unsupported filters before touching upstream", async () => {
  const reply = await GET(new Request("http://localhost/api/reporting/departures?out_from=2026-10-05&out_to=2026-10-11&owner=CDT"))
  assert.equal(reply.status, 400)
  assert.equal(reply.headers.get("Cache-Control"), "no-store")
})

test("departures route missing server configuration returns incomplete nullable total", async () => {
  const old = process.env.AGENT_REPORTING_KEY
  delete process.env.AGENT_REPORTING_KEY
  try {
    const reply = await GET(new Request("http://localhost/api/reporting/departures?out_from=2026-10-05&out_to=2026-10-11"))
    assert.equal(reply.status, 502)
    assert.equal(reply.headers.get("Cache-Control"), "no-store")
    const payload = await reply.json()
    assert.equal(payload.complete, false)
    assert.equal(payload.reconciliation.combined_distinct_total, null)
    assert.equal(payload.period.out_from, "2026-10-05")
  } finally {
    if (old !== undefined) process.env.AGENT_REPORTING_KEY = old
  }
})
