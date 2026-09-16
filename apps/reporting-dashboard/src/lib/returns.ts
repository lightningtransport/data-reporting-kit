const DEFAULT_ENDPOINT =
  "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting"

const MAX_PAGES = 40
const PAGE_SIZE = 1000
const FETCH_CONCURRENCY = 6
const LIVE_REVALIDATE_SECONDS = 300

export type ReturnRow = {
  id: number
  truck: string
  insurance: string
  driverName: string
  returnDate: string
}

export type ReturnsPayload = {
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
    error?: string
  }
  rows: ReturnRow[]
}

type PagePayload<T> = {
  chunk: T[]
  totalCount: number
  asOf: string
  freshness: string
  hasMore: boolean
  nextOffset: number | null
}

function mapReturn(row: Record<string, unknown>): ReturnRow | null {
  const truck = row.Truck
  if (truck == null || String(truck).trim() === "") return null
  const returnDateRaw = row["Return Date"]
  const returnDate =
    returnDateRaw == null || returnDateRaw === ""
      ? ""
      : String(returnDateRaw).slice(0, 10)
  return {
    id: Number(row.ID ?? 0),
    truck: String(truck).trim(),
    insurance: String(row.Insurance ?? "").trim(),
    driverName: String(row["Driver Name"] ?? "").trim(),
    returnDate,
  }
}

async function fetchOffset(
  endpoint: string,
  key: string,
  offset: number
): Promise<PagePayload<Record<string, unknown>>> {
  const url = new URL(endpoint)
  url.searchParams.set("report", "returns")
  url.searchParams.set("limit", String(PAGE_SIZE))
  url.searchParams.set("offset", String(offset))
  const response = await fetch(url, {
    headers: { "x-agent-key": key, Accept: "application/json" },
    next: { revalidate: LIVE_REVALIDATE_SECONDS },
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
    throw new Error(`agent-reporting returns HTTP ${response.status}`)
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

async function fetchAllReturns(
  endpoint: string,
  key: string
): Promise<{
  rows: Record<string, unknown>[]
  totalCount: number
  asOf: string
  freshness: string
  complete: boolean
}> {
  const first = await fetchOffset(endpoint, key, 0)
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
    const pages = await Promise.all(batch.map((value) => fetchOffset(endpoint, key, value)))
    for (const page of pages) {
      rows.push(...page.chunk)
      asOf = page.asOf || asOf
      freshness = page.freshness || freshness
    }
  }

  const complete = totalCount ? rows.length === totalCount : !first.hasMore
  return { rows, totalCount, asOf, freshness, complete }
}

export function emptyReturnsPayload(error?: string): ReturnsPayload {
  return {
    meta: {
      as_of: new Date().toISOString(),
      source_freshness: error
        ? "unavailable: configure AGENT_REPORTING_KEY for live returns"
        : "empty",
      total_count: 0,
      fetched_count: 0,
      pagination_complete: false,
      live: false,
      dataset: "returns",
      filters: {
        report: "returns",
        include_sensitive: false,
        note: "Phone Number and CDL are never requested for this dashboard",
      },
      distinct_trucks: 0,
      error,
    },
    rows: [],
  }
}

export async function getReturns(): Promise<ReturnsPayload> {
  const key = process.env.AGENT_REPORTING_KEY
  if (!key) {
    return emptyReturnsPayload("AGENT_REPORTING_KEY is not configured")
  }
  try {
    const endpoint = process.env.AGENT_REPORTING_ENDPOINT || DEFAULT_ENDPOINT
    const result = await fetchAllReturns(endpoint, key)
    const rows = result.rows
      .map(mapReturn)
      .filter((row): row is ReturnRow => row !== null)
      .sort(
        (a, b) =>
          (a.returnDate || "9999-99-99").localeCompare(b.returnDate || "9999-99-99") ||
          a.truck.localeCompare(b.truck) ||
          a.driverName.localeCompare(b.driverName)
      )
    const distinctTrucks = new Set(rows.map((row) => row.truck)).size
    return {
      meta: {
        as_of: result.asOf || new Date().toISOString(),
        source_freshness:
          result.freshness ||
          "unknown: source tables do not expose a sync timestamp",
        total_count: result.totalCount || rows.length,
        fetched_count: rows.length,
        pagination_complete: result.complete && rows.length === (result.totalCount || rows.length),
        live: true,
        dataset: "returns",
        filters: {
          report: "returns",
          include_sensitive: false,
          revalidate_seconds: LIVE_REVALIDATE_SECONDS,
          note: "Current expected-return list; driver-row grain; Phone/CDL omitted",
        },
        distinct_trucks: distinctTrucks,
      },
      rows,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown returns error"
    console.error("[reporting-dashboard] returns unavailable", {
      message: message.slice(0, 240),
    })
    return emptyReturnsPayload(message.slice(0, 240))
  }
}
