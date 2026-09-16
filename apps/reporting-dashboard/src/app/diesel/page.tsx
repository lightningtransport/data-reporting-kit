import { DieselDashboard } from "@/components/diesel-dashboard"
import { getFuel } from "@/lib/fuel"
import { DIESEL_MONTH_REVALIDATE_SECONDS } from "@/lib/reporting-cache"

export const maxDuration = 60
export const revalidate = DIESEL_MONTH_REVALIDATE_SECONDS

export default async function DieselPage() {
  const data = await getFuel()
  return <DieselDashboard data={data} />
}
