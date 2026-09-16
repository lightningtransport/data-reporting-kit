import { NextResponse } from "next/server"

import { getFuelTrend } from "@/lib/fuel"
import {
  DIESEL_TREND_REVALIDATE_SECONDS,
  dieselCacheControl,
} from "@/lib/reporting-cache"

export const maxDuration = 60
export const revalidate = DIESEL_TREND_REVALIDATE_SECONDS

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
      "Cache-Control": dieselCacheControl(DIESEL_TREND_REVALIDATE_SECONDS),
    },
  })
}
