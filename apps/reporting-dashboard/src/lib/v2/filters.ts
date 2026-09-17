import type { ExecutiveGrain, ExecutiveLens } from "@/lib/v2/metrics"
import {
  monthsFromWeeks,
  weeksFromRows,
  type SettlementRow,
} from "@/lib/settlement"

export type V2SearchParams = {
  grain?: string
  period?: string
  team?: string
  lens?: string
  focus?: string
  truck?: string
}

export type V2Filters = {
  grain: ExecutiveGrain
  period: string
  teams: string[] // empty = all
  lens: ExecutiveLens
  focusTeam: string | null
  focusTruck: string | null
}

function parseGrain(raw: string | undefined): ExecutiveGrain {
  return raw === "month" ? "month" : "week"
}

function parseLens(raw: string | undefined): ExecutiveLens {
  return raw === "accounting" ? "accounting" : "operating"
}

export function resolveV2Filters(
  params: V2SearchParams,
  rows: SettlementRow[],
  today = new Date().toISOString().slice(0, 10)
): V2Filters {
  const grain = parseGrain(params.grain)
  const weeks = weeksFromRows(rows)
  const months = monthsFromWeeks(weeks)
  const lens = parseLens(params.lens)

  let period = typeof params.period === "string" ? params.period : ""
  if (grain === "week") {
    if (!weeks.includes(period)) {
      period = weeks.includes(today)
        ? today
        : (weeks[weeks.length - 1] ?? "")
      // Prefer latest week that has started on/before today.
      for (let i = weeks.length - 1; i >= 0; i -= 1) {
        if (weeks[i]! <= today) {
          period = weeks[i]!
          break
        }
      }
    }
  } else {
    const ym = today.slice(0, 7)
    if (!months.includes(period)) {
      period = months.includes(ym) ? ym : (months[months.length - 1] ?? "")
      for (let i = months.length - 1; i >= 0; i -= 1) {
        if (months[i]! <= ym) {
          period = months[i]!
          break
        }
      }
    }
  }

  const teams =
    typeof params.team === "string" && params.team.trim() && params.team !== "all"
      ? params.team.split("|").map((t) => t.trim()).filter(Boolean)
      : []

  const focusTeam =
    typeof params.focus === "string" && params.focus.trim()
      ? params.focus.trim()
      : null
  const focusTruck =
    typeof params.truck === "string" && params.truck.trim()
      ? params.truck.trim()
      : null

  return { grain, period, teams, lens, focusTeam, focusTruck }
}

export function v2Href(filters: Partial<V2Filters> & { grain: ExecutiveGrain; period: string; lens: ExecutiveLens }): string {
  const sp = new URLSearchParams()
  sp.set("grain", filters.grain)
  sp.set("period", filters.period)
  sp.set("lens", filters.lens)
  if (filters.teams && filters.teams.length > 0) {
    sp.set("team", filters.teams.join("|"))
  }
  if (filters.focusTeam) sp.set("focus", filters.focusTeam)
  if (filters.focusTruck) sp.set("truck", filters.focusTruck)
  return `/v2?${sp.toString()}`
}

/**
 * A calendar month is partial when today falls inside it and we are still
 * mid-month (not all Tue–Mon weeks that can close in the month are known done).
 * Conservative rule: current calendar month is always marked partial.
 */
export function isPeriodPartial(
  grain: ExecutiveGrain,
  period: string,
  today = new Date().toISOString().slice(0, 10)
): boolean {
  if (!period) return true
  if (grain === "month") {
    return period === today.slice(0, 7)
  }
  // Settlement week Tue–Mon: partial when today is on or before period week end
  // (period + 6 days) and on/after period start.
  const end = new Date(`${period}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const endIso = end.toISOString().slice(0, 10)
  return today >= period && today <= endIso
}
