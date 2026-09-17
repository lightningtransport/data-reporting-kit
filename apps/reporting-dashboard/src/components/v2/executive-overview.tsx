"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { money, moneyExact, pct } from "@/lib/format"
import {
  dispatchesFromRows,
  monthsFromWeeks,
  ownersFromRows,
  weeksFromRows,
  type SettlementPayload,
} from "@/lib/settlement"
import {
  formatPeriodLabel,
  isPeriodPartial,
  resolveV2Filters,
  type V2SearchParams,
} from "@/lib/v2/filters"
import type { V2DashboardData } from "@/lib/v2/load"
import {
  allocationImpact,
  buildGrossNetTrend,
  compareMetric,
  dispatchPerformance,
  executiveInterpretation,
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

function formatMoney(metric: MetricValue): string {
  if (metric.value == null) return metric.status === "empty" ? "—" : "Unavailable"
  return money(metric.value)
}

function DirectionLine({
  comparison,
  favorableWhen,
}: {
  comparison: PeriodComparison
  favorableWhen: "up" | "down"
}) {
  if (comparison.status !== "ok" || comparison.absolute == null) {
    return (
      <p className="text-muted-foreground text-xs">vs prior: Unavailable</p>
    )
  }
  const up = comparison.absolute > 0
  const favorable =
    (favorableWhen === "up" && up) || (favorableWhen === "down" && !up)
  const arrow = up ? "↑" : comparison.absolute < 0 ? "↓" : "→"
  const sign = comparison.absolute > 0 ? "+" : ""
  return (
    <p
      className={cn(
        "text-xs tabular-nums",
        favorable ? "text-foreground" : "text-destructive"
      )}
    >
      <span aria-hidden>{arrow}</span> {sign}
      {money(comparison.absolute)}
      {comparison.pct != null ? ` (${sign}${pct(comparison.pct)})` : ""}{" "}
      <span className="text-muted-foreground">
        {favorable ? "favorable" : "unfavorable"} vs prior
      </span>
    </p>
  )
}

function LightningMark() {
  return (
    <svg
      aria-label="Lightning Transportation & Logistics"
      role="img"
      viewBox="0 0 1536 894"
      className="h-auto w-14 shrink-0 sm:w-16"
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
    dispatch: searchParams.get("dispatch") ?? undefined,
    lens: searchParams.get("lens") ?? undefined,
    focus: searchParams.get("focus") ?? undefined,
    truck: searchParams.get("truck") ?? undefined,
    teamscope: searchParams.get("teamscope") ?? undefined,
    truckfilter: searchParams.get("truckfilter") ?? undefined,
    trend: searchParams.get("trend") ?? undefined,
    priorities: searchParams.get("priorities") ?? undefined,
  }

  const settlements: SettlementPayload = data.settlements
  const allRows = settlements.rows
  const filters = resolveV2Filters(params, allRows)

  const weeks = weeksFromRows(allRows)
  const months = monthsFromWeeks(weeks)
  const owners = ownersFromRows(allRows)
  const dispatches = dispatchesFromRows(allRows)
  const incomplete = !settlements.meta.pagination_complete
  const periodPartial = isPeriodPartial(filters.grain, filters.period)
  const periodHuman = formatPeriodLabel(filters.grain, filters.period)

  const filterOpts = {
    teams: filters.teams.length ? filters.teams : undefined,
    dispatches: filters.dispatches.length ? filters.dispatches : undefined,
  }

  const activeRows = filterRowsForPeriod(
    allRows,
    filters.grain,
    filters.period,
    filterOpts
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
    filterOpts
  )

  const opts = { incomplete }
  const isAccounting = filters.lens === "accounting"
  const gross = lensGross(activeRows, filters.lens, opts)
  const net = lensNet(activeRows, filters.lens, opts)
  const margin = operatingMargin(net, gross)
  const alloc = allocationImpact(activeRows, opts)
  const rpm = revenuePerMile(activeRows, opts)
  const trucks = productiveTrucks(activeRows, opts)
  const reconciliation = reconcileNets(activeRows, opts)
  const teams = teamPerformance(activeRows)
  const dispatchRows = dispatchPerformance(activeRows)
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
  const interpretation = executiveInterpretation({
    view: filters.lens,
    grossCmp,
    netCmp,
  })

  const trendSourceRows =
    filters.dispatches.length > 0
      ? allRows.filter((row) => {
          const dispatch = (row.d || "").trim() || "(unassigned)"
          return filters.dispatches.includes(dispatch)
        })
      : allRows
  const trendPoints = buildGrossNetTrend(
    trendSourceRows,
    filters.grain,
    filters.lens,
    {
      incomplete,
      teams: filters.teams.length ? filters.teams : undefined,
      endDate: filters.period || undefined,
      maxMonths: 12,
    }
  )
  const partialPeriods = new Set(
    trendPoints
      .filter((point) => isPeriodPartial(filters.grain, point.period))
      .map((point) => point.period)
  )
  const chartPoints = toChartTrendPoints(trendPoints, partialPeriods)

  const visibleTeams =
    filters.teamScope === "all"
      ? teams
      : teams.filter((team) => team.needsAttention)

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

  const attentionCategories = useMemo(() => {
    const items = [
      {
        id: "financial-neg",
        group: "Financial" as const,
        label: "Negative-net trucks",
        count: neg.length,
        impact: neg.reduce((sum, item) => sum + item.net, 0),
        urgency: neg.length > 0 ? "high" : "none",
      },
      {
        id: "financial-low",
        group: "Financial" as const,
        label: "Low-gross trucks",
        count: low.length,
        impact: null as number | null,
        urgency: low.length > 0 ? "medium" : "none",
      },
      {
        id: "data-returns",
        group: "Data quality" as const,
        label: "Return-date gaps",
        count: gaps.length,
        impact: null as number | null,
        urgency: gaps.length > 0 ? "medium" : "none",
      },
    ]
    return items.filter((item) => item.count > 0).slice(0, 3)
  }, [neg, low, gaps])

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

  function rememberTrigger(target: EventTarget | null | undefined) {
    if (target instanceof HTMLElement) lastTriggerRef.current = target
  }

  function openTeam(team: string, trigger?: EventTarget | null) {
    rememberTrigger(trigger)
    updateParams({ focus: team, truck: null, truckfilter: null })
  }

  function openTruck(
    truck: string,
    options?: { team?: string | null; trigger?: EventTarget | null }
  ) {
    rememberTrigger(options?.trigger)
    updateParams({
      truck,
      focus: options?.team ?? focusTeam,
    })
  }

  function closeTruckPanel() {
    updateParams({ truck: null })
  }

  function closeTeamPanel() {
    updateParams({ focus: null, truck: null, truckfilter: null })
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
  const freshnessRaw = data.sources.settlements.freshness
  const freshnessUnavailable =
    !freshnessRaw ||
    freshnessRaw === "Freshness unknown" ||
    freshnessRaw.toLowerCase().includes("unknown") ||
    freshnessRaw.toLowerCase().includes("unavailable")

  const dataStatus =
    settlementFailed
      ? "Unavailable"
      : incomplete
        ? "Incomplete"
        : activeRows.length
          ? "Available"
          : "Empty"

  return (
    <div className="bg-background text-foreground min-h-full">
      <a
        href="#v2-main"
        className="bg-primary text-primary-foreground focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 sr-only focus:not-sr-only"
      >
        Skip to executive overview
      </a>

      <header className="border-border/70 border-b">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <LightningMark />
              <div className="min-w-0">
                <h1 className="font-heading truncate text-lg font-semibold tracking-tight sm:text-xl">
                  Executive Overview
                </h1>
                <p className="text-muted-foreground text-sm">{periodHuman}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={dataStatus === "Available" ? "secondary" : "outline"}
                title={
                  freshnessUnavailable
                    ? "The source does not provide a synchronization timestamp. As of reflects request time."
                    : freshnessRaw
                }
              >
                Data {dataStatus}
                {freshnessUnavailable ? " · Freshness unavailable" : ""}
              </Badge>
              <details className="relative">
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-sm font-medium">
                  Operational reports
                </summary>
                <div className="bg-popover absolute right-0 z-20 mt-1 min-w-44 rounded-lg border p-1 shadow-md">
                  {[
                    ["/", "Settlements"],
                    ["/out-schedule", "Out Schedule"],
                    ["/trucks-return", "Trucks Return"],
                    ["/diesel", "Diesel"],
                  ].map(([href, label]) => (
                    <Link
                      key={href}
                      href={href}
                      className="hover:bg-muted block rounded-md px-2 py-1.5 text-sm"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </details>
            </div>
          </div>

          <div
            className="flex flex-wrap items-end gap-2"
            role="group"
            aria-label="Executive filters"
          >
            <div
              className="bg-muted inline-flex rounded-lg p-0.5"
              role="group"
              aria-label="View"
            >
              {(
                [
                  ["operating", "Operating"],
                  ["accounting", "Accounting"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filters.lens === value}
                  className={cn(
                    "min-h-9 rounded-md px-3 text-sm font-medium",
                    filters.lens === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                  onClick={() => updateParams({ lens: value })}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="flex min-w-[7rem] flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Grain</span>
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
                <SelectTrigger aria-label="Grain" className="h-9 w-full">
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

            <label className="flex min-w-[10rem] flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Period</span>
              <Select
                items={(filters.grain === "week" ? weeks : months).map(
                  (value) => ({
                    value,
                    label: formatPeriodLabel(filters.grain, value),
                  })
                )}
                value={filters.period || undefined}
                onValueChange={(value) => {
                  if (typeof value === "string") updateParams({ period: value })
                }}
              >
                <SelectTrigger aria-label="Period" className="h-9 w-full">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(filters.grain === "week" ? weeks : months).map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {formatPeriodLabel(filters.grain, value)}
                        </SelectItem>
                      )
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>

            <label className="flex min-w-[9rem] flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Team</span>
              <Select
                items={[
                  { value: "all", label: "All teams" },
                  ...owners.map((owner) => ({ value: owner, label: owner })),
                ]}
                value={filters.teams[0] ?? "all"}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    updateParams({ team: value === "all" ? null : value })
                  }
                }}
              >
                <SelectTrigger aria-label="Team" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All teams</SelectItem>
                    {owners.map((owner) => (
                      <SelectItem key={owner} value={owner}>
                        {owner}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>

            <label className="flex min-w-[9rem] flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Dispatch</span>
              <Select
                items={[
                  { value: "all", label: "All dispatch" },
                  ...dispatches.map((d) => ({ value: d, label: d })),
                ]}
                value={filters.dispatches[0] ?? "all"}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    updateParams({
                      dispatch: value === "all" ? null : value,
                    })
                  }
                }}
              >
                <SelectTrigger aria-label="Dispatch" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All dispatch</SelectItem>
                    {dispatches.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>

            {periodPartial ? (
              <Badge variant="outline" className="mb-0.5">
                Partial period
              </Badge>
            ) : null}
            {pending ? (
              <span className="text-muted-foreground mb-0.5 text-xs">
                Updating…
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <main
        id="v2-main"
        className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6"
      >
        {settlementFailed ? (
          <section className="rounded-xl border p-4">
            <h2 className="font-semibold">Settlements unavailable</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {data.sources.settlements.error ??
                "Live settlement data could not be loaded."}
            </p>
            <Button
              type="button"
              className="mt-3"
              onClick={() => router.refresh()}
            >
              Retry
            </Button>
          </section>
        ) : null}

        {!settlementFailed && activeRows.length === 0 ? (
          <section className="rounded-xl border p-4">
            <h2 className="font-semibold">No qualifying records</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              No settlement rows match the active period and filters.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() =>
                updateParams({
                  team: null,
                  dispatch: null,
                  period: null,
                  grain: "week",
                  lens: "operating",
                })
              }
            >
              Reset filters
            </Button>
          </section>
        ) : null}

        {!settlementFailed && activeRows.length > 0 ? (
          <>
            <section aria-labelledby="v2-summary" className="space-y-3">
              <h2 id="v2-summary" className="text-sm font-semibold tracking-wide uppercase">
                Executive summary
              </h2>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="bg-card rounded-xl border p-4 md:col-span-1 md:row-span-1 md:min-h-[8.5rem]">
                  <p className="text-muted-foreground text-xs font-medium">
                    {isAccounting ? "Accounting Net / Margin" : "Operating Net / Margin"}
                  </p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                    {formatMoney(net)}
                    <span className="text-muted-foreground ml-2 text-base font-medium">
                      · {margin.value == null ? "—" : pct(margin.value)}
                    </span>
                  </p>
                  <DirectionLine comparison={netCmp} favorableWhen="up" />
                </div>
                <div className="bg-card rounded-xl border p-4">
                  <p className="text-muted-foreground text-xs font-medium">
                    {isAccounting ? "Accounting Gross" : "Operating Gross"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                    {formatMoney(gross)}
                  </p>
                  <DirectionLine comparison={grossCmp} favorableWhen="up" />
                </div>
                <div className="bg-card rounded-xl border p-4">
                  <p className="text-muted-foreground text-xs font-medium">
                    {isAccounting
                      ? "Allocation impact"
                      : "Productive trucks"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                    {isAccounting
                      ? formatMoney(alloc)
                      : trucks.value == null
                        ? "—"
                        : String(trucks.value)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {isAccounting
                      ? "Stored Net on buckets 1/2/3"
                      : "Settlement-active physical units"}
                  </p>
                </div>
              </div>
              {interpretation ? (
                <p className="text-sm leading-relaxed">{interpretation}</p>
              ) : null}
              {isAccounting ? (
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-muted-foreground text-xs font-medium uppercase">
                    Operating context
                  </p>
                  <p className="mt-1 text-sm tabular-nums">
                    Productive trucks{" "}
                    <strong>
                      {trucks.value == null ? "—" : trucks.value}
                    </strong>
                    {" · "}
                    RPM{" "}
                    <strong>
                      {rpm.value == null
                        ? "Unavailable"
                        : `$${rpm.value.toFixed(2)}`}
                    </strong>
                    {rpm.reason ? ` (${rpm.reason})` : ""}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs tabular-nums">
                  Supporting RPM{" "}
                  {rpm.value == null
                    ? "Unavailable"
                    : `$${rpm.value.toFixed(2)}`}
                  {rpm.reason ? ` · ${rpm.reason}` : ""}
                </p>
              )}
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
              <section
                aria-labelledby="v2-trend"
                className="rounded-xl border p-4"
              >
                <h2 id="v2-trend" className="text-sm font-semibold">
                  Performance trend
                </h2>
                <div className="mt-3">
                  <GrossNetTrendChart
                    data={chartPoints}
                    grain={filters.grain}
                    lens={filters.lens}
                    span={filters.trendSpan}
                    onSpanChange={(span) =>
                      updateParams({ trend: span === 6 ? "6" : null })
                    }
                  />
                </div>
              </section>

              <section
                aria-labelledby="v2-attention"
                className="rounded-xl border p-4"
              >
                <h2 id="v2-attention" className="text-sm font-semibold">
                  Needs attention
                </h2>
                <ul className="mt-3 space-y-3">
                  {attentionCategories.length === 0 ? (
                    <li className="text-muted-foreground text-sm">
                      No priority exceptions for this selection.
                    </li>
                  ) : (
                    attentionCategories.map((item) => (
                      <li key={item.id} className="text-sm">
                        <p className="font-medium">
                          {item.count} {item.label}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {item.group}
                          {item.impact != null
                            ? ` · Impact ${money(item.impact)}`
                            : ""}
                          {item.urgency !== "none"
                            ? ` · ${item.urgency} urgency`
                            : ""}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() =>
                    updateParams({
                      priorities: filters.prioritiesOpen ? null : "1",
                    })
                  }
                >
                  {filters.prioritiesOpen
                    ? "Hide priorities"
                    : "Review priorities"}
                </Button>
                {filters.prioritiesOpen ? (
                  <div className="mt-4 space-y-4 border-t pt-3 text-sm">
                    <div>
                      <h3 className="font-medium">Financial · Negative net</h3>
                      <ul className="mt-1 space-y-1">
                        {neg.slice(0, 12).map((item) => (
                          <li key={item.truck}>
                            <button
                              type="button"
                              className="font-medium underline-offset-2 hover:underline"
                              onClick={(e) =>
                                openTruck(item.truck, {
                                  team: item.owner,
                                  trigger: e.currentTarget,
                                })
                              }
                            >
                              Truck {item.truck}
                            </button>{" "}
                            <span className="text-muted-foreground tabular-nums">
                              {moneyExact(item.net)} · {item.owner}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-medium">Financial · Low gross</h3>
                      <ul className="mt-1 space-y-1">
                        {low.slice(0, 12).map((item) => (
                          <li key={item.truck}>
                            <button
                              type="button"
                              className="font-medium underline-offset-2 hover:underline"
                              onClick={(e) =>
                                openTruck(item.truck, {
                                  team: item.owner,
                                  trigger: e.currentTarget,
                                })
                              }
                            >
                              Truck {item.truck}
                            </button>{" "}
                            <span className="text-muted-foreground tabular-nums">
                              {moneyExact(item.gross)} · {item.owner}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-medium">
                        Data quality · Return-date gaps
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        Completeness issue on returns — not a financial
                        underperformance flag.
                      </p>
                      <p className="mt-1 tabular-nums">{gaps.length} trucks</p>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>

            <section
              aria-labelledby="v2-recon"
              className="bg-muted/30 rounded-xl px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="v2-recon" className="text-sm font-semibold">
                  Accounting reconciliation
                </h2>
                <Badge variant="outline">
                  {reconciliation.balanced ? "Balanced" : "Incomplete"}
                </Badge>
              </div>
              <p className="mt-2 text-sm tabular-nums">
                Operating Net {money(reconciliation.operatingNet)}
                {" + "}
                Allocations {money(reconciliation.allocationImpact)}
                {" = "}
                Accounting Net {money(reconciliation.accountingNet)}
              </p>
              <details className="mt-2">
                <summary className="text-muted-foreground cursor-pointer text-xs font-medium">
                  Explain allocation buckets
                </summary>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Settlement trucks 1, 2, and 3 are owner-allocation buckets
                  (Carlos, Jorge, CDT)—not physical units. Allocation Impact is
                  their stored Net. Operating Net excludes them; Accounting Net
                  includes them.
                </p>
              </details>
            </section>

            <section aria-labelledby="v2-teams" className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="v2-teams" className="text-sm font-semibold">
                    Physical team performance
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    Sorted by attention (negative Net / exceptions), then lowest
                    Net. Owner teams — not dispatch groups.
                  </p>
                </div>
                <div
                  className="bg-muted inline-flex rounded-lg p-0.5"
                  role="group"
                  aria-label="Team table scope"
                >
                  {(
                    [
                      ["attention", "Needs attention"],
                      ["all", "All teams"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={
                        (filters.teamScope === "attention" &&
                          value === "attention") ||
                        (filters.teamScope === "all" && value === "all")
                      }
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs font-medium",
                        filters.teamScope === value
                          ? "bg-background shadow-sm"
                          : "text-muted-foreground"
                      )}
                      onClick={() =>
                        updateParams({
                          teamscope: value === "all" ? "all" : null,
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead className="text-right">Exceptions</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleTeams.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-muted-foreground"
                        >
                          No teams in this scope.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleTeams.map((team) => (
                        <TableRow
                          key={team.team}
                          className="hover:bg-muted/40 focus-within:bg-muted/40"
                        >
                          <TableCell className="font-medium">
                            {team.team}
                            {team.needsAttention ? (
                              <span className="text-destructive ml-2 text-xs">
                                Needs attention
                              </span>
                            ) : (
                              <span className="text-muted-foreground ml-2 text-xs">
                                Stable
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(team.net)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {team.margin == null ? "—" : pct(team.margin)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {team.negativeNetTrucks} / {team.lowGrossTrucks}
                          </TableCell>
                          <TableCell className="text-right">
                            <button
                              type="button"
                              aria-haspopup="dialog"
                              aria-expanded={focusTeam === team.team}
                              className="text-sm font-medium underline-offset-2 hover:underline"
                              onClick={(e) =>
                                openTeam(team.team, e.currentTarget)
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

              <ul className="space-y-2 md:hidden">
                {visibleTeams.map((team) => (
                  <li
                    key={team.team}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{team.team}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        Net {money(team.net)} ·{" "}
                        {team.needsAttention ? "Needs attention" : "Stable"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-sm font-medium"
                      onClick={(e) => openTeam(team.team, e.currentTarget)}
                    >
                      Review →
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="v2-dispatch" className="space-y-3">
              <div>
                <h2 id="v2-dispatch" className="text-sm font-semibold">
                  Physical dispatch performance
                </h2>
                <p className="text-muted-foreground text-xs">
                  Distinct from owner teams. Dispatch comes from settlement{" "}
                  <code className="text-[0.7rem]">Dispatch</code>.
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispatch</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead className="text-right">Trucks</TableHead>
                      <TableHead className="text-right">Exceptions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatchRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-muted-foreground"
                        >
                          No dispatch groups in this selection.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dispatchRows.map((row) => (
                        <TableRow key={row.team}>
                          <TableCell className="font-medium">
                            {row.team}
                            {row.needsAttention ? (
                              <span className="text-destructive ml-2 text-xs">
                                Needs attention
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(row.net)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.margin == null ? "—" : pct(row.margin)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.productiveTrucks}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.negativeNetTrucks} / {row.lowGrossTrucks}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <details className="text-muted-foreground rounded-lg text-xs leading-relaxed">
              <summary className="text-foreground cursor-pointer text-sm font-medium">
                Technical details
              </summary>
              <div className="mt-2 space-y-1">
                <p>
                  Sources: settlements ({data.sources.settlements.status},{" "}
                  {data.sources.settlements.rowCount} rows, pagination{" "}
                  {String(data.sources.settlements.paginationComplete)});
                  returns ({data.sources.returns.status}).
                </p>
                <p>
                  As of{" "}
                  <time dateTime={asOf}>
                    {asOf ? new Date(asOf).toLocaleString() : "—"}
                  </time>{" "}
                  = request time. Freshness unavailable means the source does
                  not publish sync time — not that records refreshed at request
                  time.
                </p>
                <p>
                  Filters: view={filters.lens}, grain={filters.grain}, period=
                  {filters.period}, team=
                  {filters.teams.join("|") || "all"}, dispatch=
                  {filters.dispatches.join("|") || "all"}.
                </p>
                <p>
                  RPM trust band: exclude trucks with miles≤0; flag Check data
                  when miles &lt; 100 and RPM &gt; $5, or RPM outside
                  $0.05–$15/mi. Aggregate RPM excludes Check-data / unavailable
                  trucks. Does not clamp stored Gross or miles.
                </p>
                <p>
                  Diesel MPG join skipped at truck grain (unsafe period match).
                  Allocation buckets 1/2/3 are owner accounting only.
                </p>
              </div>
            </details>
          </>
        ) : null}
      </main>

      <TeamDrillDownPanel
        open={Boolean(focusTeam) && !focusTruck}
        team={focusTeam}
        metrics={focusedTeamMetrics}
        trucks={focusTeamTrucks}
        truckFilter={filters.truckFilter}
        onTruckFilterChange={(value) =>
          updateParams({
            truckfilter: value === "negative_net" ? null : value,
          })
        }
        grossComparison={focusTeamGrossCmp}
        netComparison={focusTeamNetCmp}
        periodLabel={periodHuman}
        viewLabel={isAccounting ? "Accounting view" : "Operating view"}
        onClose={closeTeamPanel}
        onSelectTruck={(truck, trigger) =>
          openTruck(truck, { team: focusTeam, trigger })
        }
      />

      <TruckDrillDownPanel
        open={Boolean(focusTruck)}
        truck={focusTruck}
        aggregate={focusTruckPeriod}
        history={focusTruckHistory}
        periodLabel={periodHuman}
        onBack={closeTruckPanel}
        onClose={() => {
          if (focusTeam) closeTruckPanel()
          else closeTeamPanel()
        }}
      />
    </div>
  )
}
