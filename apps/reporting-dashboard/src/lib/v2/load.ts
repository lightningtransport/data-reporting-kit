import { getSettlementSummary } from "@/lib/data"
import { getFuelTrend, type FuelTrendPayload } from "@/lib/fuel"
import { getReturns, type ReturnsPayload } from "@/lib/returns"
import type { SettlementPayload } from "@/lib/settlement"

export type SourceLoadStatus = "ok" | "error" | "empty"

export type V2SourceMeta = {
  name: string
  status: SourceLoadStatus
  rowCount: number
  paginationComplete: boolean
  asOf: string
  freshness: string
  error?: string
}

export type V2DashboardData = {
  settlements: SettlementPayload
  returns: ReturnsPayload | null
  fuelTrend: FuelTrendPayload | null
  sources: {
    settlements: V2SourceMeta
    returns: V2SourceMeta
    fuel: V2SourceMeta
  }
}

function freshnessLabel(raw: string | undefined): string {
  if (!raw || raw.trim() === "" || raw === "empty") return "Freshness unknown"
  if (raw.startsWith("unavailable")) return "Freshness unknown"
  return raw
}

export async function loadV2DashboardData(): Promise<V2DashboardData> {
  const [settlementsResult, returnsResult, fuelResult] = await Promise.allSettled([
    getSettlementSummary(),
    getReturns(),
    getFuelTrend(),
  ])

  const settlements: SettlementPayload =
    settlementsResult.status === "fulfilled"
      ? settlementsResult.value
      : {
          meta: {
            as_of: new Date().toISOString(),
            source_freshness:
              "unavailable: live agent-reporting settlements required",
            total_count: 0,
            fetched_count: 0,
            filters: {},
            pagination_complete: false,
            period_from_values: [],
            live: false,
            dataset: "settlements",
            error:
              settlementsResult.status === "rejected"
                ? "Settlements load failed"
                : "Settlements unavailable",
          },
          rows: [],
          fuelByWeek: {},
        }

  const returns: ReturnsPayload | null =
    returnsResult.status === "fulfilled" ? returnsResult.value : null

  const fuelTrend: FuelTrendPayload | null =
    fuelResult.status === "fulfilled" ? fuelResult.value : null

  const settlementError =
    settlements.meta.error ||
    (settlementsResult.status === "rejected" ? "Settlements load failed" : undefined)

  const returnsError =
    returns?.meta.error ||
    (returnsResult.status === "rejected" ? "Returns load failed" : undefined)

  const fuelError =
    fuelTrend?.meta.error ||
    (fuelResult.status === "rejected" ? "Fuel trend load failed" : undefined)

  return {
    settlements,
    returns,
    fuelTrend,
    sources: {
      settlements: {
        name: "settlements",
        status: settlementError
          ? "error"
          : settlements.rows.length
            ? "ok"
            : "empty",
        rowCount: settlements.meta.fetched_count,
        paginationComplete: settlements.meta.pagination_complete,
        asOf: settlements.meta.as_of || new Date().toISOString(),
        freshness: freshnessLabel(settlements.meta.source_freshness),
        error: settlementError,
      },
      returns: {
        name: "returns",
        status: returnsError
          ? "error"
          : returns && returns.rows.length
            ? "ok"
            : returns
              ? "empty"
              : "error",
        rowCount: returns?.meta.fetched_count ?? 0,
        paginationComplete: returns?.meta.pagination_complete ?? false,
        asOf: returns?.meta.as_of || "",
        freshness: freshnessLabel(returns?.meta.source_freshness),
        error: returnsError,
      },
      fuel: {
        name: "fuel",
        status: fuelError
          ? "error"
          : fuelTrend && fuelTrend.meta.fetched_count > 0
            ? "ok"
            : fuelTrend
              ? "empty"
              : "error",
        rowCount: fuelTrend?.meta.fetched_count ?? 0,
        paginationComplete: fuelTrend?.meta.pagination_complete ?? false,
        asOf: fuelTrend?.meta.as_of || "",
        freshness: freshnessLabel(fuelTrend?.meta.source_freshness),
        error: fuelError,
      },
    },
  }
}
