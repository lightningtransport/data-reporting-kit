"use client"

import Link from "next/link"
import { useEffect, useId, useRef } from "react"

import { buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { money, moneyExact, num, pct } from "@/lib/format"
import type { TruckDrawerFilter } from "@/lib/v2/filters"
import type {
  PeriodComparison,
  TeamPerformanceRow,
  TruckAggregate,
  TruckPeriodRow,
} from "@/lib/v2/metrics"
import { cn } from "cn"

const panelMotionClass =
  "data-open:motion-safe:slide-in-from-right data-closed:motion-safe:slide-out-to-right motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none fixed inset-y-0 top-0 right-0 left-auto flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-l p-0 sm:max-w-lg md:max-w-xl"

function ComparisonOnce({
  grossComparison,
  netComparison,
}: {
  grossComparison: PeriodComparison
  netComparison: PeriodComparison
}) {
  const usable =
    netComparison.status === "ok" && netComparison.absolute != null
      ? netComparison
      : grossComparison.status === "ok" && grossComparison.absolute != null
        ? grossComparison
        : null
  if (!usable || usable.absolute == null) {
    return (
      <p className="text-muted-foreground text-xs">
        Key change vs prior: Not available
      </p>
    )
  }
  const sign = usable.absolute > 0 ? "+" : ""
  const label =
    usable === netComparison ? "Net vs prior" : "Gross vs prior"
  return (
    <p className="text-xs tabular-nums">
      Key change vs prior ({label}): {sign}
      {money(usable.absolute)}
      {usable.pct != null ? ` (${sign}${pct(usable.pct)})` : ""}
    </p>
  )
}

function RpmCell({
  rpm,
  status,
}: {
  rpm: number | null
  status: "ok" | "unavailable" | "check_data"
}) {
  if (status === "unavailable" || rpm == null) {
    return <span className="text-muted-foreground">Unavailable</span>
  }
  if (status === "check_data") {
    return (
      <span className="text-amber-800 dark:text-amber-200">
        ${rpm.toFixed(2)} · Check data
      </span>
    )
  }
  return <span>${rpm.toFixed(2)}</span>
}

export function TeamDrillDownPanel({
  open,
  team,
  metrics,
  trucks,
  truckFilter,
  onTruckFilterChange,
  grossComparison,
  netComparison,
  periodLabel,
  viewLabel,
  onClose,
  onSelectTruck,
}: {
  open: boolean
  team: string | null
  metrics: TeamPerformanceRow | null
  trucks: TruckAggregate[]
  truckFilter: TruckDrawerFilter
  onTruckFilterChange: (filter: TruckDrawerFilter) => void
  grossComparison: PeriodComparison
  netComparison: PeriodComparison
  periodLabel: string
  viewLabel: string
  onClose: () => void
  onSelectTruck: (truck: string, trigger?: HTMLElement) => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => headingRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, team])

  const filtered =
    truckFilter === "all"
      ? trucks
      : truckFilter === "low_gross"
        ? trucks.filter((t) => t.flags.includes("low_gross"))
        : trucks.filter((t) => t.flags.includes("negative_net"))

  const why: string[] = []
  if (metrics) {
    if (metrics.negativeNetTrucks > 0) {
      why.push(`${metrics.negativeNetTrucks} negative-net trucks`)
    }
    if (metrics.lowGrossTrucks > 0) {
      why.push(`${metrics.lowGrossTrucks} trucks below gross threshold`)
    }
    if (metrics.net < 0) why.push("Team Net is negative")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        showCloseButton
        className={panelMotionClass}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <DialogHeader className="border-border/60 shrink-0 border-b px-4 py-4">
          <DialogTitle
            id={titleId}
            ref={headingRef}
            tabIndex={-1}
            className="outline-none focus-visible:ring-ring rounded-sm focus-visible:ring-2"
          >
            {team ?? "Team"}
          </DialogTitle>
          <DialogDescription id={descriptionId}>
            {periodLabel} · {viewLabel}. Physical team performance. Escape
            closes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {metrics ? (
            <>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Net</p>
                  <p className="text-lg tabular-nums font-semibold">
                    {money(metrics.net)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Margin</p>
                  <p className="text-lg tabular-nums font-semibold">
                    {metrics.margin == null ? "—" : pct(metrics.margin)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Neg. trucks</p>
                  <p className="text-lg tabular-nums font-semibold">
                    {metrics.negativeNetTrucks}
                  </p>
                </div>
              </div>
              <ComparisonOnce
                grossComparison={grossComparison}
                netComparison={netComparison}
              />

              <section aria-labelledby="team-why">
                <h3 id="team-why" className="text-sm font-semibold">
                  Why this team needs attention
                </h3>
                {why.length ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                    {why.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground mt-1 text-sm">
                    No exception flags for this team in the selected period.
                  </p>
                )}
              </section>

              <div
                className="bg-muted inline-flex flex-wrap rounded-lg p-0.5"
                role="tablist"
                aria-label="Truck list filter"
              >
                {(
                  [
                    ["negative_net", `Negative net`],
                    ["low_gross", `Low gross`],
                    ["all", `All ${trucks.length} trucks`],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={truckFilter === value}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium",
                      truckFilter === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground"
                    )}
                    onClick={() => onTruckFilterChange(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="max-h-[50vh] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-background sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Truck</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">RPM</TableHead>
                      <TableHead>Flag</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Action</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-muted-foreground text-sm"
                        >
                          No trucks in this filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((truck) => (
                        <TableRow key={truck.truck}>
                          <TableCell className="font-medium tabular-nums">
                            {truck.truck}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(truck.net)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(truck.gross)}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            <RpmCell
                              rpm={truck.rpm}
                              status={truck.rpmStatus}
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            {truck.flags.length
                              ? truck.flags
                                  .map((f) =>
                                    f === "negative_net"
                                      ? "Neg net"
                                      : f === "low_gross"
                                        ? "Low gross"
                                        : "Check data"
                                  )
                                  .join(" · ")
                              : "Stable"}
                          </TableCell>
                          <TableCell className="text-right">
                            <button
                              type="button"
                              aria-haspopup="dialog"
                              aria-label={`Open truck ${truck.truck}`}
                              className="text-foreground text-xs font-medium underline-offset-2 hover:underline"
                              onClick={(event) =>
                                onSelectTruck(
                                  truck.truck,
                                  event.currentTarget
                                )
                              }
                            >
                              Review →
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Team metrics unavailable for this selection.
            </p>
          )}
        </div>

        <div className="border-border/60 shrink-0 border-t px-4 py-3">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Open settlements report
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TruckDrillDownPanel({
  open,
  truck,
  aggregate,
  history,
  periodLabel,
  onBack,
  onClose,
}: {
  open: boolean
  truck: string | null
  aggregate: TruckAggregate | null
  history: TruckPeriodRow[]
  periodLabel: string
  onBack: () => void
  onClose: () => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => headingRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, truck])

  const margin =
    aggregate && aggregate.gross !== 0
      ? aggregate.net / aggregate.gross
      : null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        showCloseButton
        className={panelMotionClass}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <DialogHeader className="border-border/60 shrink-0 border-b px-4 py-4">
          <div className="mb-2">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-xs font-medium"
              onClick={onBack}
            >
              ← Back to team
            </button>
          </div>
          <DialogTitle
            id={titleId}
            ref={headingRef}
            tabIndex={-1}
            className="outline-none focus-visible:ring-ring rounded-sm focus-visible:ring-2"
          >
            Truck {truck ?? "—"}
          </DialogTitle>
          <DialogDescription id={descriptionId}>
            {periodLabel}
            {aggregate
              ? ` · Team ${aggregate.owner}${aggregate.dispatch ? ` · Dispatch ${aggregate.dispatch}` : ""}`
              : ""}
            . Escape closes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {aggregate ? (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground text-xs">Gross</dt>
                  <dd className="tabular-nums font-semibold">
                    {moneyExact(aggregate.gross)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Net</dt>
                  <dd className="tabular-nums font-semibold">
                    {moneyExact(aggregate.net)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Margin</dt>
                  <dd className="tabular-nums font-semibold">
                    {margin == null ? "—" : pct(margin)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Miles</dt>
                  <dd className="tabular-nums font-semibold">
                    {num(aggregate.miles)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">RPM</dt>
                  <dd className="text-sm tabular-nums font-semibold">
                    <RpmCell
                      rpm={aggregate.rpm}
                      status={aggregate.rpmStatus}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    Fuel expense
                  </dt>
                  <dd className="tabular-nums font-semibold">
                    {moneyExact(aggregate.fuel)}
                  </dd>
                </div>
              </dl>

              <section aria-labelledby="truck-why">
                <h3 id="truck-why" className="text-sm font-semibold">
                  Why flagged
                </h3>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                  {aggregate.flags.length === 0 ? (
                    <li>No exception flags for this period.</li>
                  ) : (
                    aggregate.flags.map((flag) => (
                      <li key={flag}>
                        {flag === "negative_net"
                          ? `Negative Net (${moneyExact(aggregate.net)})`
                          : flag === "low_gross"
                            ? `Gross below $${num(11000)} threshold`
                            : aggregate.rpmReason ?? "RPM Check data"}
                      </li>
                    ))
                  )}
                </ul>
              </section>

              {history.length > 1 ? (
                <section aria-labelledby="truck-history">
                  <h3 id="truck-history" className="mb-2 text-sm font-semibold">
                    Recent settlement weeks
                  </h3>
                  <div className="max-h-48 overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader className="bg-background sticky top-0">
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.slice(0, 8).map((row) => (
                          <TableRow key={row.period}>
                            <TableCell className="text-xs tabular-nums">
                              {row.period}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {money(row.net)}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {money(row.gross)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              No settlement activity for this truck in the selected period.
            </p>
          )}
        </div>

        <div className="border-border/60 flex shrink-0 gap-2 border-t px-4 py-3">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            onClick={onBack}
          >
            Back to team
          </button>
          <Link
            href={truck ? `/?truck=${encodeURIComponent(truck)}` : "/"}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Open settlements report
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
