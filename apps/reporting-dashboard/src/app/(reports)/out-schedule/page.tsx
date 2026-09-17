import { OutScheduleDashboard } from "@/components/out-schedule-dashboard"
import { getOutSchedule } from "@/lib/out-schedule"
import { getTrucksCurrentlyOut } from "@/lib/trucks-currently-out"

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function OutSchedulePage() {
  const [data, currentlyOut] = await Promise.all([
    getOutSchedule(),
    getTrucksCurrentlyOut(),
  ])
  return <OutScheduleDashboard data={data} currentlyOut={currentlyOut} />
}
