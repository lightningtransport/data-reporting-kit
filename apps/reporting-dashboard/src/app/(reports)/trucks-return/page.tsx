import { TrucksReturnDashboard } from "@/components/trucks-return-dashboard"
import { getReturns } from "@/lib/returns"
import { getTrucksCurrentlyOut } from "@/lib/trucks-currently-out"

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function TrucksReturnPage() {
  const [data, currentlyOut] = await Promise.all([
    getReturns(),
    getTrucksCurrentlyOut(),
  ])
  return <TrucksReturnDashboard data={data} currentlyOut={currentlyOut} />
}
