const DEFAULT_ENDPOINT =
  "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting"

const MAX_PAGES = 80
const PAGE_SIZE = 1000
const FETCH_CONCURRENCY = 6
export const DIESEL_HISTORY_MONTHS = 12

export type FuelRow = {
  id: number
  unit: string
  storeDate: string
  product: string
  subTotal: number | null
  adjustedSubTotal: number | null
  gallons: number | null
  city: string
  state: string
  pricePerGallon: number | null
  owner: string
}

export type FuelPayload = {
  meta: {
    as_of: string
    source_freshness: string
    total_count: number
    fetched_count: number
    pagination_complete: boolean
    live: boolean
    dataset: string
    filters: Record<string, string | number | boolean>
    distinct_trucks: number
    months: string[]
    error?: string
  }
  rows: FuelRow[]
}

type PagePayload<T> = {
  chunk: T[]
  totalCount: number
  asOf: string
  freshness: string
  hasMore: boolean
  nextOffset: number | null
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapFuel(row: Record<string, unknown>): FuelRow | null {
  const storeDateRaw = row["Store Date"]
  const storeDate =
    storeDateRaw == null || storeDateRaw === ""
      ? ""
      : String(storeDateRaw).slice(0, 10)
  const unit = row.Unit
  if (!storeDate && (unit == null || String(unit).trim() === "")) return null
  return {
    id: Number(row.id ?? 0),
    unit: unit == null ? "" : String(unit).trim(),
    storeDate,
    product: String(row.Product ?? "").trim(),
    subTotal: numOrNull(row.SubTotal),
    adjustedSubTotal: numOrNull(row["Adjusted SubTotal"]),
    gallons: numOrNull(row.Gallons),
    city: String(row.City ?? "").trim(),
    state: String(row.State ?? "").trim(),
    pricePerGallon: numOrNull(row.Price_Per_Gallon),
    owner: String(row.owner ?? "").trim(),
  }
}

function monthKey(isoDate: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate.slice(0, 7) : ""
}

export function addMonthsIso(isoDate: string, months: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 10)
}

export function dieselHistoryStart(today = new Date().toISOString().slice(0, 10)): string {
  const start = addMonthsIso(today, -DIESEL_HISTORY_MONTHS)
  return `${start.slice(0, 7)}-01`
}

async function fetchOffset(
  endpoint: string,
  key: string,
  params: Record<string, string>,
  offset: number
): Promise<PagePayload<Record<string, unknown>>> {
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
    throw new Error(`agent-reporting fuel HTTP ${response.status}`)
  }
  const payload = (await response.json()) as {
    data?: Record<string, unknown>[]
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

async function fetchAllFuel(
  endpoint: string,
  key: string,
  params: Record<string, string>
): Promise<{
  rows: Record<string, unknown>[]
  totalCount: number
  asOf: string
  freshness: string
  complete: boolean
}> {
  const first = await fetchOffset(endpoint, key, params, 0)
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
      batch.map((value) => fetchOffset(endpoint, key, params, value))
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

export function emptyFuelPayload(error?: string): FuelPayload {
  return {
    meta: {
      as_of: new Date().toISOString(),
      source_freshness: error
        ? "unavailable: configure AGENT_REPORTING_KEY for live fuel"
        : "empty",
      total_count: 0,
      fetched_count: 0,
      pagination_complete: false,
      live: false,
      dataset: "fuel",
      filters: {
        report: "fuel",
        note: "No embedded snapshot; live agent-reporting only",
      },
      distinct_trucks: 0,
      months: [],
      error,
    },
    rows: [],
  }
}

/** Applicable spend: Adjusted SubTotal when populated; otherwise null (do not silently use SubTotal). */
export function applicableSpend(row: FuelRow): number | null {
  return row.adjustedSubTotal
}

export function aggregateFuelRows(rows: FuelRow[]): {
  gallons: number
  adjustedSpend: number
  adjustedSpendCount: number
  transactions: number
  distinctTrucks: number
  pricePerGallon: number | null
} {
  let gallons = 0
  let adjustedSpend = 0
  let adjustedSpendCount = 0
  const trucks = new Set<string>()
  for (const row of rows) {
    if (row.gallons != null) gallons += row.gallons
    if (row.adjustedSubTotal != null) {
      adjustedSpend += row.adjustedSubTotal
      adjustedSpendCount += 1
    }
    if (row.unit) trucks.add(row.unit)
  }
  return {
    gallons,
    adjustedSpend,
    adjustedSpendCount,
    transactions: rows.length,
    distinctTrucks: trucks.size,
    pricePerGallon: gallons > 0 && adjustedSpendCount > 0 ? adjustedSpend / gallons : null,
  }
}

export async function getFuel(): Promise<FuelPayload> {
  const key = process.env.AGENT_REPORTING_KEY
  if (!key) {
    return emptyFuelPayload("AGENT_REPORTING_KEY is not configured")
  }
  try {
    const endpoint = process.env.AGENT_REPORTING_ENDPOINT || DEFAULT_ENDPOINT
    const today = new Date().toISOString().slice(0, 10)
    const storeFrom = dieselHistoryStart(today)
    const result = await fetchAllFuel(endpoint, key, {
      report: "fuel",
      store_from: storeFrom,
      store_to: today,
    })
    const rows = result.rows
      .map(mapFuel)
      .filter((row): row is FuelRow => row !== null)
      .sort(
        (a, b) =>
          b.storeDate.localeCompare(a.storeDate) ||
          a.unit.localeCompare(b.unit) ||
          a.id - b.id
      )
    const months = [
      ...new Set(rows.map((row) => monthKey(row.storeDate)).filter(Boolean)),
    ].sort()
    const distinctTrucks = new Set(rows.map((row) => row.unit).filter(Boolean)).size
    return {
      meta: {
        as_of: result.asOf || new Date().toISOString(),
        source_freshness:
          result.freshness ||
          "unknown: source tables do not expose a sync timestamp",
        total_count: result.totalCount || rows.length,
        fetched_count: rows.length,
        pagination_complete:
          result.complete && rows.length === (result.totalCount || rows.length),
        live: true,
        dataset: "fuel",
        filters: {
          report: "fuel",
          store_from: storeFrom,
          store_to: today,
          history_months: DIESEL_HISTORY_MONTHS,
          note: "Live fuel transactions; owner is historical fuel.owner; Adjusted SubTotal for spend when populated",
        },
        distinct_trucks: distinctTrucks,
        months,
      },
      rows,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fuel error"
    console.error("[reporting-dashboard] fuel unavailable", {
      message: message.slice(0, 240),
    })
    return emptyFuelPayload(message.slice(0, 240))
  }
}
