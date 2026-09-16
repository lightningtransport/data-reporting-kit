import { NextResponse } from "next/server"

import { getFuelTrend } from "@/lib/fuel"
import { dieselCacheControl } from "@/lib/reporting-cache"

export const maxDuration = 60
/** Keep in sync with DIESEL_TREND_REVALIDATE_SECONDS */
export const revalidate = 180

export async function GET() {
  const payload = await getFuelTrend()
  if (payload.meta.error) {
    return NextResponse.json(payload, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    })
  }
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": dieselCacheControl(180),
    },
  })
}
