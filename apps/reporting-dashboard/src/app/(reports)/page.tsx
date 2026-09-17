import { SettlementDashboard } from "@/components/settlement-dashboard"
import { getSettlementSummary } from "@/lib/data"

export const maxDuration = 60
/** Keep in sync with SETTLEMENTS_REVALIDATE_SECONDS in reporting-cache.ts */
export const revalidate = 120

export default async function Home() {
  const data = await getSettlementSummary()
  return <SettlementDashboard data={data} />
}
