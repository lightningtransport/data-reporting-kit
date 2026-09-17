/**
 * Pure executive metrics for Reporting Dashboard V2.
 * Uses authoritative stored Gross / Net / Fuel Expenses / Driven_miles.
 * Settlement trucks 1/2/3 are accounting allocation buckets, not physical units.
 *
 * Kept free of path aliases so Node's test runner can import it directly.
 */

/** Matches settlement.ts — keep in sync. */
export const LOW_GROSS_THRESHOLD = 11000
export const ALLOCATION_TRUCKS = new Set(["1", "2", "3"])

/**
 * RPM trust band (physical Gross ÷ Driven_miles for the same truck/period).
 * Outside the band, or sparse miles with elevated RPM → Check data (not silent clamp).
 */
export const RPM_EXTREME_HIGH = 15
export const RPM_EXTREME_LOW = 0.05
export const RPM_SPARSE_MILES = 100
export const RPM_SPARSE_HIGH = 5

/** Minimal settlement fields required by executive metrics. */
export type SettlementMetricRow = {
  t: string
  o: string
  /** Dispatch group when present on settlements. */
  d?: string
  pf: string
  g: number
  n: number
  f: number
  m: number
  e?: number
}

export type RpmAssessment = {
  value: number | null
  status: "ok" | "unavailable" | "check_data"
  reason?: string
}

/**
 * Validate truck-period RPM from matching Gross and Driven_miles.
 * Does not invent or clamp stored source values — flags only.
 */
export function assessTruckRpm(gross: number, miles: number): RpmAssessment {
  if (!(miles > 0)) {
    return {
      value: null,
      status: "unavailable",
      reason: "Driven miles missing or zero",
    }
  }
  const rpm = gross / miles
  if (miles < RPM_SPARSE_MILES && rpm > RPM_SPARSE_HIGH) {
    return {
      value: rpm,
      status: "check_data",
      reason: `Sparse miles (${Math.round(miles)}) with elevated RPM`,
    }
  }
  if (rpm > RPM_EXTREME_HIGH || rpm < RPM_EXTREME_LOW) {
    return {
      value: rpm,
      status: "check_data",
      reason: `RPM outside $${RPM_EXTREME_LOW}–$${RPM_EXTREME_HIGH}/mi trust band`,
    }
  }
  return { value: rpm, status: "ok" }
}

export type ExecutiveLens = "operating" | "accounting"
export type ExecutiveGrain = "week" | "month"

export type MetricStatus =
  | "ok"
  | "unavailable"
  | "partial"
  | "empty"

export type MetricValue<T = number> = {
  value: T | null
  status: MetricStatus
  reason?: string
}

export type PeriodComparison = {
  absolute: number | null
  pct: number | null
  status: MetricStatus
  reason?: string
}

export type TruckException = {
  truck: string
  owner: string
  gross: number
  net: number
  kind: "negative_net" | "low_gross"
}

export type TeamPerformanceRow = {
  team: string
  gross: number
  net: number
  margin: number | null
  rpm: number | null
  rpmStatus: "ok" | "unavailable" | "check_data"
  negativeNetTrucks: number
  lowGrossTrucks: number
  productiveTrucks: number
  needsAttention: boolean
}

export type Reconciliation = {
  operatingNet: number
  allocationImpact: number
  accountingNet: number
  balanced: boolean
  status: MetricStatus
  reason?: string
}

export function normalizeTruckId(truck: string | number): string {
  return String(truck).trim()
}

export function isAllocationTruck(truck: string | number): boolean {
  return ALLOCATION_TRUCKS.has(normalizeTruckId(truck))
}

export function isPhysicalTruck(truck: string | number): boolean {
  const id = normalizeTruckId(truck)
  return id.length > 0 && !ALLOCATION_TRUCKS.has(id)
}

/** Rows for Operating Fleet lens (exclude allocation buckets 1/2/3). */
export function physicalRows(rows: SettlementMetricRow[]): SettlementMetricRow[] {
  return rows.filter((row) => isPhysicalTruck(row.t))
}

/** Rows for allocation buckets only. */
export function allocationRows(rows: SettlementMetricRow[]): SettlementMetricRow[] {
  return rows.filter((row) => isAllocationTruck(row.t))
}

export function rowsForLens(
  rows: SettlementMetricRow[],
  lens: ExecutiveLens
): SettlementMetricRow[] {
  return lens === "operating" ? physicalRows(rows) : rows
}

function sumStored(
  rows: SettlementMetricRow[],
  pick: (row: SettlementMetricRow) => number
): number {
  let total = 0
  for (const row of rows) total += pick(row)
  return total
}

function metricFromSum(
  rows: SettlementMetricRow[],
  pick: (row: SettlementMetricRow) => number,
  options?: { incomplete?: boolean; emptyReason?: string }
): MetricValue {
  if (options?.incomplete) {
    return {
      value: null,
      status: "partial",
      reason: "Pagination incomplete; totals not final",
    }
  }
  if (!rows.length) {
    return {
      value: null,
      status: "empty",
      reason: options?.emptyReason ?? "No qualifying settlement rows",
    }
  }
  return { value: sumStored(rows, pick), status: "ok" }
}

/** Operating Gross: stored Gross for physical trucks only. */
export function operatingGross(
  rows: SettlementMetricRow[],
  options?: { incomplete?: boolean }
): MetricValue {
  return metricFromSum(physicalRows(rows), (row) => row.g, options)
}

/** Operating Net: stored Net for physical trucks only. */
export function operatingNet(
  rows: SettlementMetricRow[],
  options?: { incomplete?: boolean }
): MetricValue {
  return metricFromSum(physicalRows(rows), (row) => row.n, options)
}

/** Accounting Net: stored Net including allocation buckets 1/2/3. */
export function accountingNet(
  rows: SettlementMetricRow[],
  options?: { incomplete?: boolean }
): MetricValue {
  return metricFromSum(rows, (row) => row.n, options)
}

/** Allocation Impact: stored Net for trucks 1/2/3 only. */
export function allocationImpact(
  rows: SettlementMetricRow[],
  options?: { incomplete?: boolean }
): MetricValue {
  const alloc = allocationRows(rows)
  if (options?.incomplete) {
    return {
      value: null,
      status: "partial",
      reason: "Pagination incomplete; totals not final",
    }
  }
  // Empty allocation set is a valid zero (buckets may not settle every period).
  return { value: sumStored(alloc, (row) => row.n), status: "ok" }
}

export function operatingMargin(
  net: MetricValue,
  gross: MetricValue
): MetricValue {
  if (net.status === "partial" || gross.status === "partial") {
    return {
      value: null,
      status: "partial",
      reason: "Inputs incomplete",
    }
  }
  if (
    net.status === "unavailable" ||
    gross.status === "unavailable" ||
    net.value == null ||
    gross.value == null
  ) {
    return {
      value: null,
      status: "unavailable",
      reason: "Gross or Net unavailable",
    }
  }
  if (gross.value === 0) {
    return {
      value: null,
      status: "unavailable",
      reason: "Operating Gross is zero",
    }
  }
  return { value: net.value / gross.value, status: "ok" }
}

/**
 * Reconciliation: Operating Net + Allocation Impact = Accounting Net.
 * Uses the same raw population for all three inputs.
 */
export function reconcileNets(
  rows: SettlementMetricRow[],
  options?: { incomplete?: boolean }
): Reconciliation {
  if (options?.incomplete) {
    return {
      operatingNet: 0,
      allocationImpact: 0,
      accountingNet: 0,
      balanced: false,
      status: "partial",
      reason: "Pagination incomplete; reconciliation not final",
    }
  }
  if (!rows.length) {
    return {
      operatingNet: 0,
      allocationImpact: 0,
      accountingNet: 0,
      balanced: false,
      status: "empty",
      reason: "No qualifying settlement rows",
    }
  }
  const op = sumStored(physicalRows(rows), (row) => row.n)
  const alloc = sumStored(allocationRows(rows), (row) => row.n)
  const acct = sumStored(rows, (row) => row.n)
  const balanced = Math.abs(op + alloc - acct) < 1e-9
  return {
    operatingNet: op,
    allocationImpact: alloc,
    accountingNet: acct,
    balanced,
    status: balanced ? "ok" : "unavailable",
    reason: balanced
      ? undefined
      : "Operating Net + Allocation Impact does not equal Accounting Net",
  }
}

/** RPM = physical Gross / physical miles when miles > 0; excludes Check-data trucks. */
export function revenuePerMile(
  rows: SettlementMetricRow[],
  options?: { incomplete?: boolean }
): MetricValue {
  if (options?.incomplete) {
    return {
      value: null,
      status: "partial",
      reason: "Pagination incomplete; totals not final",
    }
  }
  const phys = physicalRows(rows)
  if (!phys.length) {
    return {
      value: null,
      status: "empty",
      reason: "No physical settlement rows",
    }
  }
  let gross = 0
  let miles = 0
  let excluded = 0
  for (const [, agg] of aggregatePhysicalByTruck(rows)) {
    const assessed = assessTruckRpm(agg.gross, agg.miles)
    if (assessed.status !== "ok" || assessed.value == null) {
      excluded += 1
      continue
    }
    gross += agg.gross
    miles += agg.miles
  }
  if (miles <= 0) {
    return {
      value: null,
      status: "unavailable",
      reason:
        excluded > 0
          ? "No trusted truck miles after excluding Check-data / unavailable RPM"
          : "Driven miles missing or zero",
    }
  }
  return {
    value: gross / miles,
    status: "ok",
    reason:
      excluded > 0
        ? `Excluded ${excluded} truck(s) flagged Check data or unavailable`
        : undefined,
  }
}

/**
 * Settlement-based fuel cost per mile:
 * stored Fuel Expenses (physical) / physical miles.
 */
export function fuelCostPerMileSettlement(
  rows: SettlementMetricRow[],
  options?: { incomplete?: boolean }
): MetricValue {
  if (options?.incomplete) {
    return {
      value: null,
      status: "partial",
      reason: "Pagination incomplete; totals not final",
    }
  }
  const phys = physicalRows(rows)
  if (!phys.length) {
    return {
      value: null,
      status: "empty",
      reason: "No physical settlement rows",
    }
  }
  const fuel = sumStored(phys, (row) => row.f)
  const miles = sumStored(phys, (row) => row.m)
  if (miles <= 0) {
    return {
      value: null,
      status: "unavailable",
      reason: "Driven miles missing or zero",
    }
  }
  return { value: fuel / miles, status: "ok" }
}

/**
 * MPG = physical miles / matching gallons.
 * Returns unavailable when gallons are missing or zero.
 */
export function milesPerGallon(
  miles: number | null | undefined,
  gallons: number | null | undefined,
  options?: { matchComplete?: boolean; incomplete?: boolean }
): MetricValue {
  if (options?.incomplete) {
    return {
      value: null,
      status: "partial",
      reason: "Source data incomplete",
    }
  }
  if (options?.matchComplete === false) {
    return {
      value: null,
      status: "unavailable",
      reason: "Settlement and fuel periods cannot be matched safely",
    }
  }
  if (miles == null || gallons == null) {
    return {
      value: null,
      status: "unavailable",
      reason: "Miles or gallons unavailable",
    }
  }
  if (gallons <= 0) {
    return {
      value: null,
      status: "unavailable",
      reason: "Gallons missing or zero",
    }
  }
  return { value: miles / gallons, status: "ok" }
}

/**
 * Productive Trucks: distinct normalized physical truck IDs with a
 * qualifying settlement row. Activity count — not fleet size or utilization.
 */
export function productiveTrucks(
  rows: SettlementMetricRow[],
  options?: { incomplete?: boolean }
): MetricValue<number> {
  if (options?.incomplete) {
    return {
      value: null,
      status: "partial",
      reason: "Pagination incomplete; count not final",
    }
  }
  const ids = new Set<string>()
  for (const row of physicalRows(rows)) {
    const id = normalizeTruckId(row.t)
    if (id) ids.add(id)
  }
  if (!ids.size) {
    return {
      value: null,
      status: "empty",
      reason: "No physical trucks with settlement activity",
    }
  }
  return { value: ids.size, status: "ok" }
}

function aggregatePhysicalByTruck(rows: SettlementMetricRow[]): Map<
  string,
  {
    owner: string
    dispatch: string
    gross: number
    net: number
    miles: number
    fuel: number
  }
> {
  const map = new Map<
    string,
    {
      owner: string
      dispatch: string
      gross: number
      net: number
      miles: number
      fuel: number
    }
  >()
  for (const row of physicalRows(rows)) {
    const id = normalizeTruckId(row.t)
    if (!id) continue
    const current = map.get(id) ?? {
      owner: row.o,
      dispatch: row.d ?? "",
      gross: 0,
      net: 0,
      miles: 0,
      fuel: 0,
    }
    current.owner = row.o || current.owner
    current.dispatch = row.d || current.dispatch
    current.gross += row.g
    current.net += row.n
    current.miles += row.m
    current.fuel += row.f
    map.set(id, current)
  }
  return map
}

export function negativeNetExceptions(
  rows: SettlementMetricRow[]
): TruckException[] {
  const out: TruckException[] = []
  for (const [truck, agg] of aggregatePhysicalByTruck(rows)) {
    if (agg.net < 0) {
      out.push({
        truck,
        owner: agg.owner,
        gross: agg.gross,
        net: agg.net,
        kind: "negative_net",
      })
    }
  }
  return out.sort((a, b) => a.net - b.net)
}

export function lowGrossExceptions(
  rows: SettlementMetricRow[],
  threshold = LOW_GROSS_THRESHOLD
): TruckException[] {
  const out: TruckException[] = []
  for (const [truck, agg] of aggregatePhysicalByTruck(rows)) {
    if (agg.gross < threshold) {
      out.push({
        truck,
        owner: agg.owner,
        gross: agg.gross,
        net: agg.net,
        kind: "low_gross",
      })
    }
  }
  return out.sort((a, b) => a.gross - b.gross)
}

/** Return-date gaps: returns rows expected to have a date but empty. */
export function returnDateGaps(
  returns: Array<{ truck: string; returnDate: string }>
): Array<{ truck: string }> {
  const seen = new Set<string>()
  const gaps: Array<{ truck: string }> = []
  for (const row of returns) {
    if (row.returnDate && row.returnDate.trim() !== "") continue
    const truck = normalizeTruckId(row.truck)
    if (!truck || seen.has(truck)) continue
    seen.add(truck)
    gaps.push({ truck })
  }
  return gaps.sort((a, b) => a.truck.localeCompare(b.truck))
}

export function teamPerformance(
  rows: SettlementMetricRow[]
): TeamPerformanceRow[] {
  const byTeam = new Map<string, SettlementMetricRow[]>()
  for (const row of rows) {
    const team = row.o || "(unassigned)"
    const list = byTeam.get(team) ?? []
    list.push(row)
    byTeam.set(team, list)
  }

  const result: TeamPerformanceRow[] = []
  for (const [team, teamRows] of byTeam) {
    const phys = physicalRows(teamRows)
    if (!phys.length) continue
    const gross = sumStored(phys, (row) => row.g)
    const net = sumStored(phys, (row) => row.n)
    const rpmMetric = revenuePerMile(teamRows)
    const margin = gross === 0 ? null : net / gross
    const rpmStatus: TeamPerformanceRow["rpmStatus"] =
      rpmMetric.status === "ok"
        ? "ok"
        : rpmMetric.value != null
          ? "check_data"
          : "unavailable"
    result.push({
      team,
      gross,
      net,
      margin,
      rpm: rpmMetric.value,
      rpmStatus,
      negativeNetTrucks: negativeNetExceptions(teamRows).length,
      lowGrossTrucks: lowGrossExceptions(teamRows).length,
      productiveTrucks: productiveTrucks(teamRows).value ?? 0,
      needsAttention:
        net < 0 ||
        negativeNetExceptions(teamRows).length > 0 ||
        lowGrossExceptions(teamRows).length > 0,
    })
  }

  return result.sort((a, b) => {
    if (Number(b.needsAttention) !== Number(a.needsAttention)) {
      return Number(b.needsAttention) - Number(a.needsAttention)
    }
    if (b.negativeNetTrucks !== a.negativeNetTrucks) {
      return b.negativeNetTrucks - a.negativeNetTrucks
    }
    if (b.lowGrossTrucks !== a.lowGrossTrucks) {
      return b.lowGrossTrucks - a.lowGrossTrucks
    }
    return a.net - b.net
  })
}

/** Physical dispatch performance (same metrics as teams, keyed by Dispatch). */
export function dispatchPerformance(
  rows: SettlementMetricRow[]
): TeamPerformanceRow[] {
  const byDispatch = new Map<string, SettlementMetricRow[]>()
  for (const row of physicalRows(rows)) {
    const dispatch = (row.d || "").trim() || "(unassigned)"
    const list = byDispatch.get(dispatch) ?? []
    list.push(row)
    byDispatch.set(dispatch, list)
  }

  const result: TeamPerformanceRow[] = []
  for (const [dispatch, dispatchRows] of byDispatch) {
    const gross = sumStored(dispatchRows, (row) => row.g)
    const net = sumStored(dispatchRows, (row) => row.n)
    const rpmMetric = revenuePerMile(dispatchRows)
    const margin = gross === 0 ? null : net / gross
    result.push({
      team: dispatch,
      gross,
      net,
      margin,
      rpm: rpmMetric.value,
      rpmStatus:
        rpmMetric.status === "ok"
          ? "ok"
          : rpmMetric.value != null
            ? "check_data"
            : "unavailable",
      negativeNetTrucks: negativeNetExceptions(dispatchRows).length,
      lowGrossTrucks: lowGrossExceptions(dispatchRows).length,
      productiveTrucks: productiveTrucks(dispatchRows).value ?? 0,
      needsAttention:
        net < 0 ||
        negativeNetExceptions(dispatchRows).length > 0 ||
        lowGrossExceptions(dispatchRows).length > 0,
    })
  }

  return result.sort((a, b) => {
    if (Number(b.needsAttention) !== Number(a.needsAttention)) {
      return Number(b.needsAttention) - Number(a.needsAttention)
    }
    return a.net - b.net
  })
}

/**
 * Compare current vs previous complete period of the same grain.
 * Suppresses comparison when either period is partial or prior denominator invalid.
 */
export function compareMetric(
  current: MetricValue,
  previous: MetricValue,
  options?: { currentPartial?: boolean; previousPartial?: boolean }
): PeriodComparison {
  if (options?.currentPartial || options?.previousPartial) {
    return {
      absolute: null,
      pct: null,
      status: "unavailable",
      reason: "Partial period is not comparable to a complete period",
    }
  }
  if (
    current.status !== "ok" ||
    previous.status !== "ok" ||
    current.value == null ||
    previous.value == null
  ) {
    return {
      absolute: null,
      pct: null,
      status: "unavailable",
      reason: "Comparable complete values not available",
    }
  }
  const absolute = current.value - previous.value
  if (previous.value === 0) {
    return {
      absolute,
      pct: null,
      status: "unavailable",
      reason: "Prior period denominator is zero",
    }
  }
  return {
    absolute,
    pct: absolute / Math.abs(previous.value),
    status: "ok",
  }
}

/** Previous Tuesday for a Tuesday period_from (settlement week start). */
export function previousSettlementWeekStart(periodFrom: string): string {
  const date = new Date(`${periodFrom}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 7)
  return date.toISOString().slice(0, 10)
}

/** Previous calendar month `YYYY-MM` from a month key. */
export function previousCalendarMonth(ym: string): string {
  const [year, month] = ym.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 2, 1))
  return date.toISOString().slice(0, 7)
}

export function filterRowsForPeriod(
  rows: SettlementMetricRow[],
  grain: ExecutiveGrain,
  period: string,
  options?: string[] | { teams?: string[]; dispatches?: string[] }
): SettlementMetricRow[] {
  const opts = Array.isArray(options)
    ? { teams: options }
    : (options ?? {})
  const teamSet =
    opts.teams && opts.teams.length > 0 ? new Set(opts.teams) : null
  const dispatchSet =
    opts.dispatches && opts.dispatches.length > 0
      ? new Set(opts.dispatches)
      : null
  return rows.filter((row) => {
    if (teamSet && !teamSet.has(row.o)) return false
    if (dispatchSet) {
      const dispatch = (row.d || "").trim() || "(unassigned)"
      if (!dispatchSet.has(dispatch)) return false
    }
    if (grain === "week") return row.pf === period
    return row.pf.startsWith(period)
  })
}

export function lensGross(
  rows: SettlementMetricRow[],
  lens: ExecutiveLens,
  options?: { incomplete?: boolean }
): MetricValue {
  return lens === "operating"
    ? operatingGross(rows, options)
    : metricFromSum(rows, (row) => row.g, options)
}

export function lensNet(
  rows: SettlementMetricRow[],
  lens: ExecutiveLens,
  options?: { incomplete?: boolean }
): MetricValue {
  return lens === "operating"
    ? operatingNet(rows, options)
    : accountingNet(rows, options)
}

export type TrendPoint = {
  period: string
  label: string
  gross: number | null
  net: number | null
  margin: number | null
  status: MetricStatus
  reason?: string
}

export type TruckPeriodRow = {
  truck: string
  owner: string
  dispatch: string
  period: string
  gross: number
  net: number
  miles: number
  fuel: number
  rpm: number | null
  rpmStatus: "ok" | "unavailable" | "check_data"
  rpmReason?: string
}

export type TruckAggregate = {
  truck: string
  owner: string
  dispatch: string
  gross: number
  net: number
  miles: number
  fuel: number
  rpm: number | null
  rpmStatus: "ok" | "unavailable" | "check_data"
  rpmReason?: string
  fuelPerMile: number | null
  flags: Array<"negative_net" | "low_gross" | "check_data">
}

/** Calendar month `YYYY-MM` shifted by `delta` months (negative = earlier). */
export function shiftCalendarMonth(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

/**
 * Up to 12 calendar months of Gross/Net by selected grain and lens.
 * Incomplete pagination marks every point unavailable (not zero).
 */
export function buildGrossNetTrend(
  rows: SettlementMetricRow[],
  grain: ExecutiveGrain,
  lens: ExecutiveLens,
  options?: {
    incomplete?: boolean
    teams?: string[]
    maxMonths?: number
    endDate?: string
  }
): TrendPoint[] {
  const maxMonths = options?.maxMonths ?? 12
  const teamSet =
    options?.teams && options.teams.length > 0
      ? new Set(options.teams)
      : null
  const scoped = teamSet
    ? rows.filter((row) => teamSet.has(row.o))
    : rows

  const endDate =
    options?.endDate ??
    scoped.reduce(
      (latest, row) => (row.pf > latest ? row.pf : latest),
      "0000-00-00"
    )
  if (!endDate || endDate === "0000-00-00") return []

  const endYm = endDate.slice(0, 7)
  const startYm = shiftCalendarMonth(endYm, -(maxMonths - 1))

  const periods = new Set<string>()
  for (const row of scoped) {
    const ym = row.pf.slice(0, 7)
    if (ym < startYm || ym > endYm) continue
    periods.add(grain === "week" ? row.pf : ym)
  }

  const ordered = [...periods].sort()
  const opts = { incomplete: options?.incomplete }

  return ordered.map((period) => {
    const periodRows = filterRowsForPeriod(scoped, grain, period)
    const gross = lensGross(periodRows, lens, opts)
    const net = lensNet(periodRows, lens, opts)
    const status =
      gross.status === "partial" || net.status === "partial"
        ? "partial"
        : gross.status === "empty" && net.status === "empty"
          ? "empty"
          : gross.status === "ok" && net.status === "ok"
            ? "ok"
            : "unavailable"
    return {
      period,
      label: period,
      gross: gross.value,
      net: net.value,
      margin:
        gross.value != null &&
        net.value != null &&
        gross.value !== 0 &&
        gross.status === "ok" &&
        net.status === "ok"
          ? net.value / gross.value
          : null,
      status,
      reason: gross.reason ?? net.reason,
    }
  })
}

/** Physical trucks in a team for the active row set, sorted by lowest net. */
export function trucksInSelection(
  rows: SettlementMetricRow[],
  threshold = LOW_GROSS_THRESHOLD
): TruckAggregate[] {
  const map = aggregatePhysicalByTruck(rows)
  const out: TruckAggregate[] = []
  for (const [truck, agg] of map) {
    const assessed = assessTruckRpm(agg.gross, agg.miles)
    const flags: TruckAggregate["flags"] = []
    if (agg.net < 0) flags.push("negative_net")
    if (agg.gross < threshold) flags.push("low_gross")
    if (assessed.status === "check_data") flags.push("check_data")
    out.push({
      truck,
      owner: agg.owner,
      dispatch: agg.dispatch,
      gross: agg.gross,
      net: agg.net,
      miles: agg.miles,
      fuel: agg.fuel,
      rpm: assessed.value,
      rpmStatus: assessed.status,
      rpmReason: assessed.reason,
      fuelPerMile: agg.miles > 0 ? agg.fuel / agg.miles : null,
      flags,
    })
  }
  return out.sort(
    (a, b) => a.net - b.net || a.truck.localeCompare(b.truck, undefined, { numeric: true })
  )
}

/** Settlement history for one physical truck across the loaded window. */
export function truckSettlementHistory(
  rows: SettlementMetricRow[],
  truck: string
): TruckPeriodRow[] {
  const id = normalizeTruckId(truck)
  if (!id || isAllocationTruck(id)) return []
  const byPeriod = new Map<
    string,
    {
      owner: string
      dispatch: string
      gross: number
      net: number
      miles: number
      fuel: number
    }
  >()
  for (const row of rows) {
    if (normalizeTruckId(row.t) !== id) continue
    const current = byPeriod.get(row.pf) ?? {
      owner: row.o,
      dispatch: row.d ?? "",
      gross: 0,
      net: 0,
      miles: 0,
      fuel: 0,
    }
    current.owner = row.o || current.owner
    current.dispatch = row.d || current.dispatch
    current.gross += row.g
    current.net += row.n
    current.miles += row.m
    current.fuel += row.f
    byPeriod.set(row.pf, current)
  }
  return [...byPeriod.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([period, agg]) => {
      const assessed = assessTruckRpm(agg.gross, agg.miles)
      return {
        truck: id,
        owner: agg.owner,
        dispatch: agg.dispatch,
        period,
        gross: agg.gross,
        net: agg.net,
        miles: agg.miles,
        fuel: agg.fuel,
        rpm: assessed.value,
        rpmStatus: assessed.status,
        rpmReason: assessed.reason,
      }
    })
}

/** Plain-language executive strip when both comparisons are available. */
export function executiveInterpretation(input: {
  view: ExecutiveLens
  grossCmp: PeriodComparison
  netCmp: PeriodComparison
}): string | null {
  const { grossCmp, netCmp, view } = input
  if (grossCmp.status !== "ok" || netCmp.status !== "ok") return null
  if (grossCmp.pct == null || netCmp.pct == null) return null
  const grossDir = grossCmp.absolute != null && grossCmp.absolute >= 0 ? "increased" : "fell"
  const netDir = netCmp.absolute != null && netCmp.absolute >= 0 ? "increased" : "fell"
  const netLabel = view === "operating" ? "Operating Net" : "Accounting Net"
  const fmt = (p: number) => `${(Math.abs(p) * 100).toFixed(1)}%`
  return `Gross ${grossDir} ${fmt(grossCmp.pct)}, while ${netLabel} ${netDir} ${fmt(netCmp.pct)} versus the prior period.`
}
