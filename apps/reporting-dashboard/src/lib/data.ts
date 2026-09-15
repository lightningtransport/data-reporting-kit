import embedded from "@/data/settlement-summary.json"
import type { SettlementPayload, SettlementRow } from "@/lib/settlement"

const DEFAULT_ENDPOINT =
  "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting"

export function getEmbeddedSettlementSummary(): SettlementPayload {
  return embedded as SettlementPayload
}

function tuesdayOnOrBefore(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  const day = date.getUTCDay()
  const delta = (day + 5) % 7
  date.setUTCDate(date.getUTCDate() - delta)
  return date.toISOString().slice(0, 10)
}

function addMonths(isoDate: string, months: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 10)
}

type LiveRow = {
  settlement_id?: number
  truck?: string
  owner?: string
  period_from?: string
  period_to?: string
  gross?: number
  total_expenses?: number
  net?: number
  fuel_expenses?: number
  driven_miles?: number
  total_driver_pay?: number
}

function mapLiveRow(row: LiveRow): SettlementRow | null {
  if (!row.period_from || row.truck == null) return null
  return {
    sid: Number(row.settlement_id ?? 0),
    t: String(row.truck),
    o: String(row.owner ?? ""),
    pf: row.period_from,
    pt: String(row.period_to ?? ""),
    g: Number(row.gross ?? 0),
    e: Number(row.total_expenses ?? 0),
    n: Number(row.net ?? 0),
    f: Number(row.fuel_expenses ?? 0),
    m: Number(row.driven_miles ?? 0),
    dp: Number(row.total_driver_pay ?? 0),
  }
}

async function fetchWindow(
  endpoint: string,
  key: string,
  periodFrom: string,
  periodTo: string
): Promise<{ rows: SettlementRow[]; totalCount: number; asOf: string; freshness: string }> {
  const url = new URL(endpoint)
  url.searchParams.set("report", "settlement_summary")
  url.searchParams.set("period_from", periodFrom)
  url.searchParams.set("period_to", periodTo)
  url.searchParams.set("limit", "1000")
  const response = await fetch(url, {
    headers: { "x-agent-key": key, Accept: "application/json" },
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`agent-reporting HTTP ${response.status}`)
  }
  const payload = (await response.json()) as {
    data?: LiveRow[]
    total_count?: number
    as_of?: string
    source_freshness?: string
  }
  const rows = (payload.data ?? [])
    .map(mapLiveRow)
    .filter((row): row is SettlementRow => row !== null)
  return {
    rows,
    totalCount: Number(payload.total_count ?? rows.length),
    asOf: String(payload.as_of ?? ""),
    freshness: String(payload.source_freshness ?? ""),
  }
}

export async function fetchLiveSettlementSummary(): Promise<SettlementPayload> {
  const key = process.env.AGENT_REPORTING_KEY
  if (!key) {
    throw new Error("AGENT_REPORTING_KEY is not configured")
  }
  const endpoint = process.env.AGENT_REPORTING_ENDPOINT || DEFAULT_ENDPOINT
  const today = new Date().toISOString().slice(0, 10)
  const historyStart = tuesdayOnOrBefore(addMonths(today, -3))
  const windows: Array<[string, string]> = []
  let cursor = historyStart
  while (cursor <= today) {
    const next = addMonths(cursor, 1)
    windows.push([cursor, next < today ? next : today])
    cursor = next
  }

  const byId = new Map<number, SettlementRow>()
  let asOf = ""
  let freshness = ""
  for (const [periodFrom, periodTo] of windows) {
    const page = await fetchWindow(endpoint, key, periodFrom, periodTo)
    asOf = page.asOf || asOf
    freshness = page.freshness || freshness
    for (const row of page.rows) {
      byId.set(row.sid || byId.size + 1, row)
    }
  }
  const rows = [...byId.values()].sort((a, b) => a.pf.localeCompare(b.pf) || a.sid - b.sid)
  return {
    meta: {
      as_of: asOf,
      source_freshness: freshness || "live-api-windowed-fetch",
      total_count: rows.length,
      fetched_count: rows.length,
      filters: {
        period_from: historyStart,
        period_to: today,
        dataset: "settlement_summary",
        note: "Fetched via monthly period windows and deduped by settlement_id",
      },
      pagination_complete: true,
      period_from_values: [...new Set(rows.map((row) => row.pf))].sort(),
    },
    rows,
  }
}

export async function getSettlementSummary(): Promise<SettlementPayload> {
  if (!process.env.AGENT_REPORTING_KEY) {
    return getEmbeddedSettlementSummary()
  }
  try {
    return await fetchLiveSettlementSummary()
  } catch {
    return getEmbeddedSettlementSummary()
  }
}
