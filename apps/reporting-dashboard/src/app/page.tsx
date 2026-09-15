import { SettlementDashboard } from "@/components/settlement-dashboard"
import { getSettlementSummary } from "@/lib/data"

export const dynamic = "force-dynamic"

export default async function Home() {
  const data = await getSettlementSummary()
  return <SettlementDashboard data={data} />
}
