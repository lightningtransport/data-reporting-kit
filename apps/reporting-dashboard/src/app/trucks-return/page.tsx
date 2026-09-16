import { TrucksReturnDashboard } from "@/components/trucks-return-dashboard"
import { getReturns } from "@/lib/returns"

export const maxDuration = 60
export const revalidate = 300

export default async function TrucksReturnPage() {
  const data = await getReturns()
  return <TrucksReturnDashboard data={data} />
}
