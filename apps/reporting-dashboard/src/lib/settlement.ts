export type Vista = "semanal" | "mensual" | "diario"

export type SettlementRow = {
  sid: number
  t: string
  o: string
  pf: string
  pt: string
  g: number
  e: number
  n: number
  f: number
  m: number
  dp: number
}

export type SettlementMeta = {
  as_of: string
  source_freshness: string
  total_count: number
  fetched_count: number
  filters: Record<string, string | number | boolean>
  pagination_complete: boolean
  period_from_values: string[]
}

export type SettlementPayload = {
  meta: SettlementMeta
  rows: SettlementRow[]
}

export const NON_PHYSICAL = new Set(["1", "2", "3"])

export const MONTH_NAMES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const

export function monthLabel(ym: string): string {
  const [, month] = ym.split("-")
  return `${MONTH_NAMES[Number(month) - 1]} ${ym.slice(0, 4)}`
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
  return uniqueSorted(rows.map((row) => row.o))
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
  return match ? `${periodFrom} → ${match.pt}` : periodFrom
}

export function filterRows(
  rows: SettlementRow[],
  options: {
    vista: Vista
    week: string
    month: string
    owners: string[]
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
        np: NON_PHYSICAL.has(truck),
      }
    }
    const truckAgg = byTruck[truck]
    truckAgg.g += row.g
    truckAgg.e += row.e
    truckAgg.n += row.n
    truckAgg.f += row.f
    truckAgg.m += row.m
    truckAgg.o = row.o
  }

  return {
    byTruck,
    byOwner,
    kpi: { gross, exp, net, fuel, miles, phys: phys.size, rows: rows.length },
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
