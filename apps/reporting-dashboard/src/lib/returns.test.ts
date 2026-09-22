import assert from "node:assert/strict"
import test from "node:test"

import {
  driverPayReturnMetric,
  mergeReturningTruckRows,
  type ReturnRow,
} from "./returns.ts"

test("DriverPay return metric excludes driver changes and transfers to another truck", () => {
  const rows = [
    { Truck_Number: "100", Solo_Driver_if_1: 0, Termination: null, Transfer: null, "Return Date": "2026-09-21", "Driver Name": "A" },
    { Truck_Number: "100", Solo_Driver_if_1: null, Termination: null, Transfer: null, "Return Date": "2026-09-21", "Driver Name": "B" },
    { Truck_Number: "200", Solo_Driver_if_1: 1, Termination: null, Transfer: null, "Return Date": "2026-09-22", "Driver Name": "C" },
    { Truck_Number: "300", Solo_Driver_if_1: 0, Termination: "Driver Changed", Transfer: null, "Return Date": "2026-09-23", "Driver Name": "D" },
    { Truck_Number: "400", Solo_Driver_if_1: 0, Termination: null, Transfer: "Transfer To Other Truck", "Return Date": "2026-09-24", "Driver Name": "E" },
  ]

  const result = driverPayReturnMetric(rows)

  assert.equal(result.teamRows, 2)
  assert.equal(result.soloRows, 1)
  assert.equal(result.formulaCount, 2)
  assert.deepEqual([...result.trucks].sort(), ["100", "200"])
  assert.equal(result.rows.length, 3)
})

test("merged returning-truck list unions unique truck numbers and prefers returns details", () => {
  const returnsRows: ReturnRow[] = [
    { id: 1, truck: "100", insurance: "CTC", driverName: "Current A", returnDate: "2026-09-21", source: "returns" },
    { id: 2, truck: "100", insurance: "CTC", driverName: "Current B", returnDate: "2026-09-21", source: "returns" },
    { id: 3, truck: "300", insurance: "LTL", driverName: "Current C", returnDate: "2026-09-23", source: "returns" },
  ]
  const driverPayRows: ReturnRow[] = [
    { id: 10, truck: "100", insurance: "", driverName: "Historic A", returnDate: "2026-09-21", source: "driver_pay" },
    { id: 11, truck: "200", insurance: "", driverName: "Historic B", returnDate: "2026-09-22", source: "driver_pay" },
  ]

  const merged = mergeReturningTruckRows(returnsRows, driverPayRows)

  assert.deepEqual([...new Set(merged.map((row) => row.truck))].sort(), ["100", "200", "300"])
  assert.equal(merged.some((row) => row.truck === "100" && row.source === "driver_pay"), false)
  assert.equal(merged.some((row) => row.truck === "200" && row.source === "driver_pay"), true)
})
