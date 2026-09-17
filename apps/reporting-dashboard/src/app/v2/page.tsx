import { Suspense } from "react"

import { ExecutiveOverview } from "@/components/v2/executive-overview"
import { SETTLEMENTS_REVALIDATE_SECONDS } from "@/lib/reporting-cache"
import { loadV2DashboardData } from "@/lib/v2/load"

export const maxDuration = 60
/** Keep in sync with SETTLEMENTS_REVALIDATE_SECONDS */
export const revalidate = 120

export const metadata = {
  title: "Executive Overview | Lightning Reporting",
  description:
    "Executive overview of Lightning Transportation settlements, exceptions, and operating vs accounting reconciliation.",
}

function V2Fallback() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6">
      <div className="bg-muted h-10 w-64 animate-pulse rounded" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-muted h-28 animate-pulse rounded-xl"
          />
        ))}
      </div>
      <div className="bg-muted h-48 animate-pulse rounded-xl" />
      <p className="text-muted-foreground text-sm">
        Loading executive overview…
      </p>
      <p className="sr-only">
        Cache window {SETTLEMENTS_REVALIDATE_SECONDS}s
      </p>
    </div>
  )
}

export default async function V2Page() {
  const data = await loadV2DashboardData()

  return (
    <Suspense fallback={<V2Fallback />}>
      <ExecutiveOverview data={data} />
    </Suspense>
  )
}
