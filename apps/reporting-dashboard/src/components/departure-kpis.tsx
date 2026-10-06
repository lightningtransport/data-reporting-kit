"use client"

import { Card, CardDescription, CardHeader } from "@/components/ui/card"
import { KpiValue } from "@/components/kpi-value"
import { weekRangeLabel } from "@/lib/ops-table"
import type { DepartureReport } from "@/lib/departures"

function DepartureCard({ label, report }: { label: string; report: DepartureReport | null }) {
  const r = report?.reconciliation
  const count = (value: number | null | undefined) => value == null ? "Unavailable" : String(value)
  return (
    <Card size="sm">
      <CardHeader className="pb-0">
        <CardDescription>{label}</CardDescription>
        <KpiValue>{report === null ? "Loading" : report.complete && r?.combined_distinct_total != null ? String(r.combined_distinct_total) : "Unavailable"}</KpiValue>
        <p className="text-muted-foreground text-xs">
          {report ? weekRangeLabel(report.period.out_from) : ""} · DriverPay + live Schedule_Teams union
        </p>
        {r ? <p className="text-muted-foreground text-xs">
          DriverPay: {count(r.driver_pay_count)} · Schedule_Teams: {count(r.schedule_teams_count)}<br />
          Overlap: {count(r.overlap_count)} · DriverPay-only: {count(r.driver_pay_only_count)} · Schedule-only: {count(r.schedule_teams_only_count)}
        </p> : null}
        {report && !report.complete ? <p className="text-destructive text-xs">Both sources required; total unavailable.</p> : null}
      </CardHeader>
    </Card>
  )
}

export function DepartureKpis({ thisWeek, nextWeek }: { thisWeek: DepartureReport | null; nextWeek: DepartureReport | null }) {
  return <>
    <DepartureCard label="Leaving selected week" report={thisWeek} />
    <DepartureCard label="Leaving following week" report={nextWeek} />
  </>
}
