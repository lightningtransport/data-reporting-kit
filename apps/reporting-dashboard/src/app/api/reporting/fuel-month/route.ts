import { NextResponse } from "next/server"

import { getFuelMonthRows } from "@/lib/fuel"

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month")?.trim() ?? ""
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month must be YYYY-MM" },
      { status: 400 }
    )
  }
  const result = await getFuelMonthRows(month)
  if (result.error) {
    return NextResponse.json(
      { error: result.error, rows: [], meta: result },
      { status: 502 }
    )
  }
  return NextResponse.json({
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
    },
  })
}
