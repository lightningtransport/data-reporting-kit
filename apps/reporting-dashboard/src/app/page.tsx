import { SettlementDashboard } from "@/components/settlement-dashboard"
import { getSettlementSummary } from "@/lib/data"

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function Home() {
  const data = await getSettlementSummary()
  return <SettlementDashboard data={data} />
}
