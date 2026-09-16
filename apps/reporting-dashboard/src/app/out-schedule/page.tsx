import { OutScheduleDashboard } from "@/components/out-schedule-dashboard"
import { getOutSchedule } from "@/lib/out-schedule"

export const maxDuration = 60
export const revalidate = 120

export default async function OutSchedulePage() {
  const data = await getOutSchedule()
  return <OutScheduleDashboard data={data} />
}
