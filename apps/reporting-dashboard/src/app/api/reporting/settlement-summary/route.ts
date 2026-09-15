import { NextResponse } from "next/server"

import { getSettlementSummary } from "@/lib/data"

export const dynamic = "force-dynamic"

export async function GET() {
  const payload = await getSettlementSummary()
  return NextResponse.json(payload)
}
