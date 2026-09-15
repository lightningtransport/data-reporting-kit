import { NextResponse } from "next/server"

import { getSettlementSummary } from "@/lib/data"

export const maxDuration = 60
export const revalidate = 300

export async function GET() {
  const payload = await getSettlementSummary()
  return NextResponse.json(payload)
}
