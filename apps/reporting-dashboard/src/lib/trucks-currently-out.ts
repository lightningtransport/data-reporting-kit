/**
 * Distinct trucks currently out: DriverPay rows with Out Date set and Return Date null.
 * Not the exact Ninox in-yard/on-road formula — open assignment only.
 */

const DEFAULT_ENDPOINT =
  "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting"

const MAX_PAGES = 40
const PAGE_SIZE = 1000
const FETCH_CONCURRENCY = 6
/** How far back Out Date may be for an open assignment to count. */
export const TRUCKS_OUT_LOOKBACK_MONTHS = 18

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

function addMonths(isoDate: string, months: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 10)
}

function normalizeTruck(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

function isOpenAssignment(row: Record<string, unknown>): boolean {
  const outRaw = row["Out Date"]
  const outDate =
    outRaw == null || outRaw === "" ? "" : String(outRaw).slice(0, 10)
  if (!outDate) return false
  const returnRaw = row["Return Date"]
  return returnRaw == null || returnRaw === ""
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
        return_null: true,
        note: "Open assignment = Out Date present and Return Date null; distinct Truck_Number",
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
  const today = new Date().toISOString().slice(0, 10)
  const outFrom = addMonths(today, -TRUCKS_OUT_LOOKBACK_MONTHS)

  try {
    let result: Awaited<ReturnType<typeof fetchPages>>
    try {
      result = await fetchPages(endpoint, key, {
        report: "driver_pay",
        out_from: outFrom,
        return_null: "true",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      // Pre-deploy fallback when live function lacks return_null yet.
      if (!/HTTP 400/.test(message)) throw error
      result = await fetchPages(endpoint, key, {
        report: "driver_pay",
        out_from: outFrom,
      })
    }
    const trucks = new Set<string>()
    for (const row of result.rows) {
      if (!isOpenAssignment(row)) continue
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
          out_from: outFrom,
          return_null: true,
          lookback_months: TRUCKS_OUT_LOOKBACK_MONTHS,
          grain: "distinct Truck_Number",
          note: "Open assignment = Out Date present and Return Date null. Not exact Ninox in-yard/on-road.",
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
