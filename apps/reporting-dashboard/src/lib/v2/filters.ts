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
  dispatch?: string
  lens?: string
  focus?: string
  focusdispatch?: string
  truck?: string
  teamscope?: string
  truckfilter?: string
  trend?: string
  priorities?: string
}

export type TeamTableScope = "attention" | "all"
export type TruckDrawerFilter = "negative_net" | "low_gross" | "all"
export type TrendSpan = 6 | 12

export type V2Filters = {
  grain: ExecutiveGrain
  period: string
  teams: string[] // empty = all owners
  dispatches: string[] // empty = all dispatches
  lens: ExecutiveLens
  focusTeam: string | null
  focusDispatch: string | null
  focusTruck: string | null
  teamScope: TeamTableScope
  truckFilter: TruckDrawerFilter
  trendSpan: TrendSpan
  prioritiesOpen: boolean
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

  const dispatches =
    typeof params.dispatch === "string" &&
    params.dispatch.trim() &&
    params.dispatch !== "all"
      ? params.dispatch.split("|").map((t) => t.trim()).filter(Boolean)
      : []

  const focusTeam =
    typeof params.focus === "string" && params.focus.trim()
      ? params.focus.trim()
      : null
  const focusDispatch =
    typeof params.focusdispatch === "string" && params.focusdispatch.trim()
      ? params.focusdispatch.trim()
      : null
  const focusTruck =
    typeof params.truck === "string" && params.truck.trim()
      ? params.truck.trim()
      : null

  const teamScope: TeamTableScope =
    params.teamscope === "all" ? "all" : "attention"

  const truckFilter: TruckDrawerFilter =
    params.truckfilter === "low_gross"
      ? "low_gross"
      : params.truckfilter === "all"
        ? "all"
        : "negative_net"

  const trendSpan: TrendSpan = params.trend === "6" ? 6 : 12

  return {
    grain,
    period,
    teams,
    dispatches,
    lens,
    focusTeam,
    focusDispatch,
    focusTruck,
    teamScope,
    truckFilter,
    trendSpan,
    prioritiesOpen: params.priorities === "1",
  }
}

export function v2Href(
  filters: Partial<V2Filters> & {
    grain: ExecutiveGrain
    period: string
    lens: ExecutiveLens
  }
): string {
  const sp = new URLSearchParams()
  sp.set("grain", filters.grain)
  sp.set("period", filters.period)
  sp.set("lens", filters.lens)
  if (filters.teams && filters.teams.length > 0) {
    sp.set("team", filters.teams.join("|"))
  }
  if (filters.dispatches && filters.dispatches.length > 0) {
    sp.set("dispatch", filters.dispatches.join("|"))
  }
  if (filters.focusTeam) sp.set("focus", filters.focusTeam)
  if (filters.focusDispatch) sp.set("focusdispatch", filters.focusDispatch)
  if (filters.focusTruck) sp.set("truck", filters.focusTruck)
  if (filters.teamScope === "all") sp.set("teamscope", "all")
  if (filters.truckFilter && filters.truckFilter !== "negative_net") {
    sp.set("truckfilter", filters.truckFilter)
  }
  if (filters.trendSpan === 6) sp.set("trend", "6")
  if (filters.prioritiesOpen) sp.set("priorities", "1")
  return `/v2?${sp.toString()}`
}

/**
 * A calendar month is partial when today falls inside it.
 * Settlement week Tue–Mon: partial when today is within the week.
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
  const end = new Date(`${period}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const endIso = end.toISOString().slice(0, 10)
  return today >= period && today <= endIso
}

/** Human-readable period for executive chrome (not the URL canonical). */
export function formatPeriodLabel(
  grain: ExecutiveGrain,
  period: string
): string {
  if (!period) return "—"
  if (grain === "month") {
    const [y, m] = period.split("-").map(Number)
    if (!y || !m) return period
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
  }
  return `Week of ${period}`
}
