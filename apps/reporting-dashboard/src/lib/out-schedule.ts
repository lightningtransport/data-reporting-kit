import { weekdayFromIso } from "@/lib/ops-table"

export const SCHEDULE_TEAMS_URL =
  "https://lightningtransport.ninoxdb.com/share/p10ce94o8paa2q4a1z4nw0emznn2ubhriza6?locale=en&utcoffset=-240"

export type OutScheduleRow = {
  id: string
  truck: string
  day: string
  outDate: string
  team: string
  owner: string
  dispatch: string
  flatbed: string
  solo: string
}

export type OutSchedulePayload = {
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
  rows: OutScheduleRow[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[_]+$/g, "")
    .replace(/[\s_-]+/g, "")
}

function pickField(row: Record<string, unknown>, candidates: string[]): string {
  const wanted = new Set(candidates.map(normalizeKey))
  for (const [key, value] of Object.entries(row)) {
    if (!wanted.has(normalizeKey(key))) continue
    if (value == null) return ""
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value).trim()
    }
  }
  return ""
}

function toIsoDate(raw: string): string {
  const value = raw.trim()
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) {
    const month = us[1].padStart(2, "0")
    const day = us[2].padStart(2, "0")
    return `${us[3]}-${month}-${day}`
  }
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return value
}

function flattenRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.map(asRecord).filter((row): row is Record<string, unknown> => row !== null)
  }
  const root = asRecord(payload)
  if (!root) return []
  for (const key of ["data", "records", "items", "rows", "Schedule_Teams"]) {
    const nested = root[key]
    if (Array.isArray(nested)) {
      return nested.map(asRecord).filter((row): row is Record<string, unknown> => row !== null)
    }
  }
  return []
}

export function normalizeOutScheduleRow(
  row: Record<string, unknown>,
  index: number
): OutScheduleRow | null {
  const truck = pickField(row, ["Truck", "truck_", "truck", "Truck_Number", "unit_number"])
  const outDateRaw = pickField(row, ["Out Date", "OutDate", "out_date", "outdate"])
  const outDate = toIsoDate(outDateRaw)
  if (!truck && !outDate) return null

  const team =
    pickField(row, ["Team", "team"]) ||
    pickField(row, ["Driver 1", "Driver1", "Drivers", "Driver"])
  const id =
    pickField(row, ["id", "ID", "Ninox_ID", "ninox_id"]) ||
    `${truck || "row"}-${outDate || index}`

  return {
    id,
    truck,
    day: pickField(row, ["Day", "day"]) || (outDate ? weekdayFromIso(outDate) : ""),
    outDate,
    team,
    owner: pickField(row, ["Owner", "owner"]),
    dispatch: pickField(row, ["Dispatch", "dispatch", "Dispatch_Name_"]),
    flatbed: pickField(row, ["Flatbed", "flatbed"]),
    solo: pickField(row, ["solo", "Solo", "Solo_Driver_if_1"]),
  }
}

export function emptyOutSchedulePayload(error?: string): OutSchedulePayload {
  return {
    meta: {
      as_of: new Date().toISOString(),
      source_freshness: error
        ? "unavailable: Schedule_Teams share fetch failed"
        : "empty",
      total_count: 0,
      fetched_count: 0,
      pagination_complete: false,
      live: false,
      dataset: "Schedule_Teams",
      filters: {
        source: "ninox-schedule-teams-share",
        url: SCHEDULE_TEAMS_URL,
        note: "live query only; no embedded snapshot",
      },
      error,
    },
    rows: [],
  }
}

export async function getOutSchedule(): Promise<OutSchedulePayload> {
  try {
    const response = await fetch(SCHEDULE_TEAMS_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!response.ok) {
      return emptyOutSchedulePayload(`Schedule_Teams HTTP ${response.status}`)
    }
    const payload = (await response.json()) as unknown
    if (!Array.isArray(payload) && flattenRows(payload).length === 0) {
      return emptyOutSchedulePayload("Schedule_Teams response was not a usable JSON array")
    }
    const rows = flattenRows(payload)
      .map((row, index) => normalizeOutScheduleRow(row, index))
      .filter((row): row is OutScheduleRow => row !== null)
      .sort((a, b) => a.outDate.localeCompare(b.outDate) || a.truck.localeCompare(b.truck))

    return {
      meta: {
        as_of: new Date().toISOString(),
        source_freshness:
          "live Ninox Schedule_Teams share; volatile planned departures, not DriverPay history",
        total_count: rows.length,
        fetched_count: rows.length,
        pagination_complete: true,
        live: true,
        dataset: "Schedule_Teams",
        filters: {
          source: "ninox-schedule-teams-share",
          url: SCHEDULE_TEAMS_URL,
          sort: "Out Date asc, Truck asc",
          fields:
            "Truck, Out Date, Team, Owner, Dispatch, Flatbed, solo (+ Day derived)",
          note: "live query only; no embedded snapshot",
        },
      },
      rows,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Schedule_Teams error"
    console.error("[reporting-dashboard] Schedule_Teams unavailable", {
      message: message.slice(0, 240),
    })
    return emptyOutSchedulePayload(message.slice(0, 240))
  }
}
