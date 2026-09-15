import embedded from "@/data/settlement-summary.json"
import {
  DASHBOARD_HISTORY_MONTHS,
  normalizeSettlementRow,
  type FuelWeek,
  type SettlementPayload,
  type SettlementRow,
} from "@/lib/settlement"

const DEFAULT_ENDPOINT =
  "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting"

const MAX_PAGES = 80

function num(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getEmbeddedSettlementSummary(): SettlementPayload {
  const raw = embedded as {
    meta?: SettlementPayload["meta"]
    rows?: Array<Partial<SettlementRow>>
    fuelByWeek?: Record<string, FuelWeek>
  }
  const rows = (raw.rows ?? [])
    .map((row) => normalizeSettlementRow(row))
    .filter((row): row is SettlementRow => row !== null)
  return {
    meta: {
      as_of: String(raw.meta?.as_of ?? ""),
      source_freshness: String(raw.meta?.source_freshness ?? "embedded-snapshot"),
      total_count: Number(raw.meta?.total_count ?? rows.length),
      fetched_count: Number(raw.meta?.fetched_count ?? rows.length),
      filters: raw.meta?.filters ?? { dataset: "embedded-settlements-fallback" },
      pagination_complete: Boolean(raw.meta?.pagination_complete),
      period_from_values: [...new Set(rows.map((row) => row.pf))].sort(),
      live: false,
      dataset: "settlements-embedded-fallback",
      fuel_pagination_complete: false,
      fuel_fetched_count: 0,
      fuel_total_count: 0,
    },
    rows,
    fuelByWeek: raw.fuelByWeek ?? {},
  }
}

export function tuesdayOnOrBefore(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  const day = date.getUTCDay()
  const delta = (day + 5) % 7
  date.setUTCDate(date.getUTCDate() - delta)
  return date.toISOString().slice(0, 10)
}

export function addMonths(isoDate: string, months: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 10)
}

export function dashboardHistoryStart(today = new Date().toISOString().slice(0, 10)): string {
  return tuesdayOnOrBefore(addMonths(today, -DASHBOARD_HISTORY_MONTHS))
}

type LiveSettlement = Record<string, unknown>

function mapSettlement(row: LiveSettlement): SettlementRow | null {
  const from = row.From
  const truck = row.Truck
  if (from == null || truck == null) return null
  return {
    sid: num(row.ID),
    t: String(truck),
    o: String(row.Owner ?? ""),
    d: String(row.Dispatch ?? ""),
    pf: String(from),
    pt: String(row.To ?? ""),
    g: num(row.Gross),
    e: num(row["Total Expenses"]),
    n: num(row.Net),
    f: num(row["Fuel Expenses"]),
    m: num(row.Driven_miles),
    dp: num(row["Total Driver Pay"]),
    c: num(row.tonu),
    lo: num(row.truck_loans),
    ltr: num(row["LTR Invoices"]),
    tl: num(row.Tolls),
    pp: num(row.PrePass),
  }
}

type FuelLive = {
  Gallons?: number
  owner?: string
  Product?: string
  "Store Date"?: string
  Unit?: number
}

async function fetchPages<T>(
  endpoint: string,
  key: string,
  params: Record<string, string>
): Promise<{
  rows: T[]
  totalCount: number
  asOf: string
  freshness: string
  complete: boolean
}> {
  const rows: T[] = []
  let offset = 0
  let totalCount = 0
  let asOf = ""
  let freshness = ""
  let complete = false
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(endpoint)
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value)
    }
    url.searchParams.set("limit", "1000")
    url.searchParams.set("offset", String(offset))
    const response = await fetch(url, {
      headers: { "x-agent-key": key, Accept: "application/json" },
      cache: "no-store",
    })
    if (!response.ok) {
      throw new Error(`agent-reporting HTTP ${response.status}`)
    }
    const payload = (await response.json()) as {
      data?: T[]
      total_count?: number
      as_of?: string
      source_freshness?: string
      has_more?: boolean
      next_offset?: number | null
    }
    asOf = String(payload.as_of ?? asOf)
    freshness = String(payload.source_freshness ?? freshness)
    totalCount = Number(payload.total_count ?? totalCount)
    const chunk = payload.data ?? []
    rows.push(...chunk)
    if (!payload.has_more) {
      complete = true
      break
    }
    if (payload.next_offset == null || payload.next_offset === offset) {
      complete = false
      break
    }
    offset = payload.next_offset
  }
  return { rows, totalCount, asOf, freshness, complete }
}

function fuelWeekKey(storeDate: string, weekBounds: Array<{ pf: string; pt: string }>): string | null {
  for (const week of weekBounds) {
    if (storeDate >= week.pf && storeDate <= week.pt) return week.pf
  }
  return null
}

function aggregateFuel(
  transactions: FuelLive[],
  weekBounds: Array<{ pf: string; pt: string }>
): Record<string, FuelWeek> {
  const byWeek: Record<string, FuelWeek> = {}
  for (const txn of transactions) {
    const storeDate = String(txn["Store Date"] ?? "")
    if (!storeDate) continue
    const week = fuelWeekKey(storeDate, weekBounds)
    if (!week) continue
    if (!byWeek[week]) byWeek[week] = { gallons: 0, byOwner: {}, products: [] }
    const gallons = num(txn.Gallons)
    const owner = String(txn.owner ?? "")
    const product = String(txn.Product ?? "").trim()
    byWeek[week].gallons += gallons
    if (owner) byWeek[week].byOwner[owner] = (byWeek[week].byOwner[owner] ?? 0) + gallons
    if (product && !byWeek[week].products.includes(product)) {
      byWeek[week].products.push(product)
    }
  }
  for (const week of Object.values(byWeek)) {
    week.products.sort()
  }
  return byWeek
}

export async function fetchLiveSettlements(): Promise<SettlementPayload> {
  const key = process.env.AGENT_REPORTING_KEY
  if (!key) {
    throw new Error("AGENT_REPORTING_KEY is not configured")
  }
  const endpoint = process.env.AGENT_REPORTING_ENDPOINT || DEFAULT_ENDPOINT
  const today = new Date().toISOString().slice(0, 10)
  const historyStart = dashboardHistoryStart(today)

  const settlements = await fetchPages<LiveSettlement>(endpoint, key, {
    report: "settlements",
    period_from: historyStart,
    period_to: today,
  })
  const rows = settlements.rows
    .map(mapSettlement)
    .filter((row): row is SettlementRow => row !== null)
    .sort((a, b) => a.pf.localeCompare(b.pf) || a.sid - b.sid)

  const weekBounds = [...new Map(rows.map((row) => [row.pf, { pf: row.pf, pt: row.pt || row.pf }])).values()]
  let fuelByWeek: Record<string, FuelWeek> = {}
  let fuelComplete = false
  let fuelFetched = 0
  let fuelTotal = 0
  try {
    const fuel = await fetchPages<FuelLive>(endpoint, key, {
      report: "fuel",
      store_from: historyStart,
      store_to: today,
    })
    fuelByWeek = aggregateFuel(fuel.rows, weekBounds)
    fuelComplete = fuel.complete
    fuelFetched = fuel.rows.length
    fuelTotal = fuel.totalCount
  } catch {
    fuelByWeek = {}
  }

  return {
    meta: {
      as_of: settlements.asOf,
      source_freshness:
        settlements.freshness ||
        "unknown: source tables do not expose a sync timestamp",
      total_count: settlements.totalCount || rows.length,
      fetched_count: rows.length,
      filters: {
        period_from: historyStart,
        period_to: today,
        dataset: "settlements",
        history_months: DASHBOARD_HISTORY_MONTHS,
        note: "Paginated settlements plus fuel gallons bucketed onto settlement weeks",
      },
      pagination_complete: settlements.complete && rows.length === (settlements.totalCount || rows.length),
      period_from_values: [...new Set(rows.map((row) => row.pf))].sort(),
      live: true,
      dataset: "settlements",
      fuel_pagination_complete: fuelComplete,
      fuel_fetched_count: fuelFetched,
      fuel_total_count: fuelTotal,
    },
    rows,
    fuelByWeek,
  }
}

export async function getSettlementSummary(): Promise<SettlementPayload> {
  if (!process.env.AGENT_REPORTING_KEY) {
    return getEmbeddedSettlementSummary()
  }
  try {
    return await fetchLiveSettlements()
  } catch {
    return getEmbeddedSettlementSummary()
  }
}
