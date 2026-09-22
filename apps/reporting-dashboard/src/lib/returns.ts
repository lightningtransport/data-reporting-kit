const DEFAULT_ENDPOINT =
  "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting"

const MAX_PAGES = 40
const PAGE_SIZE = 1000
const FETCH_CONCURRENCY = 6
const DRIVER_PAY_PAST_DAYS = 56
const DRIVER_PAY_FUTURE_DAYS = 84

export type ReturnRow = {
  id: number
  truck: string
  insurance: string
  driverName: string
  returnDate: string
  source: "returns" | "driver_pay"
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
    source_counts?: {
      returns_rows: number
      returns_trucks: number
      driver_pay_rows: number
      driver_pay_qualifying_rows: number
      driver_pay_trucks: number
      driver_pay_team_rows: number
      driver_pay_solo_rows: number
      driver_pay_formula_count: number
      overlap_trucks: number
      union_trucks: number
    }
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

type QueryResult = {
  rows: Record<string, unknown>[]
  totalCount: number
  asOf: string
  freshness: string
  complete: boolean
}

function normalizeTruck(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

function isoDate(value: unknown): string {
  return value == null || value === "" ? "" : String(value).slice(0, 10)
}

function mapReturnsRow(row: Record<string, unknown>): ReturnRow | null {
  const truck = normalizeTruck(row.Truck)
  if (!truck) return null
  return {
    id: Number(row.ID ?? 0),
    truck,
    insurance: String(row.Insurance ?? "").trim(),
    driverName: String(row["Driver Name"] ?? "").trim(),
    returnDate: isoDate(row["Return Date"]),
    source: "returns",
  }
}

function mapDriverPayRow(row: Record<string, unknown>): ReturnRow | null {
  const truck = normalizeTruck(row.Truck_Number)
  if (!truck) return null
  return {
    id: Number(row.ID ?? 0),
    truck,
    insurance: "",
    driverName: String(row["Driver Name"] ?? "").trim(),
    returnDate: isoDate(row["Return Date"]),
    source: "driver_pay",
  }
}

function isQualifyingDriverPayReturn(row: Record<string, unknown>): boolean {
  return (
    row.Termination !== "Driver Changed" &&
    row.Transfer !== "Transfer To Other Truck"
  )
}

export function driverPayReturnMetric(rows: Record<string, unknown>[]) {
  const qualifying = rows.filter(isQualifyingDriverPayReturn)
  const teamRows = qualifying.filter((row) => Number(row.Solo_Driver_if_1) !== 1)
  const soloRows = qualifying.filter((row) => Number(row.Solo_Driver_if_1) === 1)
  const mapped = qualifying
    .map(mapDriverPayRow)
    .filter((row): row is ReturnRow => row !== null)
  return {
    rows: mapped,
    trucks: new Set(mapped.map((row) => row.truck)),
    teamRows: teamRows.length,
    soloRows: soloRows.length,
    formulaCount: Math.floor(teamRows.length / 2 + soloRows.length),
  }
}

/**
 * Union the two approved return sources by truck/date. When both sources carry the
 * same truck/date, keep the current returns rows and suppress duplicate DriverPay
 * detail. Weekly counts still deduplicate truck number after date filtering.
 */
export function mergeReturningTruckRows(
  returnsRows: ReturnRow[],
  driverPayRows: ReturnRow[]
): ReturnRow[] {
  const currentKeys = new Set(
    returnsRows.map((row) => `${row.truck}\u0000${row.returnDate}`)
  )
  return [
    ...returnsRows,
    ...driverPayRows.filter(
      (row) => !currentKeys.has(`${row.truck}\u0000${row.returnDate}`)
    ),
  ].sort(
    (a, b) =>
      (a.returnDate || "9999-99-99").localeCompare(b.returnDate || "9999-99-99") ||
      a.truck.localeCompare(b.truck) ||
      a.driverName.localeCompare(b.driverName)
  )
}

async function fetchOffset(
  endpoint: string,
  key: string,
  params: Record<string, string>,
  offset: number
): Promise<PagePayload<Record<string, unknown>>> {
  const url = new URL(endpoint)
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
  url.searchParams.set("limit", String(PAGE_SIZE))
  url.searchParams.set("offset", String(offset))
  const response = await fetch(url, {
    headers: { "x-agent-key": key, Accept: "application/json" },
    cache: "no-store",
  })
  if (response.status === 416) {
    return { chunk: [], totalCount: 0, asOf: "", freshness: "", hasMore: false, nextOffset: null }
  }
  if (!response.ok) {
    throw new Error(`agent-reporting ${params.report} HTTP ${response.status}`)
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
): Promise<QueryResult> {
  const first = await fetchOffset(endpoint, key, params, 0)
  const rows = [...first.chunk]
  let asOf = first.asOf
  let freshness = first.freshness
  const totalCount = first.totalCount
  if (!first.hasMore) return { rows, totalCount, asOf, freshness, complete: true }

  const step = first.chunk.length || PAGE_SIZE
  const offsets: number[] = []
  let offset = first.nextOffset
  while (offset != null && offset !== 0 && offsets.length < MAX_PAGES && (totalCount ? offset < totalCount : true)) {
    offsets.push(offset)
    offset += step
  }
  for (let i = 0; i < offsets.length; i += FETCH_CONCURRENCY) {
    const pages = await Promise.all(
      offsets.slice(i, i + FETCH_CONCURRENCY).map((value) => fetchOffset(endpoint, key, params, value))
    )
    for (const page of pages) {
      rows.push(...page.chunk)
      asOf = page.asOf || asOf
      freshness = page.freshness || freshness
    }
  }
  return { rows, totalCount, asOf, freshness, complete: totalCount ? rows.length === totalCount : !first.hasMore }
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function mondayFor(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  const day = date.getUTCDay()
  return addDays(iso, -(day === 0 ? 6 : day - 1))
}

export function emptyReturnsPayload(error?: string): ReturnsPayload {
  return {
    meta: {
      as_of: new Date().toISOString(),
      source_freshness: error ? "unavailable: configure AGENT_REPORTING_KEY for live returns" : "empty",
      total_count: 0,
      fetched_count: 0,
      pagination_complete: false,
      live: false,
      dataset: "returns + driver_pay",
      filters: {
        reports: "returns,driver_pay",
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
  if (!key) return emptyReturnsPayload("AGENT_REPORTING_KEY is not configured")

  try {
    const endpoint = process.env.AGENT_REPORTING_ENDPOINT || DEFAULT_ENDPOINT
    const today = new Date().toISOString().slice(0, 10)
    const currentMonday = mondayFor(today)
    const returnFrom = addDays(currentMonday, -DRIVER_PAY_PAST_DAYS)
    const returnTo = addDays(currentMonday, DRIVER_PAY_FUTURE_DAYS + 6)
    const [returnsResult, driverPayResult] = await Promise.all([
      fetchPages(endpoint, key, { report: "returns" }),
      fetchPages(endpoint, key, {
        report: "driver_pay",
        return_from: returnFrom,
        return_to: returnTo,
      }),
    ])

    const returnsRows = returnsResult.rows
      .map(mapReturnsRow)
      .filter((row): row is ReturnRow => row !== null)
    const driverPayMetric = driverPayReturnMetric(driverPayResult.rows)
    const rows = mergeReturningTruckRows(returnsRows, driverPayMetric.rows)
    const returnsTrucks = new Set(returnsRows.map((row) => row.truck))
    const driverPayTrucks = driverPayMetric.trucks
    const overlap = new Set([...returnsTrucks].filter((truck) => driverPayTrucks.has(truck)))
    const union = new Set([...returnsTrucks, ...driverPayTrucks])

    return {
      meta: {
        as_of: [returnsResult.asOf, driverPayResult.asOf].filter(Boolean).sort().at(-1) || new Date().toISOString(),
        source_freshness: returnsResult.freshness || driverPayResult.freshness || "unknown: source tables do not expose a sync timestamp",
        total_count: returnsResult.totalCount + driverPayResult.totalCount,
        fetched_count: returnsRows.length + driverPayResult.rows.length,
        pagination_complete: returnsResult.complete && driverPayResult.complete,
        live: true,
        dataset: "returns + driver_pay",
        filters: {
          returns_report: "returns",
          driver_pay_report: "driver_pay",
          return_from: returnFrom,
          return_to: returnTo,
          termination_exclusion: "Driver Changed",
          transfer_exclusion: "Transfer To Other Truck",
          driver_pay_formula: "floor(tc / 2 + ts)",
          include_sensitive: false,
          note: "Union unique truck numbers after applying DriverPay return exclusions",
        },
        distinct_trucks: union.size,
        source_counts: {
          returns_rows: returnsRows.length,
          returns_trucks: returnsTrucks.size,
          driver_pay_rows: driverPayResult.rows.length,
          driver_pay_qualifying_rows: driverPayMetric.rows.length,
          driver_pay_trucks: driverPayTrucks.size,
          driver_pay_team_rows: driverPayMetric.teamRows,
          driver_pay_solo_rows: driverPayMetric.soloRows,
          driver_pay_formula_count: driverPayMetric.formulaCount,
          overlap_trucks: overlap.size,
          union_trucks: union.size,
        },
      },
      rows,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown returns error"
    console.error("[reporting-dashboard] returns unavailable", { message: message.slice(0, 240) })
    return emptyReturnsPayload(message.slice(0, 240))
  }
}
