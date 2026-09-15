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
const PAGE_SIZE = 1000
const FETCH_CONCURRENCY = 6
const LIVE_REVALIDATE_SECONDS = 300

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

type PagePayload<T> = {
  chunk: T[]
  totalCount: number
  asOf: string
  freshness: string
  hasMore: boolean
  nextOffset: number | null
}

async function fetchOffset<T>(
  endpoint: string,
  key: string,
  params: Record<string, string>,
  offset: number
): Promise<PagePayload<T>> {
  const url = new URL(endpoint)
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value)
  }
  url.searchParams.set("limit", String(PAGE_SIZE))
  url.searchParams.set("offset", String(offset))
  const response = await fetch(url, {
    headers: { "x-agent-key": key, Accept: "application/json" },
    cache: "no-store",
  })
  if (response.status === 416) {
    return {
      chunk: [],
      totalCount: 0,
      asOf: "",
      freshness: "",
      hasMore: false,
      nextOffset: null,
    }
  }
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
  return {
    chunk: payload.data ?? [],
    totalCount: Number(payload.total_count ?? 0),
    asOf: String(payload.as_of ?? ""),
    freshness: String(payload.source_freshness ?? ""),
    hasMore: Boolean(payload.has_more),
    nextOffset: payload.next_offset ?? null,
  }
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
  const first = await fetchOffset<T>(endpoint, key, params, 0)
  const rows = [...first.chunk]
  let asOf = first.asOf
  let freshness = first.freshness
  const totalCount = first.totalCount
  if (!first.hasMore) {
    return { rows, totalCount, asOf, freshness, complete: true }
  }

  const step = first.chunk.length || PAGE_SIZE
  const offsets: number[] = []
  let offset = first.nextOffset
  while (
    offset != null &&
    offset !== 0 &&
    offsets.length < MAX_PAGES &&
    (totalCount ? offset < totalCount : true)
  ) {
    offsets.push(offset)
    offset += step
  }

  for (let i = 0; i < offsets.length; i += FETCH_CONCURRENCY) {
    const batch = offsets.slice(i, i + FETCH_CONCURRENCY)
    const pages = await Promise.all(
      batch.map((value) => fetchOffset<T>(endpoint, key, params, value))
    )
    for (const page of pages) {
      rows.push(...page.chunk)
      asOf = page.asOf || asOf
      freshness = page.freshness || freshness
    }
  }

  const complete = totalCount ? rows.length === totalCount : !first.hasMore
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

  const [settlements, fuel] = await Promise.all([
    fetchPages<LiveSettlement>(endpoint, key, {
      report: "settlements",
      period_from: historyStart,
      period_to: today,
    }),
    fetchPages<FuelLive>(endpoint, key, {
      report: "fuel",
      store_from: historyStart,
      store_to: today,
    }).catch(() => null),
  ])
  const rows = settlements.rows
    .map(mapSettlement)
    .filter((row): row is SettlementRow => row !== null)
    .sort((a, b) => a.pf.localeCompare(b.pf) || a.sid - b.sid)

  const weekBounds = [...new Map(rows.map((row) => [row.pf, { pf: row.pf, pt: row.pt || row.pf }])).values()]
  const fuelByWeek = fuel ? aggregateFuel(fuel.rows, weekBounds) : {}
  const fuelComplete = Boolean(fuel?.complete)
  const fuelFetched = fuel?.rows.length ?? 0
  const fuelTotal = fuel?.totalCount ?? 0

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
        html_revalidate_seconds: LIVE_REVALIDATE_SECONDS,
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
