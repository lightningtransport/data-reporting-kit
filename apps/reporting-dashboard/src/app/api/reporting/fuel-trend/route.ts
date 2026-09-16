import { NextResponse } from "next/server"

import { getFuelTrend } from "@/lib/fuel"

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const payload = await getFuelTrend()
  if (payload.meta.error) {
    return NextResponse.json(payload, { status: 502 })
  }
  return NextResponse.json(payload)
}
