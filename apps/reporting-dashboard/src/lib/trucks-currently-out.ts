/**
 * Distinct on-road trucks: DriverPay Out Date <= date AND Return Date > date.
 */

const DEFAULT_ENDPOINT =
  "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting"

const MAX_PAGES = 40
const PAGE_SIZE = 1000
const FETCH_CONCURRENCY = 6


export type TrucksCurrentlyOutPayload = {
  count: number
  meta: {
    as_of: string
    source_freshness: string
    total_count: number
    fetched_count: number
    pagination_complete: boolean
    live: boolean
    dataset: string
    filters: Record<string, string | number | boolean>
    error?: string
  }
}

type PagePayload = {
  chunk: Record<string, unknown>[]
  totalCount: number
  asOf: string
  freshness: string
  hasMore: boolean
  nextOffset: number | null
}


function normalizeTruck(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

export function isOnRoadAssignment(row: Record<string, unknown>, date: string): boolean {
  const outRaw = row["Out Date"]
  const outDate =
    outRaw == null || outRaw === "" ? "" : String(outRaw).slice(0, 10)
  const returnRaw = row["Return Date"]
  const returnDate = returnRaw == null || returnRaw === "" ? "" : String(returnRaw).slice(0, 10)
  return Boolean(outDate && returnDate && outDate <= date && returnDate > date)
}

async function fetchOffset(
  endpoint: string,
  key: string,
  params: Record<string, string>,
  offset: number
): Promise<PagePayload> {
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
    throw new Error(`agent-reporting driver_pay HTTP ${response.status}`)
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

async function fetchPages(
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

function emptyPayload(error?: string): TrucksCurrentlyOutPayload {
  return {
    count: 0,
    meta: {
      as_of: new Date().toISOString(),
      source_freshness: error
        ? "unavailable: live agent-reporting driver_pay required"
        : "empty",
      total_count: 0,
      fetched_count: 0,
      pagination_complete: false,
      live: false,
      dataset: "driver_pay",
      filters: {
        report: "driver_pay",
        note: "On road = Out Date <= date and Return Date > date; distinct Truck_Number",
      },
      error,
    },
  }
}

export async function getTrucksCurrentlyOut(): Promise<TrucksCurrentlyOutPayload> {
  const key = process.env.AGENT_REPORTING_KEY
  if (!key) {
    return emptyPayload("AGENT_REPORTING_KEY is not configured")
  }
  const endpoint = process.env.AGENT_REPORTING_ENDPOINT || DEFAULT_ENDPOINT
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date())

  try {
    const result = await fetchPages(endpoint, key, {
      report: "driver_pay", on_road_at: today,
    })
    if (!result.complete) throw new Error("Incomplete on-road DriverPay pagination")
    const trucks = new Set<string>()
    for (const row of result.rows) {
      if (!isOnRoadAssignment(row, today)) continue
      const truck = normalizeTruck(row.Truck_Number)
      if (truck) trucks.add(truck)
    }
    return {
      count: trucks.size,
      meta: {
        as_of: result.asOf || new Date().toISOString(),
        source_freshness:
          result.freshness ||
          "unknown: source tables do not expose a sync timestamp",
        total_count: result.totalCount || result.rows.length,
        fetched_count: result.rows.length,
        pagination_complete: result.complete,
        live: true,
        dataset: "driver_pay",
        filters: {
          report: "driver_pay",
          on_road_at: today,
          timezone: "America/New_York",
          grain: "distinct Truck_Number",
          note: "Out Date <= date AND Return Date > date; excludes null returns and return day.",
        },
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown driver_pay error"
    console.error("[reporting-dashboard] trucks currently out unavailable", {
      message: message.slice(0, 240),
    })
    return emptyPayload(message.slice(0, 240))
  }
}
