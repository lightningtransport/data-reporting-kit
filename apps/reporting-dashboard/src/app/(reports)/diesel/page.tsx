import { DieselDashboard } from "@/components/diesel-dashboard"
import { getFuel } from "@/lib/fuel"

export const maxDuration = 60
/** Keep in sync with DIESEL_MONTH_REVALIDATE_SECONDS in reporting-cache.ts */
export const revalidate = 120

export default async function DieselPage() {
  const data = await getFuel()
  return <DieselDashboard data={data} />
}
