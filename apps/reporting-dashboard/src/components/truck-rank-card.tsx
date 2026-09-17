"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { money } from "@/lib/format"
import { TRUCK_RANK_PREVIEW, type TruckAgg } from "@/lib/settlement"

const RANK_HEADERS = ["#", "Truck", "Team", "Gross", "Net"] as const

export function TruckRankCard({
  title,
  description,
  trucks,
  primary,
}: {
  title: string
  description: string
  trucks: TruckAgg[]
  primary: "g" | "n"
}) {
  const preview = trucks.slice(0, TRUCK_RANK_PREVIEW)
  const sortLabel = primary === "g" ? "Gross" : "Net"

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Sorted by {sortLabel} · {description} · {trucks.length} trucks in selection
          </CardDescription>
        </div>
        <TruckListDialog title={title} trucks={trucks} primary={primary} />
      </CardHeader>
      <CardContent>
        <RankBody trucks={preview} primary={primary} startAt={1} />
      </CardContent>
    </Card>
  )
}

function TruckListDialog({
  title,
  trucks,
  primary,
}: {
  title: string
  trucks: TruckAgg[]
  primary: "g" | "n"
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return trucks
    return trucks.filter(
      (truck) =>
        truck.t.toLowerCase().includes(needle) ||
        truck.o.toLowerCase().includes(needle)
    )
  }, [query, trucks])
  const sortLabel = primary === "g" ? "Gross" : "Net"

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Show all
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Full selection ({trucks.length}), sorted by {sortLabel}.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="search"
          value={query}
          placeholder="Search truck or team"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-[60vh] overflow-auto rounded-lg border">
          <RankBody trucks={filtered} primary={primary} startAt={1} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RankBody({
  trucks,
  primary,
  startAt,
}: {
  trucks: TruckAgg[]
  primary: "g" | "n"
  startAt: number
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {RANK_HEADERS.map((header) => (
            <TableHead
              key={header}
              className={
                header === "Gross" || header === "Net" ? "text-right" : undefined
              }
            >
              <span
                className={
                  (primary === "g" && header === "Gross") ||
                  (primary === "n" && header === "Net")
                    ? "font-semibold"
                    : undefined
                }
              >
                {header}
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {trucks.length === 0 ? (
          <TableRow>
            <TableCell colSpan={RANK_HEADERS.length} className="text-muted-foreground">
              No data
            </TableCell>
          </TableRow>
        ) : (
          trucks.map((truck, index) => (
            <TableRow key={`${primary}-${truck.t}-${index}`}>
              <TableCell>{startAt + index}</TableCell>
              <TableCell>
                {truck.t}
                {truck.np ? (
                  <>
                    {" "}
                    <Badge variant="outline">Non-physical</Badge>
                  </>
                ) : null}
              </TableCell>
              <TableCell>{truck.o}</TableCell>
              <TableCell
                className={`text-right font-mono tabular-nums${
                  primary === "g" ? " font-medium" : ""
                }`}
              >
                {money(truck.g)}
              </TableCell>
              <TableCell
                className={`text-right font-mono tabular-nums${
                  primary === "n" ? " font-medium" : ""
                }`}
              >
                {money(truck.n)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
