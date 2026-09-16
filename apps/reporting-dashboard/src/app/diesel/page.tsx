import { DieselDashboard } from "@/components/diesel-dashboard"
import { getFuel } from "@/lib/fuel"

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function DieselPage() {
  const data = await getFuel()
  return <DieselDashboard data={data} />
}
