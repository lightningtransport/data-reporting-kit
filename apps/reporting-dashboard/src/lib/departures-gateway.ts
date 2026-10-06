import { unavailableDepartureWeek, type DepartureReport } from "./departures.ts"
export { unavailableDepartureWeek } from "./departures.ts"
import { fetchBoundedJson } from "./bounded-json.ts"

export function parseDepartureRange(params: URLSearchParams): { outFrom: string; outTo: string } | null {
  for (const name of params.keys()) {
    if (!["out_from", "out_to"].includes(name) || params.getAll(name).length !== 1) return null
  }
  const outFrom = params.get("out_from") ?? ""
  const outTo = params.get("out_to") ?? ""
  for (const value of [outFrom, outTo]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const date = new Date(`${value}T00:00:00Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null
  }
  const days = (Date.parse(outTo) - Date.parse(outFrom)) / 86400000 + 1
  return days >= 1 && days <= 31 ? { outFrom, outTo } : null
}

export async function fetchDepartureWeek(
  outFrom: string,
  outTo: string,
  options: { endpoint: string; key: string; fetcher?: typeof fetch }
): Promise<DepartureReport> {
  try {
    const url = new URL(options.endpoint)
    url.search = new URLSearchParams({ report: "departures", out_from: outFrom, out_to: outTo }).toString()
    const payload = await fetchBoundedJson(url, {
      headers: { "x-agent-key": options.key, Accept: "application/json" },
    }, { fetcher: options.fetcher, allowedStatuses: [503] }) as DepartureReport
    const fallback = unavailableDepartureWeek(outFrom, outTo)
    if (payload.period?.out_from !== outFrom || payload.period?.out_to !== outTo || payload.period?.time_zone !== "America/New_York") return fallback
    const sets = payload.truck_sets
    const counts = payload.reconciliation
    if (!sets || !counts) return fallback
    const keys = ["driver_pay", "schedule_teams", "driver_pay_only", "schedule_teams_only", "overlap", "combined"] as const
    const countKeys = ["driver_pay_count", "schedule_teams_count", "driver_pay_only_count", "schedule_teams_only_count", "overlap_count", "combined_distinct_total"] as const
    for (let i = 0; i < keys.length; i++) {
      const set = sets[keys[i]]
      const count = counts[countKeys[i]]
      if (set === null && count === null) continue
      if (!Array.isArray(set) || set.some((id) => typeof id !== "string" || !id.trim() || id.length > 100) || new Set(set).size !== set.length || count !== set.length) return fallback
    }
    const complete = payload.complete === true && payload.status === "complete" && keys.every((key) => sets[key] !== null)
    if (complete) {
      const d = new Set(sets.driver_pay!)
      const s = new Set(sets.schedule_teams!)
      const expected = [
        [...d], [...s], [...d].filter((id) => !s.has(id)), [...s].filter((id) => !d.has(id)),
        [...d].filter((id) => s.has(id)), [...new Set([...d, ...s])],
      ]
      if (keys.some((key, i) => JSON.stringify([...sets[key]!].sort()) !== JSON.stringify(expected[i].sort()))) return fallback
    }
    // Explicit projection: never pass arbitrary gateway errors, fields or rows to the browser.
    return {
      ...fallback, status: complete ? "complete" : "incomplete", complete,
      reconciliation: {
        driver_pay_count: counts.driver_pay_count, schedule_teams_count: counts.schedule_teams_count,
        driver_pay_only_count: complete ? counts.driver_pay_only_count : null,
        schedule_teams_only_count: complete ? counts.schedule_teams_only_count : null,
        overlap_count: complete ? counts.overlap_count : null,
        combined_distinct_total: complete ? counts.combined_distinct_total : null,
      },
      truck_sets: {
        driver_pay: sets.driver_pay, schedule_teams: sets.schedule_teams,
        driver_pay_only: complete ? sets.driver_pay_only : null,
        schedule_teams_only: complete ? sets.schedule_teams_only : null,
        overlap: complete ? sets.overlap : null, combined: complete ? sets.combined : null,
      },
      as_of: typeof payload.as_of === "string" && !payload.as_of.includes(options.key) ? payload.as_of.slice(0, 100) : undefined,
      source_freshness: typeof payload.source_freshness === "string" && !payload.source_freshness.includes(options.key) ? payload.source_freshness.slice(0, 500) : undefined,
      source_status: {
        driver_pay: { status: sets.driver_pay !== null ? "complete" : "failed" },
        schedule_teams: { status: sets.schedule_teams !== null ? "complete" : "failed" },
      },
      error: complete ? undefined : fallback.error,
    }
  } catch {
    return unavailableDepartureWeek(outFrom, outTo)
  }
}
