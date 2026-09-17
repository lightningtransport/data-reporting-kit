export type Vista = "semanal" | "mensual" | "diario"

export const DASHBOARD_HISTORY_MONTHS = 12
export const LOW_GROSS_THRESHOLD = 11000
export const TRUCK_RANK_PREVIEW = 15

export type SettlementRow = {
  sid: number
  t: string
  o: string
  d: string
  pf: string
  pt: string
  g: number
  e: number
  n: number
  f: number
  m: number
  dp: number
  c: number
  lo: number
  ltr: number
  tl: number
  pp: number
}

export type FuelWeek = {
  gallons: number
  byOwner: Record<string, number>
  products: string[]
}

export type SettlementMeta = {
  as_of: string
  source_freshness: string
  total_count: number
  fetched_count: number
  filters: Record<string, string | number | boolean>
  pagination_complete: boolean
  period_from_values: string[]
  live: boolean
  dataset: string
  fuel_pagination_complete?: boolean
  fuel_fetched_count?: number
  fuel_total_count?: number
  error?: string
}

export type SettlementPayload = {
  meta: SettlementMeta
  rows: SettlementRow[]
  fuelByWeek: Record<string, FuelWeek>
}

export const NON_PHYSICAL = new Set(["1", "2", "3"])

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

export function monthLabel(ym: string): string {
  const [, month] = ym.split("-")
  const name = MONTH_NAMES[Number(month) - 1] ?? month
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${ym.slice(0, 4)}`
}

export function humanWeekRange(periodFrom: string, periodTo: string): string {
  const from = periodFrom.split("-")
  const to = (periodTo || periodFrom).split("-")
  if (from.length < 3 || to.length < 3) return periodFrom
  const fromDay = Number(from[2])
  const toDay = Number(to[2])
  const fromMonth = MONTH_NAMES[Number(from[1]) - 1]
  const toMonth = MONTH_NAMES[Number(to[1]) - 1]
  if (from[0] === to[0] && from[1] === to[1]) {
    return `${fromDay}–${toDay} ${fromMonth} ${from[0]}`
  }
  if (from[0] === to[0]) {
    return `${fromDay} ${fromMonth} – ${toDay} ${toMonth} ${from[0]}`
  }
  return `${fromDay} ${fromMonth} ${from[0]} – ${toDay} ${toMonth} ${to[0]}`
}

export function focusPeriodLabel(
  vista: Vista,
  week: string,
  month: string,
  rows: SettlementRow[]
): string {
  if (vista === "mensual") return monthLabel(month)
  const match = rows.find((row) => row.pf === week)
  return humanWeekRange(week, match?.pt ?? week)
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort()
}

export function weeksFromRows(rows: SettlementRow[]): string[] {
  return uniqueSorted(rows.map((row) => row.pf))
}

export function monthsFromWeeks(weeks: string[]): string[] {
  return uniqueSorted(weeks.map((week) => week.slice(0, 7)))
}

export function ownersFromRows(rows: SettlementRow[]): string[] {
  return uniqueSorted(rows.map((row) => row.o).filter(Boolean))
}

export function dispatchesFromRows(rows: SettlementRow[]): string[] {
  return uniqueSorted(rows.map((row) => row.d).filter(Boolean))
}

export function defaultMonth(weeks: string[], months: string[]): string {
  let selected = months[months.length - 1] ?? ""
  for (let index = months.length - 1; index >= 0; index -= 1) {
    const count = weeks.filter((week) => week.startsWith(months[index])).length
    if (count >= 3) {
      selected = months[index]
      break
    }
  }
  return selected
}

export function weekRangeLabel(rows: SettlementRow[], periodFrom: string): string {
  const match = rows.find((row) => row.pf === periodFrom)
  return humanWeekRange(periodFrom, match?.pt ?? periodFrom)
}

export function filterRows(
  rows: SettlementRow[],
  options: {
    vista: Vista
    week: string
    month: string
    owners: string[]
    dispatch: string
    truckQuery: string
  }
): SettlementRow[] {
  const ownerSet = new Set(options.owners)
  const truckQ = options.truckQuery.trim().toLowerCase()
  const base =
    options.vista === "mensual"
      ? rows.filter((row) => row.pf.startsWith(options.month))
      : rows.filter((row) => row.pf === options.week)

  return base.filter((row) => {
    if (!ownerSet.has(row.o)) return false
    if (options.dispatch && row.d !== options.dispatch) return false
    if (truckQ && !String(row.t).toLowerCase().includes(truckQ)) return false
    return true
  })
}

export type TruckAgg = {
  t: string
  o: string
  g: number
  e: number
  n: number
  f: number
  m: number
  dp: number
  np: boolean
}

export type OwnerAgg = {
  o: string
  g: number
  e: number
  n: number
  f: number
  m: number
  c: number
}

export type KpiAgg = {
  gross: number
  exp: number
  net: number
  fuel: number
  miles: number
  phys: number
  rows: number
}

export type OwnerExec = {
  o: string
  g: number
  c: number
  e: number
  n: number
  lo: number
  f: number
  dp: number
  ltr: number
  tp: number
  m: number
}

export type PhysicalExec = {
  count: number
  avgGross: number | null
  avgExp: number | null
  avgPay: number | null
  avgMiles: number | null
  rpm: number | null
  miles: number
  gross: number
  lowGross: number
  netNeg: number
  netPos: number
  netZero: number
}

function emptyOwnerExec(owner: string): OwnerExec {
  return { o: owner, g: 0, c: 0, e: 0, n: 0, lo: 0, f: 0, dp: 0, ltr: 0, tp: 0, m: 0 }
}

function addOwnerExec(target: OwnerExec, row: SettlementRow) {
  target.g += row.g
  target.c += row.c
  target.e += row.e
  target.n += row.n
  target.lo += row.lo
  target.f += row.f
  target.dp += row.dp
  target.ltr += row.ltr
  target.tp += row.tl + row.pp
  target.m += row.m
}

export function aggregate(rows: SettlementRow[]): {
  byTruck: Record<string, TruckAgg>
  byOwner: Record<string, OwnerAgg>
  kpi: KpiAgg
} {
  const byTruck: Record<string, TruckAgg> = {}
  const byOwner: Record<string, OwnerAgg> = {}
  let gross = 0
  let exp = 0
  let net = 0
  let fuel = 0
  let miles = 0
  const phys = new Set<string>()

  for (const row of rows) {
    gross += row.g
    exp += row.e
    net += row.n
    fuel += row.f
    miles += row.m
    const truck = String(row.t)
    if (!NON_PHYSICAL.has(truck)) phys.add(truck)
    if (!byOwner[row.o]) {
      byOwner[row.o] = { o: row.o, g: 0, e: 0, n: 0, f: 0, m: 0, c: 0 }
    }
    const owner = byOwner[row.o]
    owner.g += row.g
    owner.e += row.e
    owner.n += row.n
    owner.f += row.f
    owner.m += row.m
    owner.c += 1
    if (!byTruck[truck]) {
      byTruck[truck] = {
        t: truck,
        o: row.o,
        g: 0,
        e: 0,
        n: 0,
        f: 0,
        m: 0,
        dp: 0,
        np: NON_PHYSICAL.has(truck),
      }
    }
    const truckAgg = byTruck[truck]
    truckAgg.g += row.g
    truckAgg.e += row.e
    truckAgg.n += row.n
    truckAgg.f += row.f
    truckAgg.m += row.m
    truckAgg.dp += row.dp
    truckAgg.o = row.o
  }

  return {
    byTruck,
    byOwner,
    kpi: { gross, exp, net, fuel, miles, phys: phys.size, rows: rows.length },
  }
}

export function executiveTotals(rows: SettlementRow[]): {
  total: OwnerExec
  byOwner: Record<string, OwnerExec>
  physical: PhysicalExec
} {
  const total = emptyOwnerExec("TOTAL")
  const byOwner: Record<string, OwnerExec> = {}
  const physicalTrucks = new Map<string, { g: number; e: number; dp: number; m: number; n: number }>()

  for (const row of rows) {
    addOwnerExec(total, row)
    if (!byOwner[row.o]) byOwner[row.o] = emptyOwnerExec(row.o)
    addOwnerExec(byOwner[row.o], row)
    const truck = String(row.t)
    if (NON_PHYSICAL.has(truck)) continue
    if (!physicalTrucks.has(truck)) {
      physicalTrucks.set(truck, { g: 0, e: 0, dp: 0, m: 0, n: 0 })
    }
    const phys = physicalTrucks.get(truck)!
    phys.g += row.g
    phys.e += row.e
    phys.dp += row.dp
    phys.m += row.m
    phys.n += row.n
  }

  const physicalList = [...physicalTrucks.values()]
  const count = physicalList.length
  const miles = physicalList.reduce((sum, truck) => sum + truck.m, 0)
  const gross = physicalList.reduce((sum, truck) => sum + truck.g, 0)
  const avg = (pick: (truck: (typeof physicalList)[number]) => number) =>
    count ? physicalList.reduce((sum, truck) => sum + pick(truck), 0) / count : null

  return {
    total,
    byOwner,
    physical: {
      count,
      avgGross: avg((truck) => truck.g),
      avgExp: avg((truck) => truck.e),
      avgPay: avg((truck) => truck.dp),
      avgMiles: avg((truck) => truck.m),
      rpm: miles > 0 ? gross / miles : null,
      miles,
      gross,
      lowGross: physicalList.filter((truck) => truck.g < LOW_GROSS_THRESHOLD).length,
      netNeg: physicalList.filter((truck) => truck.n < 0).length,
      netPos: physicalList.filter((truck) => truck.n > 0).length,
      netZero: physicalList.filter((truck) => truck.n === 0).length,
    },
  }
}

export function gallonsForSelection(
  rows: SettlementRow[],
  fuelByWeek: Record<string, FuelWeek>,
  owners: string[],
  ownersAll: string[]
): { gallons: number | null; mpg: number | null; products: string[] } {
  const weeks = uniqueSorted(rows.map((row) => row.pf))
  if (!weeks.length) return { gallons: null, mpg: null, products: [] }
  const allOwners = owners.length === ownersAll.length
  let gallons = 0
  let found = false
  const products = new Set<string>()
  for (const week of weeks) {
    const bucket = fuelByWeek[week]
    if (!bucket) continue
    found = true
    for (const product of bucket.products) products.add(product)
    if (allOwners) {
      gallons += bucket.gallons
      continue
    }
    for (const owner of owners) {
      gallons += bucket.byOwner[owner] ?? 0
    }
  }
  if (!found) return { gallons: null, mpg: null, products: [] }
  const physicalMiles = rows
    .filter((row) => !NON_PHYSICAL.has(String(row.t)))
    .reduce((sum, row) => sum + row.m, 0)
  return {
    gallons,
    mpg: gallons > 0 ? physicalMiles / gallons : null,
    products: [...products].sort(),
  }
}

export function weeklyTotals(
  rows: SettlementRow[],
  weeks: string[],
  owners: string[]
): Array<{ week: string; label: string; gross: number; net: number; fuel: number }> {
  const ownerSet = new Set(owners)
  const byWeek: Record<string, { g: number; n: number; f: number }> = {}
  for (const week of weeks) byWeek[week] = { g: 0, n: 0, f: 0 }
  for (const row of rows) {
    if (!ownerSet.has(row.o) || !byWeek[row.pf]) continue
    byWeek[row.pf].g += row.g
    byWeek[row.pf].n += row.n
    byWeek[row.pf].f += row.f
  }
  return weeks.map((week) => ({
    week,
    label: week.slice(5),
    gross: byWeek[week].g,
    net: byWeek[week].n,
    fuel: byWeek[week].f,
  }))
}

export function monthlyTotals(
  rows: SettlementRow[],
  months: string[],
  owners: string[]
): Array<{ month: string; label: string; gross: number; net: number; fuel: number }> {
  const ownerSet = new Set(owners)
  const byMonth: Record<string, { g: number; n: number; f: number }> = {}
  for (const month of months) byMonth[month] = { g: 0, n: 0, f: 0 }
  for (const row of rows) {
    if (!ownerSet.has(row.o)) continue
    const month = row.pf.slice(0, 7)
    if (!byMonth[month]) continue
    byMonth[month].g += row.g
    byMonth[month].n += row.n
    byMonth[month].f += row.f
  }
  return months.map((month) => ({
    month,
    label: monthLabel(month),
    gross: byMonth[month].g,
    net: byMonth[month].n,
    fuel: byMonth[month].f,
  }))
}

export function normalizeSettlementRow(row: Partial<SettlementRow> & Record<string, unknown>): SettlementRow | null {
  const pf = String(row.pf ?? "")
  const t = row.t == null ? "" : String(row.t)
  if (!pf || !t) return null
  const n = (value: unknown) => {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return {
    sid: n(row.sid),
    t,
    o: String(row.o ?? ""),
    d: String(row.d ?? ""),
    pf,
    pt: String(row.pt ?? ""),
    g: n(row.g),
    e: n(row.e),
    n: n(row.n),
    f: n(row.f),
    m: n(row.m),
    dp: n(row.dp),
    c: n(row.c),
    lo: n(row.lo),
    ltr: n(row.ltr),
    tl: n(row.tl),
    pp: n(row.pp),
  }
}
