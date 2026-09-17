"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { DieselMonthlyTrendChart } from "@/components/diesel-charts"
import { DashboardShell } from "@/components/dashboard-shell"
import { KpiValue } from "@/components/kpi-value"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import { moneyExact, num } from "@/lib/format"
import {
  pickProductAgg,
  type FuelAgg,
  type FuelMonthSeries,
  type FuelPayload,
  type FuelRow,
  type FuelTrendPayload,
} from "@/lib/fuel"
import {
  DIESEL_MONTH_REVALIDATE_SECONDS,
  DIESEL_TREND_REVALIDATE_SECONDS,
  DIESEL_TREND_SESSION_KEY,
  DIESEL_TREND_SESSION_MAX_AGE_MS,
} from "@/lib/reporting-cache"
import { MONTH_NAMES } from "@/lib/settlement"

function monthLabel(ym: string): string {
  const [year, month] = ym.split("-")
  const name = MONTH_NAMES[Number(month) - 1] ?? month
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

function shortMonthLabel(ym: string): string {
  const [year, month] = ym.split("-")
  const name = MONTH_NAMES[Number(month) - 1] ?? month
  const short = name.slice(0, 3)
  return `${short.charAt(0).toUpperCase()}${short.slice(1)} ${year.slice(2)}`
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <KpiValue>{value}</KpiValue>
      </CardHeader>
    </Card>
  )
}

function matchesProduct(row: FuelRow, product: string): boolean {
  if (product === "all") return true
  const name = row.product.toLowerCase()
  if (product === "diesel") return name.includes("diesel") && !name.includes("def")
  if (product === "def") return name.includes("def")
  return row.product === product
}

function kpiFromAgg(agg: FuelAgg): {
  gallons: number
  adjustedSpend: number
  transactions: number
  distinctTrucks: number
  pricePerGallon: number | null
} {
  return {
    gallons: agg.gallons,
    adjustedSpend: agg.spend,
    transactions: agg.transactions,
    distinctTrucks: agg.trucks,
    pricePerGallon: agg.gallons > 0 && agg.spend > 0 ? agg.spend / agg.gallons : null,
  }
}

export function DieselDashboard({ data }: { data: FuelPayload }) {
  const months = useMemo(() => {
    const fromData = data.meta.months.length ? data.meta.months : []
    const current = currentMonthKey()
    const set = new Set(fromData)
    set.add(current)
    return [...set].sort()
  }, [data.meta.months])

  const defaultMonth = months.includes(data.meta.detail_month)
    ? data.meta.detail_month
    : months.includes(currentMonthKey())
      ? currentMonthKey()
      : (months[months.length - 1] ?? currentMonthKey())

  const [month, setMonth] = useState(defaultMonth)
  const [owner, setOwner] = useState("all")
  const [product, setProduct] = useState("diesel")
  const [truckQuery, setTruckQuery] = useState("")
  const [monthly, setMonthly] = useState<FuelMonthSeries[]>(data.monthly)
  const [owners, setOwners] = useState<string[]>(data.owners)
  const [trendReady, setTrendReady] = useState(false)
  const [trendUpdating, setTrendUpdating] = useState(true)
  const [trendError, setTrendError] = useState("")
  const [trendFromCache, setTrendFromCache] = useState(false)
  const [detailRows, setDetailRows] = useState<FuelRow[]>(data.rows)
  const [detailMeta, setDetailMeta] = useState({
    total: data.meta.detail_row_count,
    truncated: data.meta.detail_truncated,
    loading: false,
    error: "",
  })

  useEffect(() => {
    let cancelled = false
    try {
      const raw = sessionStorage.getItem(DIESEL_TREND_SESSION_KEY)
      if (raw) {
        const stored = JSON.parse(raw) as {
          savedAt?: number
          payload?: FuelTrendPayload
        }
        const age = Date.now() - Number(stored.savedAt ?? 0)
        if (
          stored.payload?.monthly?.length &&
          age >= 0 &&
          age < DIESEL_TREND_SESSION_MAX_AGE_MS
        ) {
          setMonthly(stored.payload.monthly)
          if (stored.payload.owners?.length) setOwners(stored.payload.owners)
          setTrendReady(true)
          setTrendFromCache(true)
        }
      }
    } catch {
      // ignore bad session cache
    }

    setTrendUpdating(true)
    fetch("/api/reporting/fuel-trend")
      .then(async (response) => {
        const payload = (await response.json()) as FuelTrendPayload & {
          meta?: { error?: string }
        }
        if (!response.ok) {
          throw new Error(payload.meta?.error || `HTTP ${response.status}`)
        }
        if (cancelled) return
        if (payload.monthly?.length) setMonthly(payload.monthly)
        if (payload.owners?.length) setOwners(payload.owners)
        setTrendReady(true)
        setTrendFromCache(false)
        setTrendError("")
        try {
          sessionStorage.setItem(
            DIESEL_TREND_SESSION_KEY,
            JSON.stringify({ savedAt: Date.now(), payload })
          )
        } catch {
          // quota / private mode
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setTrendError(
          error instanceof Error ? error.message : "Couldn't load the trend"
        )
      })
      .finally(() => {
        if (!cancelled) setTrendUpdating(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (month === data.meta.detail_month) {
      setDetailRows(data.rows)
      setDetailMeta({
        total: data.meta.detail_row_count,
        truncated: data.meta.detail_truncated,
        loading: false,
        error: "",
      })
      return
    }
    let cancelled = false
    setDetailMeta((prev) => ({ ...prev, loading: true, error: "" }))
    fetch(`/api/reporting/fuel-month?month=${encodeURIComponent(month)}`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          rows?: FuelRow[]
          series?: FuelMonthSeries
          meta?: { total_count?: number; truncated?: boolean }
          error?: string
        }
        if (!response.ok) {
          throw new Error(payload.error || `HTTP ${response.status}`)
        }
        if (cancelled) return
        setDetailRows(payload.rows ?? [])
        if (payload.series) {
          setMonthly((prev) => {
            const next = [...prev]
            const idx = next.findIndex((item) => item.month === month)
            if (idx >= 0) next[idx] = payload.series!
            else next.push(payload.series!)
            return next.sort((a, b) => a.month.localeCompare(b.month))
          })
          const ownerNames = Object.keys(payload.series.byOwner)
          if (ownerNames.length) {
            setOwners((prev) =>
              [...new Set([...prev, ...ownerNames])].sort((a, b) =>
                a.localeCompare(b)
              )
            )
          }
        }
        setDetailMeta({
          total: Number(payload.meta?.total_count ?? payload.rows?.length ?? 0),
          truncated: Boolean(payload.meta?.truncated),
          loading: false,
          error: "",
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDetailRows([])
        setDetailMeta({
          total: 0,
          truncated: false,
          loading: false,
          error: error instanceof Error ? error.message : "Couldn't load month",
        })
      })
    return () => {
      cancelled = true
    }
  }, [month, data.meta.detail_month, data.meta.detail_row_count, data.meta.detail_truncated, data.rows])

  const monthItems = useMemo(
    () => months.map((value) => ({ value, label: monthLabel(value) })),
    [months]
  )
  const ownerItems = useMemo(
    () => [
      { value: "all", label: "All" },
      ...owners.map((value) => ({ value, label: value })),
    ],
    [owners]
  )
  const productItems = useMemo(
    () => [
      { value: "diesel", label: "Diesel (excl. DEF)" },
      { value: "def", label: "DEF" },
      { value: "all", label: "All products" },
    ],
    []
  )

  const monthIndex = months.indexOf(month)
  const focusSeries = monthly.find((item) => item.month === month)

  const kpi = useMemo(() => {
    if (!focusSeries) {
      return {
        gallons: 0,
        adjustedSpend: 0,
        transactions: 0,
        distinctTrucks: 0,
        pricePerGallon: null as number | null,
      }
    }
    return kpiFromAgg(pickProductAgg(focusSeries, product, owner))
  }, [focusSeries, product, owner])

  const monthlyTrend = useMemo(() => {
    return monthly.map((item) => {
      const agg = pickProductAgg(item, product, owner)
      return {
        month: item.month,
        label: shortMonthLabel(item.month),
        gallons: agg.gallons,
        spend: agg.spend,
      }
    })
  }, [monthly, product, owner])

  const byOwner = useMemo(() => {
    if (!focusSeries) return []
    const bucketKey =
      product === "def" ? "def" : product === "all" ? "all" : "diesel"
    return Object.entries(focusSeries.byOwner)
      .map(([name, value]) => {
        const agg =
          bucketKey === "def"
            ? value.def
            : bucketKey === "all"
              ? value.all
              : value.diesel
        return {
          owner: name,
          gallons: agg.gallons,
          spend: agg.spend,
          transactions: agg.transactions,
          trucks: agg.trucks,
        }
      })
      .filter((row) => row.transactions > 0)
      .sort((a, b) => b.gallons - a.gallons || a.owner.localeCompare(b.owner))
  }, [focusSeries, product])

  const filteredDetail = useMemo(() => {
    const query = truckQuery.trim().toLowerCase()
    return detailRows.filter((row) => {
      if (owner !== "all" && row.owner !== owner) return false
      if (!matchesProduct(row, product)) return false
      if (
        query &&
        !row.unit.toLowerCase().includes(query) &&
        !row.product.toLowerCase().includes(query) &&
        !row.city.toLowerCase().includes(query)
      ) {
        return false
      }
      return true
    })
  }, [detailRows, owner, product, truckQuery])

  const productLabel =
    productItems.find((item) => item.value === product)?.label ?? product

  return (
    <DashboardShell
      title="Diesel"
      subtitle={`${monthLabel(month)} · ${productLabel} · ${kpi.transactions} tx · ${kpi.distinctTrucks} camiones`}
      live={Boolean(data.meta.live)}
    >
      {data.meta.error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load Diesel</AlertTitle>
          <AlertDescription>
            Live agent-reporting (fuel) only. There is no embedded snapshot.{" "}
            {data.meta.error}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card size="sm">
        <CardContent className="pt-(--card-spacing)">
          <FieldGroup className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field>
              <FieldLabel>Month</FieldLabel>
              <div className="flex w-full items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={monthIndex <= 0}
                  onClick={() => setMonth(months[monthIndex - 1] ?? month)}
                >
                  <ChevronLeftIcon />
                </Button>
                <Select
                  items={monthItems}
                  value={month}
                  onValueChange={(value) => {
                    if (typeof value === "string") setMonth(value)
                  }}
                >
                  <SelectTrigger className="min-w-0 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {monthItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={monthIndex < 0 || monthIndex >= months.length - 1}
                  onClick={() => setMonth(months[monthIndex + 1] ?? month)}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel>Owner</FieldLabel>
              <Select
                items={ownerItems}
                value={owner}
                onValueChange={(value) => {
                  if (typeof value === "string") setOwner(value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ownerItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Producto</FieldLabel>
              <Select
                items={productItems}
                value={product}
                onValueChange={(value) => {
                  if (typeof value === "string") setProduct(value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {productItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Truck / product / city</FieldLabel>
              <Input
                value={truckQuery}
                onChange={(event) => setTruckQuery(event.target.value)}
                placeholder="Search"
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Gallons" value={num(kpi.gallons)} />
        <KpiCard label="Adjusted spend" value={moneyExact(kpi.adjustedSpend)} />
        <KpiCard label="Transactions" value={String(kpi.transactions)} />
        <KpiCard label="Trucks" value={String(kpi.distinctTrucks)} />
        <KpiCard
          label="$ / gal"
          value={
            kpi.pricePerGallon == null ? "—" : moneyExact(kpi.pricePerGallon)
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly trend</CardTitle>
          <CardDescription>
            Gallons (bars) and adjusted spend (line) · respects owner and product
            {trendUpdating
              ? trendFromCache
                ? " · local cache · updating…"
                : " · loading history…"
              : trendFromCache
                ? ""
                : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trendError ? (
            <p className="text-destructive text-sm">{trendError}</p>
          ) : null}
          {!trendReady && !trendError ? (
            <p className="text-muted-foreground text-sm">
              Month KPIs ready · loading the 12-month chart…
            </p>
          ) : null}
          {trendReady &&
          monthlyTrend.every((point) => point.gallons === 0 && point.spend === 0) ? (
            <Empty className="border-0 py-6">
              <EmptyHeader>
                <EmptyTitle>No data in this window</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : null}
          {trendReady &&
          !monthlyTrend.every((point) => point.gallons === 0 && point.spend === 0) ? (
            <DieselMonthlyTrendChart data={monthlyTrend} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By owner</CardTitle>
          <CardDescription>
            Historical fuel.owner attribution · {monthLabel(month)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Gallons</TableHead>
                  <TableHead className="text-right">Adj. spend</TableHead>
                  <TableHead className="text-right">Tx</TableHead>
                  <TableHead className="text-right">Camiones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byOwner.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <Empty className="border-0 py-8">
                        <EmptyHeader>
                          <EmptyTitle>No rows</EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  byOwner.map((row) => (
                    <TableRow key={row.owner}>
                      <TableCell>{row.owner}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {num(row.gallons)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {moneyExact(row.spend)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.transactions}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.trucks}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transacciones</CardTitle>
          <CardDescription>
            Focus-month detail · up to 400 rows
            {detailMeta.loading ? " · loading…" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detailMeta.error ? (
            <p className="text-destructive mb-3 text-sm">{detailMeta.error}</p>
          ) : null}
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Date</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Gallons</TableHead>
                  <TableHead className="text-right">Adj. SubTotal</TableHead>
                  <TableHead className="text-right">$/gal</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDetail.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="p-0">
                      <Empty className="border-0 py-8">
                        <EmptyHeader>
                          <EmptyTitle>
                            {detailMeta.loading ? "Loading…" : "No rows"}
                          </EmptyTitle>
                          {detailMeta.loading ? (
                            <EmptyDescription>
                              Fetching transactions for this month
                            </EmptyDescription>
                          ) : null}
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDetail.map((row, index) => (
                    <TableRow key={`${row.id}-${row.storeDate}-${row.unit}-${index}`}>
                      <TableCell className="font-mono tabular-nums">
                        {row.storeDate || "—"}
                      </TableCell>
                      <TableCell>
                        {row.unit ? (
                          <Badge variant="secondary">{row.unit}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{row.owner || "—"}</TableCell>
                      <TableCell className="max-w-48 truncate">
                        {row.product || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.gallons == null ? "—" : num(row.gallons)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.adjustedSubTotal == null
                          ? "—"
                          : moneyExact(row.adjustedSubTotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.pricePerGallon == null
                          ? "—"
                          : moneyExact(row.pricePerGallon)}
                      </TableCell>
                      <TableCell>{row.city || "—"}</TableCell>
                      <TableCell>{row.state || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            Showing {filteredDetail.length}
            {detailMeta.truncated || detailMeta.total > filteredDetail.length
              ? ` (month has ${detailMeta.total} tx; table capped)`
              : ""}{" "}
            · KPIs use the full month aggregate, not only these rows
          </p>
        </CardContent>
      </Card>

      <footer className="text-muted-foreground flex flex-col gap-2 text-sm">
        <p>
          Diesel uses live fuel transactions. Owner is historical on the
          transaction, not the current trucks master.
        </p>
        <details>
          <summary className="cursor-pointer text-foreground">Technical details</summary>
          <div className="mt-3 flex flex-col gap-2">
            <p>
              Dataset: <strong>{data.meta.dataset}</strong> · total_count=
              <strong>{data.meta.total_count}</strong> · fetched=
              <strong>{data.meta.fetched_count}</strong> · pagination_complete=
              <strong>{String(data.meta.pagination_complete)}</strong> · live=
              <strong>{String(Boolean(data.meta.live))}</strong> · distinct_trucks
              (ventana)=<strong>{data.meta.distinct_trucks}</strong>.
            </p>
            <p>
              UI filters: mes=<strong>{month}</strong>, owner=
              <strong>{owner}</strong>, product=<strong>{product}</strong>,
              search=&quot;{truckQuery}&quot;.
            </p>
            <p>
              as_of=<strong>{data.meta.as_of}</strong> · source_freshness=
              <strong>{data.meta.source_freshness}</strong>.
            </p>
            <p>
              Caveats: first paint = focus month (Next/Vercel data cache{" "}
              {DIESEL_MONTH_REVALIDATE_SECONDS}s). 12-month trend = data cache{" "}
              {DIESEL_TREND_REVALIDATE_SECONDS}s + CDN s-maxage + sessionStorage
              stale-while-revalidate in this browser. Does not invent rows: only
              reuses recent live agent-reporting queries. Detail table capped at
              400 rows. Default product = diesel excluding DEF.
            </p>
          </div>
        </details>
      </footer>
    </DashboardShell>
  )
}
