import { NextResponse } from "next/server"

import { getFuelMonthRows } from "@/lib/fuel"
import {
  DIESEL_MONTH_REVALIDATE_SECONDS,
  dieselCacheControl,
} from "@/lib/reporting-cache"

export const maxDuration = 60
export const revalidate = DIESEL_MONTH_REVALIDATE_SECONDS

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month")?.trim() ?? ""
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month must be YYYY-MM" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }
  const result = await getFuelMonthRows(month)
  if (result.error) {
    return NextResponse.json(
      { error: result.error, rows: [], series: result.series, meta: result },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    )
  }
  return NextResponse.json(
    {
      rows: result.rows,
      series: result.series,
      meta: {
        month,
        total_count: result.totalCount,
        returned_count: result.rows.length,
        truncated: result.truncated,
        as_of: result.asOf,
        source_freshness: result.freshness,
        pagination_complete: result.complete,
        cache_revalidate_seconds: DIESEL_MONTH_REVALIDATE_SECONDS,
      },
    },
    {
      headers: {
        "Cache-Control": dieselCacheControl(DIESEL_MONTH_REVALIDATE_SECONDS),
      },
    }
  )
}
