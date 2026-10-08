import assert from "node:assert/strict"
import test, { mock } from "node:test"
import { getTrucksCurrentlyOut, isOnRoadAssignment } from "./trucks-currently-out.ts"

test("current on-road KPI uses a credential-free fresh live share, distinct trucks and timestamps", async () => {
  const original = globalThis.fetch
  const requests: {url: string; init: RequestInit}[] = []
  const row = { truck_number: 101, dispatcher: "Synthetic Dispatch", insurance: "Synthetic", owner: "Synthetic Owner", Samsara_Truck_ID: "fake-vehicle", Status: "On The Road Working", Ninox_ID: 1 }
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify([row, { ...row, Ninox_ID: 2 }]), { headers: { "content-type": "application/json" } })
  }
  try {
    const result = await getTrucksCurrentlyOut()
    assert.equal(result.count, 1)
    assert.equal(result.meta.dataset, "live_ninox_on_road")
    assert.equal(result.meta.fetched_count, 2)
    assert.equal(result.meta.pagination_complete, true)
    assert.ok(result.meta.fetch_started_at)
    assert.ok(result.meta.as_of)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, "https://lightningtransport.ninoxdb.com/share/eno5u22ebn2qdn215dpzwn02squ5wsixob8f?locale=en&utcoffset=-240")
    assert.deepEqual(requests[0].init.headers, { Accept: "application/json" })
    assert.equal(requests[0].init.cache, "no-store")
    assert.equal(requests[0].init.redirect, "error")
    assert.equal(requests[0].init.credentials, "omit")
  } finally { globalThis.fetch = original }
})

test("current source rejects non-JSON media types and duplicate JSON keys without fallback", async () => {
  const original = globalThis.fetch
  const row = { truck_number: 101, dispatcher: "Synthetic", insurance: "Synthetic", owner: "Synthetic", Samsara_Truck_ID: "fake", Status: "On The Road Working", Ninox_ID: 1 }
  try {
    for (const [body, type] of [[JSON.stringify([row]), "text/html"], [JSON.stringify([row]).replace('"truck_number":101', '"truck_number":102,"truck_number":101'), "application/json"]]) {
      globalThis.fetch = async () => new Response(body, { headers: { "content-type": type } })
      const result = await getTrucksCurrentlyOut()
      assert.equal(result.count, null)
      assert.equal(result.meta.live, false)
      assert.equal(result.meta.pagination_complete, false)
      assert.ok(result.meta.error)
    }
  } finally { globalThis.fetch = original }
})

test("total on-road deadline includes validation and distinct aggregation", async () => {
  const original = globalThis.fetch
  let calls = 0
  const clock = mock.method(performance, "now", () => [0, 0, 29000, 31000][Math.min(calls++, 3)])
  globalThis.fetch = async () => new Response("[]", { headers: { "content-type": "application/json" } })
  try {
    const result = await getTrucksCurrentlyOut()
    assert.equal(result.count, null)
    assert.equal(result.meta.live, false)
  } finally { clock.mock.restore(); globalThis.fetch = original }
})

test("validate every row, reject drift/invalid keys/status and keep failure distinct from empty", async () => {
  const original = globalThis.fetch
  const row = { truck_number: 101, dispatcher: "Exact Dispatch ", insurance: "Exact", owner: "Exact Owner", Samsara_Truck_ID: "fake", Status: "On The Road Working", Ninox_ID: 1 }
  const missing: Record<string, unknown> = { ...row }
  delete missing.owner
  const invalid: unknown[] = [null, [], missing, { ...row, added: "drift" },
    ...[null, true, "101", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map(truck_number => ({ ...row, truck_number })),
    ...[null, true, "1", 0, 1.5].map(Ninox_ID => ({ ...row, Ninox_ID })),
    ...["On The Road Working ", "Working", null].map(Status => ({ ...row, Status })),
    ...["dispatcher", "insurance", "owner", "Samsara_Truck_ID"].map(key => ({ ...row, [key]: null }))]
  try {
    for (const bad of invalid) {
      globalThis.fetch = async () => new Response(JSON.stringify([row, bad]), { headers: { "content-type": "application/json" } })
      const result = await getTrucksCurrentlyOut()
      assert.equal(result.count, null)
      assert.equal(result.meta.fetched_count, null)
      assert.equal(result.meta.pagination_complete, false)
    }
    for (const body of ["{}", "null", "not JSON", '[{"truck_number":1e999}]']) {
      globalThis.fetch = async () => new Response(body, { headers: { "content-type": "application/json" } })
      assert.equal((await getTrucksCurrentlyOut()).count, null)
    }
    globalThis.fetch = async () => new Response("[]", { headers: { "content-type": "application/json" } })
    const empty = await getTrucksCurrentlyOut()
    assert.equal(empty.count, 0)
    assert.equal(empty.meta.live, true)
    assert.equal(empty.meta.pagination_complete, true)
  } finally { globalThis.fetch = original }
})

test("each answer fetches fresh, deduplicates conflicting trucks and never forwards configured credentials", async () => {
  const original = globalThis.fetch
  const originalKey = process.env.AGENT_REPORTING_KEY
  const originalEndpoint = process.env.AGENT_REPORTING_ENDPOINT
  process.env.AGENT_REPORTING_KEY = "synthetic-never-forward"
  process.env.AGENT_REPORTING_ENDPOINT = "https://gateway.invalid"
  let requests = 0
  const row = { truck_number: 101, dispatcher: "Exact Dispatch ", insurance: "Exact", owner: "Exact Owner", Samsara_Truck_ID: "fake", Status: "On The Road Working", Ninox_ID: 1 }
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /eno5u22ebn2qdn215dpzwn02squ5wsixob8f/)
    assert.deepEqual(init?.headers, { Accept: "application/json" })
    assert.equal(init?.cache, "no-store")
    assert.equal(init?.credentials, "omit")
    assert.ok(init?.signal)
    requests++
    return new Response(JSON.stringify(requests === 1 ? [row, { ...row, owner: "Conflicting Owner", Ninox_ID: 2 }] : []), { headers: { "content-type": "application/json" } })
  }
  try {
    const first = await getTrucksCurrentlyOut()
    assert.equal(first.count, 1)
    assert.equal(first.meta.duplicate_truck_rows, 1)
    assert.equal(first.meta.conflicting_trucks, 1)
    assert.equal((await getTrucksCurrentlyOut()).count, 0)
    assert.equal(requests, 2)
  } finally {
    globalThis.fetch = original
    if (originalKey === undefined) delete process.env.AGENT_REPORTING_KEY
    else process.env.AGENT_REPORTING_KEY = originalKey
    if (originalEndpoint === undefined) delete process.env.AGENT_REPORTING_ENDPOINT
    else process.env.AGENT_REPORTING_ENDPOINT = originalEndpoint
  }
})

test("on-road HTTP, redirect and actual or declared size failures are unknown, never cached/zero", async () => {
  const original = globalThis.fetch
  const responses = [new Response("[]", { status: 503 }), new Response("[]", { status: 302 }),
    new Response("[]", { headers: { "content-type": "application/json", "content-length": String(2 * 1024 * 1024 + 1) } }),
    new Response(" ".repeat(2 * 1024 * 1024 + 1), { headers: { "content-type": "application/json" } })]
  try {
    for (const response of responses) {
      globalThis.fetch = async () => response
      assert.equal((await getTrucksCurrentlyOut()).count, null)
    }
    globalThis.fetch = async () => { throw new Error("private upstream details") }
    const failed = await getTrucksCurrentlyOut()
    assert.equal(failed.count, null)
    assert.doesNotMatch(JSON.stringify(failed), /private upstream details/)
  } finally { globalThis.fetch = original }
})

test("declared identity body truncation is invalid even when JSON prefix is a valid empty array", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response("[]", { headers: { "content-type": "application/json", "content-length": "100" } })
  try { assert.equal((await getTrucksCurrentlyOut()).count, null) }
  finally { globalThis.fetch = original }
})

const date = "2026-09-28"
const row = (out: string | null, returned: string | null) => ({ "Out Date": out, "Return Date": returned })

test("on-road assignment includes departure day, excludes return day and null dates", () => {
  assert.equal(isOnRoadAssignment(row(date, "2026-09-29"), date), true)
  assert.equal(isOnRoadAssignment(row("2026-09-27", date), date), false)
  assert.equal(isOnRoadAssignment(row("2026-09-29", "2026-10-01"), date), false)
  assert.equal(isOnRoadAssignment(row("2026-09-27", null), date), false)
  assert.equal(isOnRoadAssignment(row(null, "2026-09-29"), date), false)
})
