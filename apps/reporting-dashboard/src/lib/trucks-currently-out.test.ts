import assert from "node:assert/strict"
import test from "node:test"
import { isOnRoadAssignment } from "./trucks-currently-out.ts"

const date = "2026-09-28"
const row = (out: string | null, returned: string | null) => ({ "Out Date": out, "Return Date": returned })

test("on-road assignment includes departure day, excludes return day and null dates", () => {
  assert.equal(isOnRoadAssignment(row(date, "2026-09-29"), date), true)
  assert.equal(isOnRoadAssignment(row("2026-09-27", date), date), false)
  assert.equal(isOnRoadAssignment(row("2026-09-29", "2026-10-01"), date), false)
  assert.equal(isOnRoadAssignment(row("2026-09-27", null), date), false)
  assert.equal(isOnRoadAssignment(row(null, "2026-09-29"), date), false)
})
