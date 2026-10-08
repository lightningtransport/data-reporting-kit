/** Current operational membership; DriverPay is historical assignment evidence only. */
import { fetchBoundedJson } from "./bounded-json.ts"

export const ON_ROAD_SOURCE_URL = "https://lightningtransport.ninoxdb.com/share/eno5u22ebn2qdn215dpzwn02squ5wsixob8f?locale=en&utcoffset=-240"

export type TrucksCurrentlyOutPayload = {
  count: number | null
  meta: {
    as_of: string
    fetch_started_at?: string
    source_freshness: string
    total_count: number | null
    fetched_count: number | null
    pagination_complete: boolean
    live: boolean
    dataset: string
    filters: Record<string, string | number | boolean>
    duplicate_truck_rows?: number
    conflicting_trucks?: number
    error?: string
  }
}

/** Historical predicate only; never a current operational-state loader. */
export function isOnRoadAssignment(row: Record<string, unknown>, date: string): boolean {
  const outRaw = row["Out Date"]
  const returnRaw = row["Return Date"]
  const outDate = outRaw == null || outRaw === "" ? "" : String(outRaw).slice(0, 10)
  const returnDate = returnRaw == null || returnRaw === "" ? "" : String(returnRaw).slice(0, 10)
  return Boolean(outDate && returnDate && outDate <= date && returnDate > date)
}

const KEYS = ["truck_number", "dispatcher", "insurance", "owner", "Samsara_Truck_ID", "Status", "Ninox_ID"]
function positiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

export function validateOnRoadRows(payload: unknown): Record<string, unknown>[] {
  if (!Array.isArray(payload)) throw new Error("Invalid on-road array")
  for (const row of payload) {
    if (!row || typeof row !== "object" || Array.isArray(row) ||
        Object.keys(row).length !== KEYS.length || KEYS.some(key => !Object.hasOwn(row, key)) ||
        !positiveId(row.truck_number) || !positiveId(row.Ninox_ID) ||
        ["dispatcher", "insurance", "owner", "Samsara_Truck_ID"].some(key => typeof row[key] !== "string") ||
        row.Status !== "On The Road Working") throw new Error("Invalid on-road row schema")
  }
  return payload
}

export async function getTrucksCurrentlyOut(): Promise<TrucksCurrentlyOutPayload> {
  const deadline = performance.now() + 30000
  const started = new Date().toISOString()
  const filters = { source_url: ON_ROAD_SOURCE_URL, Status: "On The Road Working", grain: "distinct truck_number", scope: "current snapshot, not historical assignment overlap" }
  try {
    const payload = await fetchBoundedJson(ON_ROAD_SOURCE_URL, { headers: { Accept: "application/json" } }, { maxBytes: 2 * 1024 * 1024, timeoutMs: 30000, strictJson: true })
    const rows = validateOnRoadRows(payload)
    const trucks = new Map<number, string>()
    const conflicts = new Set<number>()
    for (const row of rows) {
      const truck = row.truck_number as number
      const attributes = JSON.stringify([row.owner, row.dispatcher, row.insurance, row.Samsara_Truck_ID, row.Status])
      if (trucks.has(truck) && trucks.get(truck) !== attributes) conflicts.add(truck)
      trucks.set(truck, attributes)
    }
    if (performance.now() >= deadline) throw new Error("On-road source timeout")
    return {
      count: trucks.size,
      meta: {
        as_of: new Date().toISOString(), fetch_started_at: started,
        source_freshness: "Fresh retrieval; upstream synchronization timestamp unavailable. Membership is working, not proof of GPS movement.",
        total_count: rows.length, fetched_count: rows.length, pagination_complete: true, live: true,
        dataset: "live_ninox_on_road", filters, duplicate_truck_rows: rows.length - trucks.size,
        conflicting_trucks: conflicts.size,
      },
    }
  } catch {
    return {
      count: null,
      meta: {
        as_of: new Date().toISOString(), fetch_started_at: started,
        source_freshness: "Unavailable: fresh complete live on-road source required; no cached or DriverPay fallback.",
        total_count: null, fetched_count: null, pagination_complete: false, live: false,
        dataset: "live_ninox_on_road", filters, error: "Live on-road source unavailable or invalid",
      },
    }
  }
}
