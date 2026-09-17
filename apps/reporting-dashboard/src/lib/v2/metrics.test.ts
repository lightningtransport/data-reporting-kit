import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  accountingNet,
  allocationImpact,
  compareMetric,
  filterRowsForPeriod,
  isAllocationTruck,
  isPhysicalTruck,
  lensGross,
  lensNet,
  lowGrossExceptions,
  milesPerGallon,
  negativeNetExceptions,
  operatingGross,
  operatingMargin,
  operatingNet,
  previousCalendarMonth,
  previousSettlementWeekStart,
  productiveTrucks,
  reconcileNets,
  returnDateGaps,
  revenuePerMile,
  teamPerformance,
  type SettlementMetricRow,
} from "./metrics.ts"

function row(
  partial: Partial<SettlementMetricRow> & Pick<SettlementMetricRow, "t" | "pf">
): SettlementMetricRow {
  return {
    t: partial.t,
    o: partial.o ?? "Carlos",
    pf: partial.pf,
    g: partial.g ?? 0,
    e: partial.e ?? 0,
    n: partial.n ?? 0,
    f: partial.f ?? 0,
    m: partial.m ?? 0,
  }
}

const WEEK = "2026-09-08"
const PREV_WEEK = "2026-09-01"

describe("allocation truck identity", () => {
  it("treats 1/2/3 as allocation buckets", () => {
    assert.equal(isAllocationTruck("1"), true)
    assert.equal(isAllocationTruck(2), true)
    assert.equal(isAllocationTruck("3"), true)
    assert.equal(isPhysicalTruck("101"), true)
    assert.equal(isPhysicalTruck("1"), false)
  })
})

describe("operating vs accounting lenses", () => {
  const rows = [
    row({ t: "101", pf: WEEK, o: "Carlos", g: 12000, e: 8000, n: 4000, m: 1000 }),
    row({ t: "102", pf: WEEK, o: "Jorge", g: 9000, e: 9500, n: -500, m: 800 }),
    row({ t: "1", pf: WEEK, o: "Carlos", g: 5000, e: 1000, n: 4000, m: 0 }),
    row({ t: "2", pf: WEEK, o: "Jorge", g: 3000, e: 500, n: 2500, m: 0 }),
    row({ t: "3", pf: WEEK, o: "CDT", g: 2000, e: 200, n: 1800, m: 0 }),
  ]

  it("excludes allocation buckets from Operating Gross/Net", () => {
    assert.deepEqual(operatingGross(rows), { value: 21000, status: "ok" })
    assert.deepEqual(operatingNet(rows), { value: 3500, status: "ok" })
  })

  it("includes allocation buckets in Accounting Net", () => {
    assert.deepEqual(accountingNet(rows), { value: 11800, status: "ok" })
    assert.deepEqual(allocationImpact(rows), { value: 8300, status: "ok" })
  })

  it("reconciles Operating Net + Allocation Impact = Accounting Net", () => {
    const rec = reconcileNets(rows)
    assert.equal(rec.status, "ok")
    assert.equal(rec.balanced, true)
    assert.equal(rec.operatingNet + rec.allocationImpact, rec.accountingNet)
  })

  it("uses stored Net even when Gross - Expenses differs", () => {
    const tricky = [
      row({ t: "201", pf: WEEK, g: 10000, e: 3000, n: 999 }),
      row({ t: "1", pf: WEEK, g: 1000, e: 0, n: 50 }),
    ]
    assert.deepEqual(operatingNet(tricky), { value: 999, status: "ok" })
    assert.deepEqual(accountingNet(tricky), { value: 1049, status: "ok" })
    assert.notEqual(operatingNet(tricky).value, 10000 - 3000)
  })

  it("lens helpers switch populations", () => {
    assert.equal(lensGross(rows, "operating").value, 21000)
    assert.equal(lensGross(rows, "accounting").value, 31000)
    assert.equal(lensNet(rows, "operating").value, 3500)
    assert.equal(lensNet(rows, "accounting").value, 11800)
  })
})

describe("margin, RPM, MPG, denominators", () => {
  it("returns unavailable margin when gross is zero", () => {
    const net = { value: 0, status: "ok" as const }
    const gross = { value: 0, status: "ok" as const }
    const margin = operatingMargin(net, gross)
    assert.equal(margin.value, null)
    assert.equal(margin.status, "unavailable")
  })

  it("returns unavailable RPM when miles are zero", () => {
    const rows = [row({ t: "101", pf: WEEK, g: 10000, n: 1000, m: 0 })]
    const rpm = revenuePerMile(rows)
    assert.equal(rpm.value, null)
    assert.equal(rpm.status, "unavailable")
  })

  it("computes RPM from physical Gross / miles only", () => {
    const rows = [
      row({ t: "101", pf: WEEK, g: 10000, m: 1000 }),
      row({ t: "1", pf: WEEK, g: 5000, m: 500 }),
    ]
    assert.deepEqual(revenuePerMile(rows), { value: 10, status: "ok" })
  })

  it("returns unavailable MPG for zero gallons or incomplete match", () => {
    assert.equal(milesPerGallon(1000, 0).status, "unavailable")
    assert.equal(
      milesPerGallon(1000, 50, { matchComplete: false }).status,
      "unavailable"
    )
    assert.deepEqual(milesPerGallon(1000, 50), { value: 20, status: "ok" })
  })
})

describe("productive trucks and duplicates", () => {
  it("counts distinct physical trucks and ignores allocation + duplicates", () => {
    const rows = [
      row({ t: "101", pf: WEEK, g: 5000, n: 100 }),
      row({ t: "101", pf: WEEK, g: 5000, n: 100 }),
      row({ t: "102", pf: WEEK, g: 5000, n: 100 }),
      row({ t: "1", pf: WEEK, g: 5000, n: 100 }),
    ]
    assert.deepEqual(productiveTrucks(rows), { value: 2, status: "ok" })
  })

  it("marks empty and incomplete populations", () => {
    assert.equal(productiveTrucks([]).status, "empty")
    assert.equal(productiveTrucks([], { incomplete: true }).status, "partial")
    assert.equal(operatingGross([], { incomplete: true }).value, null)
  })
})

describe("exceptions", () => {
  it("flags negative-net and low-gross physical trucks only", () => {
    const rows = [
      row({ t: "101", pf: WEEK, o: "Carlos", g: 12000, n: -100 }),
      row({ t: "102", pf: WEEK, o: "Jorge", g: 8000, n: 500 }),
      row({ t: "1", pf: WEEK, o: "Carlos", g: 100, n: -999 }),
    ]
    const neg = negativeNetExceptions(rows)
    const low = lowGrossExceptions(rows)
    assert.equal(neg.length, 1)
    assert.equal(neg[0]?.truck, "101")
    assert.equal(low.length, 1)
    assert.equal(low[0]?.truck, "102")
  })

  it("lists return-date gaps by distinct truck", () => {
    const gaps = returnDateGaps([
      { truck: "101", returnDate: "" },
      { truck: "101", returnDate: "" },
      { truck: "102", returnDate: "2026-09-10" },
      { truck: "103", returnDate: "   " },
    ])
    assert.deepEqual(
      gaps.map((g) => g.truck),
      ["101", "103"]
    )
  })
})

describe("team performance", () => {
  it("aggregates physical metrics by team and sorts underperformance first", () => {
    const rows = [
      row({ t: "101", pf: WEEK, o: "Carlos", g: 12000, n: 2000, m: 1000 }),
      row({ t: "102", pf: WEEK, o: "Jorge", g: 8000, n: -500, m: 800 }),
      row({ t: "1", pf: WEEK, o: "Carlos", g: 5000, n: 4000, m: 0 }),
    ]
    const teams = teamPerformance(rows)
    assert.equal(teams[0]?.team, "Jorge")
    assert.equal(teams[0]?.negativeNetTrucks, 1)
    const carlos = teams.find((t) => t.team === "Carlos")
    assert.equal(carlos?.gross, 12000)
  })
})

describe("period helpers and comparisons", () => {
  it("computes previous Tue–Mon week and calendar month", () => {
    assert.equal(previousSettlementWeekStart(WEEK), PREV_WEEK)
    assert.equal(previousCalendarMonth("2026-09"), "2026-08")
    assert.equal(previousCalendarMonth("2026-01"), "2025-12")
  })

  it("filters by week/month and optional teams", () => {
    const rows = [
      row({ t: "101", pf: WEEK, o: "Carlos", g: 1 }),
      row({ t: "102", pf: "2026-08-25", o: "Carlos", g: 2 }),
      row({ t: "103", pf: "2026-09-15", o: "Jorge", g: 3 }),
    ]
    assert.equal(filterRowsForPeriod(rows, "week", WEEK).length, 1)
    assert.equal(filterRowsForPeriod(rows, "month", "2026-09").length, 2)
    assert.equal(
      filterRowsForPeriod(rows, "month", "2026-09", ["Jorge"]).length,
      1
    )
  })

  it("suppresses comparisons for partial periods or missing prior", () => {
    const current = { value: 100, status: "ok" as const }
    const previous = { value: 80, status: "ok" as const }
    const ok = compareMetric(current, previous)
    assert.equal(ok.status, "ok")
    assert.equal(ok.absolute, 20)
    assert.ok(ok.pct != null && Math.abs(ok.pct - 0.25) < 1e-9)

    const partial = compareMetric(current, previous, { currentPartial: true })
    assert.equal(partial.status, "unavailable")

    const zeroPrior = compareMetric(current, { value: 0, status: "ok" })
    assert.equal(zeroPrior.pct, null)
    assert.equal(zeroPrior.status, "unavailable")
  })
})
