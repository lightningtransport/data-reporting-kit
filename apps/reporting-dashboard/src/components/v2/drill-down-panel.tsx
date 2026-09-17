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
import type {
  PeriodComparison,
  TeamPerformanceRow,
  TruckAggregate,
  TruckPeriodRow,
} from "@/lib/v2/metrics"

const panelMotionClass =
  "data-open:motion-safe:slide-in-from-right data-closed:motion-safe:slide-out-to-right motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none fixed inset-y-0 top-0 right-0 left-auto flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-l p-0 sm:max-w-lg"

function ComparisonText({ comparison }: { comparison: PeriodComparison }) {
  if (comparison.status !== "ok" || comparison.absolute == null) {
    return (
      <span className="text-muted-foreground">
        vs prior: Not available
        {comparison.reason ? ` · ${comparison.reason}` : ""}
      </span>
    )
  }
  const sign = comparison.absolute > 0 ? "+" : ""
  return (
    <span className="tabular-nums">
      vs prior: {sign}
      {money(comparison.absolute)}
      {comparison.pct != null ? ` (${sign}${pct(comparison.pct)})` : ""}
    </span>
  )
}

export function TeamDrillDownPanel({
  open,
  team,
  metrics,
  trucks,
  grossComparison,
  netComparison,
  periodLabel,
  filterSummary,
  onClose,
  onSelectTruck,
}: {
  open: boolean
  team: string | null
  metrics: TeamPerformanceRow | null
  trucks: TruckAggregate[]
  grossComparison: PeriodComparison
  netComparison: PeriodComparison
  periodLabel: string
  filterSummary: string
  onClose: () => void
  onSelectTruck: (truck: string, trigger?: HTMLElement) => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!open) return
    // Move keyboard focus into the panel after open (Dialog also traps focus).
    const id = window.setTimeout(() => headingRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, team])

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
            {team ? `Team ${team}` : "Team"}
          </DialogTitle>
          <DialogDescription id={descriptionId}>
            {periodLabel}. {filterSummary}. Physical-truck metrics only. Press
            Escape to close.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {metrics ? (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Gross</dt>
                  <dd className="font-mono tabular-nums">
                    {moneyExact(metrics.gross)}
                  </dd>
                  <dd className="text-xs">
                    <ComparisonText comparison={grossComparison} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Net</dt>
                  <dd className="font-mono tabular-nums">
                    {moneyExact(metrics.net)}
                  </dd>
                  <dd className="text-xs">
                    <ComparisonText comparison={netComparison} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Margin</dt>
                  <dd className="font-mono tabular-nums">
                    {metrics.margin == null
                      ? "Not available"
                      : pct(metrics.margin)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">RPM</dt>
                  <dd className="font-mono tabular-nums">
                    {metrics.rpm == null
                      ? "Not available"
                      : `$${metrics.rpm.toFixed(2)}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    Negative-net trucks
                  </dt>
                  <dd className="font-mono tabular-nums">
                    {metrics.negativeNetTrucks}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    Low-gross trucks
                  </dt>
                  <dd className="font-mono tabular-nums">
                    {metrics.lowGrossTrucks}
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="mb-2 text-sm font-medium">
                  Physical trucks ({trucks.length})
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Truck</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">RPM</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trucks.map((truck) => (
                        <TableRow key={truck.truck}>
                          <TableCell>
                            <button
                              type="button"
                              aria-haspopup="dialog"
                              aria-label={`Open drill-down for truck ${truck.truck}`}
                              className="text-foreground hover:underline focus-visible:ring-ring rounded-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                              onClick={(event) =>
                                onSelectTruck(truck.truck, event.currentTarget)
                              }
                            >
                              {truck.truck}
                            </button>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {money(truck.gross)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {money(truck.net)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {truck.rpm == null
                              ? "Not available"
                              : `$${truck.rpm.toFixed(2)}`}
                          </TableCell>
                        </TableRow>
                      ))}
                      {trucks.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-muted-foreground"
                          >
                            No physical trucks in this selection.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <p className="text-muted-foreground text-xs">
                Definitions: Gross/Net are stored settlement fields. RPM =
                physical Gross ÷ Driven miles when miles &gt; 0. Low gross =
                under $11,000. Allocation buckets 1/2/3 are excluded.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Team metrics unavailable for the active filters.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TruckDrillDownPanel({
  open,
  truck,
  periodMetrics,
  history,
  periodLabel,
  filterSummary,
  onClose,
  onBackToTeam,
}: {
  open: boolean
  truck: string | null
  periodMetrics: TruckAggregate | null
  history: TruckPeriodRow[]
  periodLabel: string
  filterSummary: string
  onClose: () => void
  onBackToTeam?: () => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      if (onBackToTeam && backRef.current) {
        backRef.current.focus()
        return
      }
      headingRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [open, truck, onBackToTeam])

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
            {truck ? `Truck ${truck}` : "Truck"}
          </DialogTitle>
          <DialogDescription id={descriptionId}>
            {periodLabel}. {filterSummary}.
            {periodMetrics?.owner ? ` Team ${periodMetrics.owner}.` : ""} Press
            Escape to close
            {onBackToTeam ? " or use Back to team" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {periodMetrics ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Gross</dt>
                <dd className="font-mono tabular-nums">
                  {moneyExact(periodMetrics.gross)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Net</dt>
                <dd className="font-mono tabular-nums">
                  {moneyExact(periodMetrics.net)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Driven miles</dt>
                <dd className="font-mono tabular-nums">
                  {num(periodMetrics.miles)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">RPM</dt>
                <dd className="font-mono tabular-nums">
                  {periodMetrics.rpm == null
                    ? "Not available"
                    : `$${periodMetrics.rpm.toFixed(2)}`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">
                  Fuel expenses (settlement)
                </dt>
                <dd className="font-mono tabular-nums">
                  {moneyExact(periodMetrics.fuel)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">
                  Fuel cost / mile
                </dt>
                <dd className="font-mono tabular-nums">
                  {periodMetrics.fuelPerMile == null
                    ? "Not available"
                    : `$${periodMetrics.fuelPerMile.toFixed(2)}`}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">
              No settlement activity for this truck in the active period.
            </p>
          )}

          <div>
            <h3 className="mb-2 text-sm font-medium">
              Settlement history (loaded window)
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week start</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Miles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={row.period}>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {row.period}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {money(row.gross)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {money(row.net)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {num(row.miles)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No history in the loaded settlement window.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Diesel gallon matching is not joined here when settlement and fuel
            periods cannot be reconciled safely at truck grain. Open Diesel for
            fuel detail.
          </p>

          <div className="flex flex-wrap gap-2">
            {onBackToTeam ? (
              <button
                ref={backRef}
                type="button"
                className={buttonVariants({ variant: "outline", size: "sm" })}
                onClick={onBackToTeam}
              >
                Back to team
              </button>
            ) : null}
            <Link
              href="/"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open Settlements
            </Link>
            <Link
              href="/diesel"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open Diesel
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
