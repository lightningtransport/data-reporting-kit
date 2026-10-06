import assert from "node:assert/strict"
import { test } from "node:test"
import { fetchBoundedJson } from "./bounded-json"

test("bounded JSON rejects oversized streams and timeout covers fetch and body read", async () => {
  await assert.rejects(fetchBoundedJson("https://example.test", {}, { maxBytes: 4, fetcher: async () => new Response("12345") }))
  await assert.rejects(fetchBoundedJson("https://example.test", {}, { timeoutMs: 5, fetcher: async () => new Promise(() => {}) }))
  await assert.rejects(fetchBoundedJson("https://example.test", {}, { timeoutMs: 5, fetcher: async () => new Response(new ReadableStream({ start() {} })) }))
})

test("bounded JSON uses no-store, rejects redirects and omits browser credentials", async () => {
  const result = await fetchBoundedJson("https://example.test?locale=en&utcoffset=-240", { headers: { Accept: "application/json" } }, { fetcher: async (url, init) => {
    assert.equal(String(url), "https://example.test?locale=en&utcoffset=-240")
    assert.equal(init?.redirect, "error")
    assert.equal(init?.credentials, "omit")
    assert.equal(init?.cache, "no-store")
    assert.ok(init?.signal)
    assert.equal(new Headers(init?.headers).get("x-agent-key"), null)
    return Response.json([])
  } })
  assert.deepEqual(result, [])
})
