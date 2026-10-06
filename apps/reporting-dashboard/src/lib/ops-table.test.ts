import assert from "node:assert/strict"
import { test } from "node:test"
import { currentMonday } from "./ops-table.ts"

test("current departure week uses New York Sunday, not UTC Monday", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-05T02:00:00Z") })
  assert.equal(currentMonday(), "2026-09-28")
})
