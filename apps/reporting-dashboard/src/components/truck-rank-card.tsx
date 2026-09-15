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
  const headers =
    primary === "g"
      ? ["#", "Camión", "Owner", "Gross", "Net"]
      : ["#", "Camión", "Owner", "Net", "Gross"]

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {description} · {trucks.length} camiones en la selección
          </CardDescription>
        </div>
        <TruckListDialog title={title} trucks={trucks} primary={primary} />
      </CardHeader>
      <CardContent>
        <RankBody headers={headers} trucks={preview} primary={primary} startAt={1} />
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
  const headers =
    primary === "g"
      ? ["#", "Camión", "Owner", "Gross", "Net"]
      : ["#", "Camión", "Owner", "Net", "Gross"]

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Ver más
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Lista completa de la selección ({trucks.length}), no un recorte.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="search"
          value={query}
          placeholder="Buscar camión u owner"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-[60vh] overflow-auto rounded-lg border">
          <RankBody headers={headers} trucks={filtered} primary={primary} startAt={1} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RankBody({
  headers,
  trucks,
  primary,
  startAt,
}: {
  headers: string[]
  trucks: TruckAgg[]
  primary: "g" | "n"
  startAt: number
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((header) => (
            <TableHead key={header}>{header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {trucks.length === 0 ? (
          <TableRow>
            <TableCell colSpan={headers.length} className="text-muted-foreground">
              Sin datos
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
                    <Badge variant="outline">bucket</Badge>
                  </>
                ) : null}
              </TableCell>
              <TableCell>{truck.o}</TableCell>
              {primary === "g" ? (
                <>
                  <TableCell className="text-right font-mono tabular-nums">
                    {money(truck.g)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {money(truck.n)}
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-right font-mono tabular-nums">
                    {money(truck.n)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {money(truck.g)}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
