import { OutScheduleDashboard } from "@/components/out-schedule-dashboard"
import { getOutSchedule } from "@/lib/out-schedule"
import { getTrucksCurrentlyOut } from "@/lib/trucks-currently-out"
import { getDepartureWeek } from "@/lib/departures-server"
import { currentMonday, addDaysIso } from "@/lib/ops-table"

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function OutSchedulePage() {
  const monday = currentMonday()
  const nextMonday = addDaysIso(monday, 7)
  const [data, currentlyOut, thisWeek, nextWeek] = await Promise.all([
    getOutSchedule(),
    getTrucksCurrentlyOut(),
    getDepartureWeek(monday, addDaysIso(monday, 6)),
    getDepartureWeek(nextMonday, addDaysIso(nextMonday, 6)),
  ])
  return <OutScheduleDashboard data={data} currentlyOut={currentlyOut} initialMonday={monday} initialDepartureWeeks={{ thisWeek, nextWeek }} />
}
