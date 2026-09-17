/**
 * V2 Fuel performance — reuses governed Diesel aggregates (Adjusted SubTotal / Gallons).
 * Dispatch is never applied until a governed mapping exists.
 */

import {
  pickProductAgg,
  type FuelTrendPayload,
} from "@/lib/fuel"
import { previousCalendarMonth } from "@/lib/v2/metrics"

export type V2FuelMonthSnapshot = {
  status: "ok" | "empty" | "unavailable" | "partial"
  ym: string
  label: string
  spend: number | null
  gallons: number | null
  avgPerGallon: number | null
  transactions: number | null
  trucks: number | null
  ownerApplied: string | null
  dispatchApplied: false
  scopeNote: string
  reason?: string
  prior: {
    ym: string
    spend: number | null
    gallons: number | null
    avgPerGallon: number | null
    spendDelta: number | null
    avgDelta: number | null
  } | null
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  if (!y || !m) return ym
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/**
 * Map V2 period to Diesel calendar month (Store Date).
 * Week grain uses the calendar month of the Tuesday period_from.
 */
export function fuelCalendarMonth(
  grain: "week" | "month",
  period: string
): string {
  if (!period) return ""
  return grain === "month" ? period : period.slice(0, 7)
}

export function buildV2FuelSnapshot(input: {
  trend: FuelTrendPayload | null
  grain: "week" | "month"
  period: string
  owners: string[]
}): V2FuelMonthSnapshot {
  const ym = fuelCalendarMonth(input.grain, input.period)
  const owner =
    input.owners.length === 1 ? input.owners[0]! : null
  const scopeNote = owner
    ? `Owner ${owner} · Dispatch filter not applied to fuel data`
    : "All owners · Dispatch filter not applied to fuel data"

  if (!ym) {
    return {
      status: "unavailable",
      ym: "",
      label: "—",
      spend: null,
      gallons: null,
      avgPerGallon: null,
      transactions: null,
      trucks: null,
      ownerApplied: owner,
      dispatchApplied: false,
      scopeNote,
      reason: "No period selected for fuel calendar month",
      prior: null,
    }
  }

  if (!input.trend) {
    return {
      status: "unavailable",
      ym,
      label: monthLabel(ym),
      spend: null,
      gallons: null,
      avgPerGallon: null,
      transactions: null,
      trucks: null,
      ownerApplied: owner,
      dispatchApplied: false,
      scopeNote,
      reason: "Fuel trend unavailable",
      prior: null,
    }
  }

  if (input.trend.meta.error) {
    return {
      status: "unavailable",
      ym,
      label: monthLabel(ym),
      spend: null,
      gallons: null,
      avgPerGallon: null,
      transactions: null,
      trucks: null,
      ownerApplied: owner,
      dispatchApplied: false,
      scopeNote,
      reason: input.trend.meta.error,
      prior: null,
    }
  }

  if (!input.trend.meta.pagination_complete) {
    return {
      status: "partial",
      ym,
      label: monthLabel(ym),
      spend: null,
      gallons: null,
      avgPerGallon: null,
      transactions: null,
      trucks: null,
      ownerApplied: owner,
      dispatchApplied: false,
      scopeNote,
      reason: "Fuel pagination incomplete; totals not shown as zero",
      prior: null,
    }
  }

  const series = input.trend.monthly.find((m) => m.month === ym)
  if (!series) {
    return {
      status: "empty",
      ym,
      label: monthLabel(ym),
      spend: null,
      gallons: null,
      avgPerGallon: null,
      transactions: null,
      trucks: null,
      ownerApplied: owner,
      dispatchApplied: false,
      scopeNote,
      reason: "No fuel transactions found for this calendar month",
      prior: null,
    }
  }

  const agg = pickProductAgg(series, "diesel", owner ?? "all")
  if (agg.transactions === 0) {
    return {
      status: "empty",
      ym,
      label: monthLabel(ym),
      spend: null,
      gallons: null,
      avgPerGallon: null,
      transactions: null,
      trucks: null,
      ownerApplied: owner,
      dispatchApplied: false,
      scopeNote,
      reason: "No diesel (ex-DEF) transactions for this selection",
      prior: null,
    }
  }

  const avgPerGallon =
    agg.gallons > 0 && agg.spend > 0 ? agg.spend / agg.gallons : null

  const priorYm = previousCalendarMonth(ym)
  const priorSeries = input.trend.monthly.find((m) => m.month === priorYm)
  let prior: V2FuelMonthSnapshot["prior"] = null
  if (priorSeries) {
    const priorAgg = pickProductAgg(priorSeries, "diesel", owner ?? "all")
    if (priorAgg.transactions > 0) {
      const priorAvg =
        priorAgg.gallons > 0 && priorAgg.spend > 0
          ? priorAgg.spend / priorAgg.gallons
          : null
      prior = {
        ym: priorYm,
        spend: priorAgg.spend,
        gallons: priorAgg.gallons,
        avgPerGallon: priorAvg,
        spendDelta: agg.spend - priorAgg.spend,
        avgDelta:
          avgPerGallon != null && priorAvg != null
            ? avgPerGallon - priorAvg
            : null,
      }
    }
  }

  return {
    status: "ok",
    ym,
    label: monthLabel(ym),
    spend: agg.spend,
    gallons: agg.gallons,
    avgPerGallon,
    transactions: agg.transactions,
    trucks: agg.trucks,
    ownerApplied: owner,
    dispatchApplied: false,
    scopeNote,
    prior,
  }
}
