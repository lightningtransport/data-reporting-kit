const DEFAULT_ENDPOINT =
  "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting"

const MAX_PAGES = 80
const PAGE_SIZE = 1000
const FETCH_CONCURRENCY = 8
export const DIESEL_HISTORY_MONTHS = 12
/** Cap transaction rows shipped/rendered per focus month to keep the page interactive. */
export const DIESEL_DETAIL_ROW_CAP = 400

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

export type FuelAgg = {
  gallons: number
  spend: number
  transactions: number
  trucks: number
}

export type FuelMonthSeries = {
  month: string
  all: FuelAgg
  diesel: FuelAgg
  def: FuelAgg
  byOwner: Record<
    string,
    {
      all: FuelAgg
      diesel: FuelAgg
      def: FuelAgg
    }
  >
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
    detail_month: string
    detail_row_count: number
    detail_truncated: boolean
    error?: string
  }
  monthly: FuelMonthSeries[]
  owners: string[]
  products: string[]
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

type MutableAgg = {
  gallons: number
  spend: number
  transactions: number
  trucks: Set<string>
}

function emptyMutable(): MutableAgg {
  return { gallons: 0, spend: 0, transactions: 0, trucks: new Set() }
}

function freezeAgg(value: MutableAgg): FuelAgg {
  return {
    gallons: value.gallons,
    spend: value.spend,
    transactions: value.transactions,
    trucks: value.trucks.size,
  }
}

function addToAgg(target: MutableAgg, row: FuelRow) {
  target.transactions += 1
  if (row.gallons != null) target.gallons += row.gallons
  if (row.adjustedSubTotal != null) target.spend += row.adjustedSubTotal
  if (row.unit) target.trucks.add(row.unit)
}

function isDefProduct(product: string): boolean {
  return product.toLowerCase().includes("def")
}

function isDieselProduct(product: string): boolean {
  const name = product.toLowerCase()
  return name.includes("diesel") && !name.includes("def")
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

export function monthBounds(ym: string, today = new Date().toISOString().slice(0, 10)): {
  storeFrom: string
  storeTo: string
} {
  const storeFrom = `${ym}-01`
  const [year, month] = ym.split("-").map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const storeToFull = `${ym}-${String(lastDay).padStart(2, "0")}`
  return {
    storeFrom,
    storeTo: storeToFull > today ? today : storeToFull,
  }
}

function listMonthKeys(storeFrom: string, storeTo: string): string[] {
  const keys: string[] = []
  let cursor = storeFrom.slice(0, 7)
  const end = storeTo.slice(0, 7)
  while (cursor <= end) {
    keys.push(cursor)
    const [year, month] = cursor.split("-").map(Number)
    const next = new Date(Date.UTC(year, month - 1 + 1, 1))
    cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`
  }
  return keys
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

function accumulateMonth(rows: FuelRow[]): {
  all: MutableAgg
  diesel: MutableAgg
  def: MutableAgg
  byOwner: Record<string, { all: MutableAgg; diesel: MutableAgg; def: MutableAgg }>
} {
  const all = emptyMutable()
  const diesel = emptyMutable()
  const def = emptyMutable()
  const byOwner: Record<
    string,
    { all: MutableAgg; diesel: MutableAgg; def: MutableAgg }
  > = {}
  for (const row of rows) {
    addToAgg(all, row)
    if (isDieselProduct(row.product)) addToAgg(diesel, row)
    if (isDefProduct(row.product)) addToAgg(def, row)
    const owner = row.owner || "(sin owner)"
    if (!byOwner[owner]) {
      byOwner[owner] = {
        all: emptyMutable(),
        diesel: emptyMutable(),
        def: emptyMutable(),
      }
    }
    addToAgg(byOwner[owner].all, row)
    if (isDieselProduct(row.product)) addToAgg(byOwner[owner].diesel, row)
    if (isDefProduct(row.product)) addToAgg(byOwner[owner].def, row)
  }
  return { all, diesel, def, byOwner }
}

function freezeMonth(month: string, buckets: ReturnType<typeof accumulateMonth>): FuelMonthSeries {
  const byOwner: FuelMonthSeries["byOwner"] = {}
  for (const [owner, value] of Object.entries(buckets.byOwner)) {
    byOwner[owner] = {
      all: freezeAgg(value.all),
      diesel: freezeAgg(value.diesel),
      def: freezeAgg(value.def),
    }
  }
  return {
    month,
    all: freezeAgg(buckets.all),
    diesel: freezeAgg(buckets.diesel),
    def: freezeAgg(buckets.def),
    byOwner,
  }
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
      detail_month: "",
      detail_row_count: 0,
      detail_truncated: false,
      error,
    },
    monthly: [],
    owners: [],
    products: [],
    rows: [],
  }
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

export function pickProductAgg(
  series: FuelMonthSeries,
  product: string,
  owner: string
): FuelAgg {
  const source =
    owner === "all"
      ? series
      : series.byOwner[owner] ?? {
          all: { gallons: 0, spend: 0, transactions: 0, trucks: 0 },
          diesel: { gallons: 0, spend: 0, transactions: 0, trucks: 0 },
          def: { gallons: 0, spend: 0, transactions: 0, trucks: 0 },
        }
  if (product === "def" || isDefProduct(product)) return source.def
  if (product === "all") return source.all
  // Default and exact diesel product names use the diesel bucket.
  return source.diesel
}

function credentials() {
  const key = process.env.AGENT_REPORTING_KEY
  if (!key) return null
  return {
    key,
    endpoint: process.env.AGENT_REPORTING_ENDPOINT || DEFAULT_ENDPOINT,
  }
}

export async function getFuelMonthRows(ym: string): Promise<{
  rows: FuelRow[]
  totalCount: number
  truncated: boolean
  asOf: string
  freshness: string
  complete: boolean
  error?: string
}> {
  const auth = credentials()
  if (!auth) {
    return {
      rows: [],
      totalCount: 0,
      truncated: false,
      asOf: new Date().toISOString(),
      freshness: "unavailable",
      complete: false,
      error: "AGENT_REPORTING_KEY is not configured",
    }
  }
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { storeFrom, storeTo } = monthBounds(ym, today)
    const result = await fetchAllFuel(auth.endpoint, auth.key, {
      report: "fuel",
      store_from: storeFrom,
      store_to: storeTo,
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
    const truncated = rows.length > DIESEL_DETAIL_ROW_CAP
    return {
      rows: truncated ? rows.slice(0, DIESEL_DETAIL_ROW_CAP) : rows,
      totalCount: rows.length,
      truncated,
      asOf: result.asOf || new Date().toISOString(),
      freshness:
        result.freshness ||
        "unknown: source tables do not expose a sync timestamp",
      complete: result.complete,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fuel error"
    return {
      rows: [],
      totalCount: 0,
      truncated: false,
      asOf: new Date().toISOString(),
      freshness: "unavailable",
      complete: false,
      error: message.slice(0, 240),
    }
  }
}

export async function getFuel(detailMonth?: string): Promise<FuelPayload> {
  const auth = credentials()
  if (!auth) {
    return emptyFuelPayload("AGENT_REPORTING_KEY is not configured")
  }
  try {
    const today = new Date().toISOString().slice(0, 10)
    const storeFrom = dieselHistoryStart(today)
    const months = listMonthKeys(storeFrom, today)
    const focus =
      detailMonth && months.includes(detailMonth)
        ? detailMonth
        : months.includes(today.slice(0, 7))
          ? today.slice(0, 7)
          : (months[months.length - 1] ?? today.slice(0, 7))

    const monthResults = []
    for (let i = 0; i < months.length; i += 4) {
      const batch = months.slice(i, i + 4)
      const part = await Promise.all(
        batch.map(async (ym) => {
          const { storeFrom: from, storeTo: to } = monthBounds(ym, today)
          const result = await fetchAllFuel(auth.endpoint, auth.key, {
            report: "fuel",
            store_from: from,
            store_to: to,
          })
          const mapped = result.rows
            .map(mapFuel)
            .filter((row): row is FuelRow => row !== null)
          return {
            ym,
            mapped,
            totalCount: result.totalCount || mapped.length,
            asOf: result.asOf,
            freshness: result.freshness,
            complete:
              result.complete && mapped.length === (result.totalCount || mapped.length),
          }
        })
      )
      monthResults.push(...part)
    }

    const monthly = monthResults.map((item) =>
      freezeMonth(item.ym, accumulateMonth(item.mapped))
    )
    const owners = [
      ...new Set(
        monthly.flatMap((item) => Object.keys(item.byOwner)).filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b))
    const products = [
      ...new Set(
        monthResults.flatMap((item) => item.mapped.map((row) => row.product)).filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b))

    const focusPack = monthResults.find((item) => item.ym === focus)
    const focusRows = [...(focusPack?.mapped ?? [])].sort(
      (a, b) =>
        b.storeDate.localeCompare(a.storeDate) ||
        a.unit.localeCompare(b.unit) ||
        a.id - b.id
    )
    const detailTruncated = focusRows.length > DIESEL_DETAIL_ROW_CAP
    const rows = detailTruncated
      ? focusRows.slice(0, DIESEL_DETAIL_ROW_CAP)
      : focusRows

    const fetchedCount = monthResults.reduce((sum, item) => sum + item.mapped.length, 0)
    const totalCount = monthResults.reduce((sum, item) => sum + item.totalCount, 0)
    const complete = monthResults.every((item) => item.complete)
    const asOf =
      monthResults.map((item) => item.asOf).find(Boolean) || new Date().toISOString()
    const freshness =
      monthResults.map((item) => item.freshness).find(Boolean) ||
      "unknown: source tables do not expose a sync timestamp"
    const distinctTrucks = new Set(
      monthResults.flatMap((item) => item.mapped.map((row) => row.unit).filter(Boolean))
    ).size

    return {
      meta: {
        as_of: asOf,
        source_freshness: freshness,
        total_count: totalCount || fetchedCount,
        fetched_count: fetchedCount,
        pagination_complete: complete,
        live: true,
        dataset: "fuel",
        filters: {
          report: "fuel",
          store_from: storeFrom,
          store_to: today,
          history_months: DIESEL_HISTORY_MONTHS,
          detail_month: focus,
          detail_row_cap: DIESEL_DETAIL_ROW_CAP,
          note: "Live fuel; monthly aggregates for chart; detail rows capped per focus month",
        },
        distinct_trucks: distinctTrucks,
        months,
        detail_month: focus,
        detail_row_count: focusRows.length,
        detail_truncated: detailTruncated,
      },
      monthly,
      owners,
      products,
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
