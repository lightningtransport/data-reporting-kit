"use client"

import Link from "next/link"
import { useEffect, useRef, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Eyebrow, KpiValue } from "@/components/kpi-value"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  TeamDrillDownPanel,
  TruckDrillDownPanel,
} from "@/components/v2/drill-down-panel"
import {
  GrossNetTrendChart,
  toChartTrendPoints,
} from "@/components/v2/trend-chart"
import { money, moneyExact, num, pct } from "@/lib/format"
import {
  monthsFromWeeks,
  ownersFromRows,
  weeksFromRows,
  type SettlementPayload,
} from "@/lib/settlement"
import {
  isPeriodPartial,
  resolveV2Filters,
  type V2SearchParams,
} from "@/lib/v2/filters"
import type { V2DashboardData } from "@/lib/v2/load"
import {
  buildGrossNetTrend,
  compareMetric,
  filterRowsForPeriod,
  lensGross,
  lensNet,
  lowGrossExceptions,
  negativeNetExceptions,
  operatingMargin,
  previousCalendarMonth,
  previousSettlementWeekStart,
  productiveTrucks,
  reconcileNets,
  returnDateGaps,
  revenuePerMile,
  teamPerformance,
  truckSettlementHistory,
  trucksInSelection,
  type MetricValue,
  type PeriodComparison,
} from "@/lib/v2/metrics"
import { cn } from "cn"

function formatMetricMoney(metric: MetricValue): string {
  if (metric.value == null) {
    if (metric.status === "empty") return "—"
    return "Not available"
  }
  return money(metric.value)
}

function formatMetricCount(metric: MetricValue): string {
  if (metric.value == null) {
    if (metric.status === "empty") return "—"
    return "Not available"
  }
  return String(metric.value)
}

function formatRpm(metric: MetricValue): string {
  if (metric.value == null) return "Not available"
  return `$${metric.value.toFixed(2)}`
}

function formatMargin(metric: MetricValue): string {
  if (metric.value == null) return "Not available"
  return pct(metric.value)
}

function ComparisonLine({ comparison }: { comparison: PeriodComparison }) {
  if (comparison.status !== "ok" || comparison.absolute == null) {
    return (
      <p className="text-muted-foreground text-xs">
        vs prior: Not available
        {comparison.reason ? ` · ${comparison.reason}` : ""}
      </p>
    )
  }
  const sign = comparison.absolute > 0 ? "+" : ""
  return (
    <p
      className={cn(
        "text-xs tabular-nums",
        comparison.absolute < 0 && "text-destructive",
        comparison.absolute > 0 && "text-foreground"
      )}
    >
      vs prior: {sign}
      {money(comparison.absolute)}
      {comparison.pct != null ? ` (${sign}${pct(comparison.pct)})` : ""}
    </p>
  )
}

function LightningMark() {
  return (
    <svg
      aria-label="Lightning Transportation & Logistics"
      role="img"
      viewBox="0 0 1536 894"
      className="h-auto w-20 shrink-0 sm:w-28"
    >
      <title>Lightning Transportation & Logistics</title>
      <filter id="v2-remove-logo-black" colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1 1 1 0 0"
        />
      </filter>
      <image
        href="/lightning-transport-logo.png"
        width="1536"
        height="894"
        filter="url(#v2-remove-logo-black)"
      />
    </svg>
  )
}

export function ExecutiveOverview({ data }: { data: V2DashboardData }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const lastTriggerRef = useRef<HTMLElement | null>(null)

  const params: V2SearchParams = {
    grain: searchParams.get("grain") ?? undefined,
    period: searchParams.get("period") ?? undefined,
    team: searchParams.get("team") ?? undefined,
    lens: searchParams.get("lens") ?? undefined,
    focus: searchParams.get("focus") ?? undefined,
    truck: searchParams.get("truck") ?? undefined,
  }

  const settlements: SettlementPayload = data.settlements
  const allRows = settlements.rows
  const filters = resolveV2Filters(params, allRows)

  const weeks = weeksFromRows(allRows)
  const months = monthsFromWeeks(weeks)
  const owners = ownersFromRows(allRows)
  const incomplete = !settlements.meta.pagination_complete
  const periodPartial = isPeriodPartial(filters.grain, filters.period)

  const activeRows = filterRowsForPeriod(
    allRows,
    filters.grain,
    filters.period,
    filters.teams.length ? filters.teams : undefined
  )

  const priorPeriod =
    filters.grain === "week"
      ? previousSettlementWeekStart(filters.period)
      : previousCalendarMonth(filters.period)
  const priorPartial = isPeriodPartial(filters.grain, priorPeriod)
  const priorRows = filterRowsForPeriod(
    allRows,
    filters.grain,
    priorPeriod,
    filters.teams.length ? filters.teams : undefined
  )

  const opts = { incomplete }
  const gross = lensGross(activeRows, filters.lens, opts)
  const net = lensNet(activeRows, filters.lens, opts)
  const margin = operatingMargin(net, gross)
  const rpm = revenuePerMile(activeRows, opts)
  const trucks = productiveTrucks(activeRows, opts)
  const reconciliation = reconcileNets(activeRows, opts)
  const teams = teamPerformance(activeRows)
  const neg = negativeNetExceptions(activeRows)
  const low = lowGrossExceptions(activeRows)
  const gaps =
    data.sources.returns.status === "ok" && data.returns
      ? returnDateGaps(data.returns.rows)
      : []

  const priorGross = lensGross(priorRows, filters.lens, opts)
  const priorNet = lensNet(priorRows, filters.lens, opts)
  const grossCmp = compareMetric(gross, priorGross, {
    currentPartial: periodPartial,
    previousPartial: priorPartial,
  })
  const netCmp = compareMetric(net, priorNet, {
    currentPartial: periodPartial,
    previousPartial: priorPartial,
  })

  const trendPoints = buildGrossNetTrend(allRows, filters.grain, filters.lens, {
    incomplete,
    teams: filters.teams.length ? filters.teams : undefined,
    endDate: filters.period || undefined,
    maxMonths: 12,
  })
  const partialPeriods = new Set(
    trendPoints
      .filter((point) => isPeriodPartial(filters.grain, point.period))
      .map((point) => point.period)
  )
  const chartPoints = toChartTrendPoints(trendPoints, partialPeriods)

  const focusTeam = filters.focusTeam
  const focusTruck = filters.focusTruck
  const focusedTeamMetrics =
    focusTeam != null
      ? (teams.find((team) => team.team === focusTeam) ?? null)
      : null
  const focusTeamRows =
    focusTeam != null
      ? activeRows.filter((row) => row.o === focusTeam)
      : []
  const focusTeamTrucks = trucksInSelection(focusTeamRows)
  const focusTeamPriorRows =
    focusTeam != null
      ? priorRows.filter((row) => row.o === focusTeam)
      : []
  const focusTeamGrossCmp = compareMetric(
    lensGross(focusTeamRows, "operating", opts),
    lensGross(focusTeamPriorRows, "operating", opts),
    { currentPartial: periodPartial, previousPartial: priorPartial }
  )
  const focusTeamNetCmp = compareMetric(
    lensNet(focusTeamRows, "operating", opts),
    lensNet(focusTeamPriorRows, "operating", opts),
    { currentPartial: periodPartial, previousPartial: priorPartial }
  )
  const focusTruckHistory =
    focusTruck != null ? truckSettlementHistory(allRows, focusTruck) : []
  const focusTruckPeriod =
    focusTruck != null
      ? (trucksInSelection(activeRows).find((t) => t.truck === focusTruck) ??
        null)
      : null

  const periodLabel = `${filters.grain === "week" ? "Week" : "Month"} ${filters.period || "—"}`
  const filterSummary = `Lens ${filters.lens === "operating" ? "Operating Fleet" : "Accounting Total"}; team filter ${filters.teams.join("|") || "all"}`

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") next.delete(key)
      else next.set(key, value)
    }
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    })
  }

  function rememberTrigger(target: EventTarget | null) {
    if (target instanceof HTMLElement) lastTriggerRef.current = target
  }

  function openTeam(team: string, trigger?: EventTarget | null) {
    rememberTrigger(trigger ?? null)
    updateParams({ focus: team, truck: null })
  }

  function openTruck(
    truck: string,
    options?: { team?: string | null; trigger?: EventTarget | null }
  ) {
    rememberTrigger(options?.trigger ?? null)
    updateParams({
      truck,
      focus: options?.team ?? focusTeam,
    })
  }

  function closeTruckPanel() {
    if (focusTeam) {
      updateParams({ truck: null })
      return
    }
    updateParams({ truck: null, focus: null })
  }

  function closeTeamPanel() {
    updateParams({ focus: null, truck: null })
  }

  useEffect(() => {
    if (focusTeam || focusTruck) return
    const trigger = lastTriggerRef.current
    if (trigger) {
      trigger.focus()
      lastTriggerRef.current = null
    }
  }, [focusTeam, focusTruck])

  const settlementFailed = data.sources.settlements.status === "error"
  const asOf = data.sources.settlements.asOf
  const freshness = data.sources.settlements.freshness

  return (
    <div className="bg-background text-foreground min-h-full">
      <a
        href="#v2-main"
        className="bg-primary text-primary-foreground focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 sr-only focus:not-sr-only"
      >
        Skip to executive overview
      </a>

      <header className="border-border/60 border-b">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <LightningMark />
              <div>
                <Eyebrow>Lightning Transportation</Eyebrow>
                <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                  Executive Overview
                </h1>
              </div>
            </div>
            <div className="text-muted-foreground text-right text-xs sm:text-sm">
              <p>
                As of{" "}
                <time dateTime={asOf}>
                  {asOf ? new Date(asOf).toLocaleString() : "—"}
                </time>
              </p>
              <p>{freshness}</p>
            </div>
          </div>

          <div
            className="flex flex-wrap items-end gap-3"
            role="group"
            aria-label="Executive filters"
          >
            <label className="flex min-w-[8rem] flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs font-medium">
                Period grain
              </span>
              <Select
                items={[
                  { value: "week", label: "Week" },
                  { value: "month", label: "Month" },
                ]}
                value={filters.grain}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    updateParams({ grain: value, period: null })
                  }
                }}
              >
                <SelectTrigger aria-label="Period grain" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>

            <label className="flex min-w-[12rem] flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs font-medium">
                Selected period
              </span>
              <Select
                items={(filters.grain === "week" ? weeks : months).map(
                  (value) => ({ value, label: value })
                )}
                value={filters.period || undefined}
                onValueChange={(value) => {
                  if (typeof value === "string") updateParams({ period: value })
                }}
              >
                <SelectTrigger aria-label="Selected period" className="w-full">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(filters.grain === "week" ? weeks : months).map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      )
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>

            <label className="flex min-w-[10rem] flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs font-medium">
                Team
              </span>
              <Select
                items={[
                  { value: "all", label: "All" },
                  ...owners.map((owner) => ({ value: owner, label: owner })),
                ]}
                value={filters.teams[0] ?? "all"}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    updateParams({ team: value === "all" ? null : value })
                  }
                }}
              >
                <SelectTrigger aria-label="Team" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All</SelectItem>
                    {owners.map((owner) => (
                      <SelectItem key={owner} value={owner}>
                        {owner}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>

            <label className="flex min-w-[12rem] flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs font-medium">
                Lens
              </span>
              <Select
                items={[
                  { value: "operating", label: "Operating Fleet" },
                  { value: "accounting", label: "Accounting Total" },
                ]}
                value={filters.lens}
                onValueChange={(value) => {
                  if (typeof value === "string") updateParams({ lens: value })
                }}
              >
                <SelectTrigger aria-label="Lens" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="operating">Operating Fleet</SelectItem>
                    <SelectItem value="accounting">Accounting Total</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>

            {periodPartial ? (
              <Badge variant="outline" className="mb-1">
                Partial period
              </Badge>
            ) : null}
            {incomplete ? (
              <Badge variant="destructive" className="mb-1">
                Incomplete pagination
              </Badge>
            ) : null}
            {pending ? (
              <span className="text-muted-foreground mb-1 text-xs">
                Updating…
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <main id="v2-main" className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {settlementFailed ? (
          <Card>
            <CardHeader>
              <CardTitle>Settlements unavailable</CardTitle>
              <CardDescription>
                {data.sources.settlements.error ??
                  "Live settlement data could not be loaded."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" onClick={() => router.refresh()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!settlementFailed && activeRows.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No qualifying records</CardTitle>
              <CardDescription>
                No settlement rows match the active period and filters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  updateParams({
                    team: null,
                    period: null,
                    grain: "week",
                    lens: "operating",
                  })
                }
              >
                Reset filters
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!settlementFailed && activeRows.length > 0 ? (
          <>
            <section aria-labelledby="v2-kpi-heading" className="space-y-3">
              <h2 id="v2-kpi-heading" className="sr-only">
                Key performance indicators
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card size="sm">
                  <CardHeader>
                    <CardDescription>
                      {filters.lens === "operating"
                        ? "Operating Gross"
                        : "Accounting Gross"}
                    </CardDescription>
                    <KpiValue>{formatMetricMoney(gross)}</KpiValue>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <ComparisonLine comparison={grossCmp} />
                    <p className="text-muted-foreground text-xs">
                      Stored Gross ·{" "}
                      {filters.lens === "operating"
                        ? "physical trucks only"
                        : "includes allocation 1/2/3"}
                    </p>
                  </CardContent>
                </Card>

                <Card size="sm">
                  <CardHeader>
                    <CardDescription>
                      {filters.lens === "operating"
                        ? "Operating Net / Margin"
                        : "Accounting Net / Margin"}
                    </CardDescription>
                    <KpiValue>{formatMetricMoney(net)}</KpiValue>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="text-sm tabular-nums">
                      Margin {formatMargin(margin)}
                    </p>
                    <ComparisonLine comparison={netCmp} />
                    <p className="text-muted-foreground text-xs">
                      Stored Net · not recomputed from expenses
                    </p>
                  </CardContent>
                </Card>

                <Card size="sm">
                  <CardHeader>
                    <CardDescription>RPM</CardDescription>
                    <KpiValue>{formatRpm(rpm)}</KpiValue>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-xs">
                      Physical Gross ÷ Driven miles
                    </p>
                  </CardContent>
                </Card>

                <Card size="sm">
                  <CardHeader>
                    <CardDescription>Productive Trucks</CardDescription>
                    <KpiValue>{formatMetricCount(trucks)}</KpiValue>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-xs">
                      Distinct physical units with settlement activity — not
                      fleet utilization
                      {filters.lens === "accounting"
                        ? " (physical count kept when Accounting Total is active)"
                        : ""}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section aria-labelledby="v2-attention-heading">
              <Card>
                <CardHeader>
                  <CardTitle id="v2-attention-heading">Attention Now</CardTitle>
                  <CardDescription>
                    Decision-ready exceptions for the active filters
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm font-medium">Negative net</p>
                    <p className="font-mono text-2xl tabular-nums">{neg.length}</p>
                    <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                      {neg.slice(0, 5).map((item) => (
                        <li key={item.truck}>
                          <button
                            type="button"
                            className="hover:text-foreground focus-visible:ring-ring rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:outline-none"
                            onClick={(event) =>
                              openTruck(item.truck, {
                                team: item.owner,
                                trigger: event.currentTarget,
                              })
                            }
                          >
                            Truck {item.truck} · {moneyExact(item.net)}
                          </button>
                        </li>
                      ))}
                      {neg.length === 0 ? <li>None in selection</li> : null}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Gross under $11,000</p>
                    <p className="font-mono text-2xl tabular-nums">{low.length}</p>
                    <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                      {low.slice(0, 5).map((item) => (
                        <li key={item.truck}>
                          <button
                            type="button"
                            className="hover:text-foreground focus-visible:ring-ring rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:outline-none"
                            onClick={(event) =>
                              openTruck(item.truck, {
                                team: item.owner,
                                trigger: event.currentTarget,
                              })
                            }
                          >
                            Truck {item.truck} · {moneyExact(item.gross)}
                          </button>
                        </li>
                      ))}
                      {low.length === 0 ? <li>None in selection</li> : null}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Return-date gaps</p>
                    {data.sources.returns.status === "error" ? (
                      <p className="text-muted-foreground text-sm">
                        Data unavailable · returns
                      </p>
                    ) : (
                      <>
                        <p className="font-mono text-2xl tabular-nums">
                          {gaps.length}
                        </p>
                        <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                          {gaps.slice(0, 5).map((item) => (
                            <li key={item.truck}>
                              <button
                                type="button"
                                className="hover:text-foreground focus-visible:ring-ring rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:outline-none"
                                onClick={(event) =>
                                  openTruck(item.truck, {
                                    trigger: event.currentTarget,
                                  })
                                }
                              >
                                Truck {item.truck}
                              </button>
                            </li>
                          ))}
                          {gaps.length === 0 ? (
                            <li>None in current returns load</li>
                          ) : null}
                        </ul>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section aria-labelledby="v2-trend-heading">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle id="v2-trend-heading">
                      Gross and Net Trend
                    </CardTitle>
                    <CardDescription>
                      Up to 12 calendar months ending at the selected period ·
                      same lens and team filter · partial periods marked
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {incomplete ? (
                      <p className="text-muted-foreground text-sm">
                        Trend unavailable · settlement pagination incomplete.
                      </p>
                    ) : (
                      <GrossNetTrendChart
                        data={chartPoints}
                        grain={filters.grain}
                        lens={filters.lens}
                      />
                    )}
                  </CardContent>
                </Card>
              </section>

              <section aria-labelledby="v2-recon-heading">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle id="v2-recon-heading">
                      Operating vs Accounting
                    </CardTitle>
                    <CardDescription>
                      Allocation trucks 1/2/3 are accounting buckets, not
                      physical trucks.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {reconciliation.status === "partial" ||
                    reconciliation.status === "empty" ? (
                      <p className="text-muted-foreground">
                        Reconciliation incomplete
                        {reconciliation.reason
                          ? ` · ${reconciliation.reason}`
                          : ""}
                      </p>
                    ) : (
                      <>
                        <div className="flex justify-between gap-4">
                          <span>Operating Net</span>
                          <span className="font-mono tabular-nums">
                            {moneyExact(reconciliation.operatingNet)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>+ Allocation Impact (1/2/3)</span>
                          <span className="font-mono tabular-nums">
                            {moneyExact(reconciliation.allocationImpact)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4 border-t pt-2 font-medium">
                          <span>= Accounting Net</span>
                          <span className="font-mono tabular-nums">
                            {moneyExact(reconciliation.accountingNet)}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {reconciliation.balanced
                            ? "Balanced for this population"
                            : reconciliation.reason}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </section>
            </div>

            <section aria-labelledby="v2-teams-heading">
              <Card>
                <CardHeader>
                  <CardTitle id="v2-teams-heading">Team Performance</CardTitle>
                  <CardDescription>
                    Sorted by negative-net trucks, then low-gross trucks, then
                    lowest net. Physical-truck metrics only.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="text-right">RPM</TableHead>
                        <TableHead className="text-right">Neg. trucks</TableHead>
                        <TableHead className="text-right">Low gross</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teams.map((team) => (
                        <TableRow
                          key={team.team}
                          className={cn(
                            "hover:bg-muted/50 cursor-pointer",
                            focusTeam === team.team && "bg-muted/60"
                          )}
                          tabIndex={0}
                          role="button"
                          aria-label={`Open team ${team.team} drill-down`}
                          onClick={(event) =>
                            openTeam(team.team, event.currentTarget)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              openTeam(team.team, event.currentTarget)
                            }
                          }}
                        >
                          <TableCell className="font-medium">
                            {team.team}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {money(team.gross)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {money(team.net)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {team.margin == null
                              ? "Not available"
                              : pct(team.margin)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {team.rpm == null
                              ? "Not available"
                              : `$${team.rpm.toFixed(2)}`}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {team.negativeNetTrucks}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {team.lowGrossTrucks}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}

        <section aria-labelledby="v2-ops-heading">
          <Card>
            <CardHeader>
              <CardTitle id="v2-ops-heading">Operational Reports</CardTitle>
              <CardDescription>
                Existing operational detail routes — unchanged by V2
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(
                [
                  ["/", "Settlements"],
                  ["/out-schedule", "Out Schedule"],
                  ["/trucks-return", "Trucks Return"],
                  ["/diesel", "Diesel"],
                ] as const
              ).map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>

        <details className="border-border/60 rounded-xl border px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">
            Technical details
          </summary>
          <div className="text-muted-foreground mt-3 space-y-2 text-xs">
            <p>
              Sources: settlements ({data.sources.settlements.status},{" "}
              {data.sources.settlements.rowCount} rows, pagination{" "}
              {data.sources.settlements.paginationComplete
                ? "complete"
                : "incomplete"}
              ); returns ({data.sources.returns.status},{" "}
              {data.sources.returns.rowCount} rows).
            </p>
            <p>
              Filters: grain={filters.grain}, period={filters.period || "—"},
              team={filters.teams.join("|") || "all"}, lens={filters.lens}.
              Active settlement rows: {activeRows.length}.
            </p>
            <p>
              As of: {asOf || "—"}. Freshness: {freshness}. Request time is not
              a source sync timestamp.
            </p>
            <p>
              Allocation buckets 1/2/3 excluded from Operating Fleet KPIs,
              RPM, productive trucks, and exception lists; included in
              Accounting Total and reconciliation.
            </p>
            <p>
              Productive Trucks = distinct physical trucks with a settlement
              row in the selection (activity, not utilization).
            </p>
            <p>
              Trend points: {trendPoints.length} ({filters.grain}). History
              rows loaded: {num(allRows.length)}. Drill-down URL: focus=
              {focusTeam || "—"}, truck={focusTruck || "—"}.
            </p>
          </div>
        </details>
      </main>

      <TeamDrillDownPanel
        open={Boolean(focusTeam) && !focusTruck}
        team={focusTeam}
        metrics={focusedTeamMetrics}
        trucks={focusTeamTrucks}
        grossComparison={focusTeamGrossCmp}
        netComparison={focusTeamNetCmp}
        periodLabel={periodLabel}
        filterSummary={filterSummary}
        onClose={closeTeamPanel}
        onSelectTruck={(truck) => openTruck(truck, { team: focusTeam })}
      />

      <TruckDrillDownPanel
        open={Boolean(focusTruck)}
        truck={focusTruck}
        periodMetrics={focusTruckPeriod}
        history={focusTruckHistory}
        periodLabel={periodLabel}
        filterSummary={filterSummary}
        onClose={closeTruckPanel}
        onBackToTeam={
          focusTeam
            ? () => updateParams({ truck: null, focus: focusTeam })
            : undefined
        }
      />
    </div>
  )
}
