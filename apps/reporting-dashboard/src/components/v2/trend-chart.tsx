"use client"

import { useState } from "react"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { money, moneyTick, pct } from "@/lib/format"
import type { ExecutiveGrain, ExecutiveLens, TrendPoint } from "@/lib/v2/metrics"
import { cn } from "cn"

const trendConfig = {
  chartGross: { label: "Gross", color: "var(--chart-1)" },
  chartMargin: { label: "Net margin %", color: "var(--chart-2)" },
} satisfies ChartConfig

const chartMargin = { left: 4, right: 8, top: 8, bottom: 4 }

export type ChartTrendPoint = TrendPoint & {
  partial: boolean
  chartGross: number | undefined
  chartMargin: number | undefined
}

/**
 * Single-shot tooltip for the dual-axis composed chart.
 * Do not use ChartTooltipContent+formatter here: formatter runs once per
 * series and duplicates Net/period while formatting margin as money ($0).
 */
function TrendTooltipContent({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: ChartTrendPoint }>
}) {
  if (!active || !payload?.length) return null
  const point = payload.find((item) => item.payload)?.payload
  if (!point) return null

  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium tabular-nums">
        {point.period}
        {point.partial ? " · Partial" : ""}
      </p>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Gross</span>
        <span className="tabular-nums font-medium">
          {point.gross == null ? "Not available" : money(point.gross)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Net</span>
        <span className="tabular-nums font-medium">
          {point.net == null ? "Not available" : money(point.net)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Net margin</span>
        <span className="tabular-nums font-medium">
          {point.margin == null ? "Not available" : pct(point.margin)}
        </span>
      </div>
    </div>
  )
}

export function toChartTrendPoints(
  points: TrendPoint[],
  partialPeriods: Set<string>
): ChartTrendPoint[] {
  return points.map((point) => ({
    ...point,
    partial: partialPeriods.has(point.period),
    chartGross:
      point.status === "ok" && point.gross != null ? point.gross : undefined,
    chartMargin:
      point.status === "ok" && point.margin != null ? point.margin : undefined,
  }))
}

export function GrossNetTrendChart({
  data,
  grain,
  lens,
  span,
  onSpanChange,
}: {
  data: ChartTrendPoint[]
  grain: ExecutiveGrain
  lens: ExecutiveLens
  span: 6 | 12
  onSpanChange: (span: 6 | 12) => void
}) {
  const [showTable, setShowTable] = useState(false)
  const lensLabel = lens === "operating" ? "Operating" : "Accounting"
  const visible = data.slice(-span)
  const empty =
    visible.length === 0 ||
    visible.every(
      (point) => point.chartGross == null && point.chartMargin == null
    )

  if (empty) {
    return (
      <p className="text-muted-foreground text-sm">
        No trend points for the loaded window and filters.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {lensLabel} Gross (bars) and Net margin % (line). Zero margin marked.
          Partial periods marked with *.
        </p>
        <div
          className="bg-muted inline-flex rounded-lg p-0.5"
          role="group"
          aria-label="Trend span"
        >
          {([6, 12] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                span === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={span === value}
              onClick={() => onSpanChange(value)}
            >
              {value} periods
            </button>
          ))}
        </div>
      </div>

      <ChartContainer
        config={trendConfig}
        className="aspect-auto h-48 md:h-64"
        aria-label={`${lensLabel} Gross and Net margin trend`}
      >
        <ComposedChart data={visible} margin={chartMargin}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={grain === "week" ? 36 : 20}
            interval="preserveStartEnd"
            tickFormatter={(value: string) =>
              visible.find((d) => d.label === value)?.partial
                ? `${String(value).slice(5)}*`
                : String(value).slice(5)
            }
          />
          <YAxis
            yAxisId="gross"
            tickLine={false}
            axisLine={false}
            tickFormatter={moneyTick}
            width={48}
          />
          <YAxis
            yAxisId="margin"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            width={40}
            domain={["auto", "auto"]}
          />
          <ReferenceLine
            yAxisId="margin"
            y={0}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.35 }}
            content={<TrendTooltipContent />}
          />
          <ChartLegend content={<ChartLegendContent className="gap-2 pt-2" />} />
          <Bar
            yAxisId="gross"
            dataKey="chartGross"
            name="Gross"
            fill="var(--color-chartGross)"
            radius={3}
          />
          <Line
            yAxisId="margin"
            type="linear"
            dataKey="chartMargin"
            name="Net margin %"
            stroke="var(--color-chartMargin)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ChartContainer>

      <p className="sr-only">
        Accessible trend summary: {visible.length} periods of {lensLabel} Gross
        and Net margin. Use View data table for exact values.
      </p>

      <button
        type="button"
        className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-2 hover:underline"
        aria-expanded={showTable}
        onClick={() => setShowTable((v) => !v)}
      >
        {showTable ? "Hide data table" : "View data table"}
      </button>

      {showTable ? (
        <div className="overflow-x-auto">
          <Table aria-label="Gross, Net, and margin trend table">
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((point) => (
                <TableRow
                  key={point.period}
                  className={cn(point.partial && "bg-muted/40")}
                >
                  <TableCell className="text-xs tabular-nums">
                    {point.period}
                    {point.partial ? " *" : ""}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {point.gross == null ? "—" : money(point.gross)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {point.net == null ? "—" : money(point.net)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {point.margin == null ? "—" : pct(point.margin)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {point.partial
                      ? "Partial"
                      : point.status === "ok"
                        ? "Complete"
                        : point.status}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}
