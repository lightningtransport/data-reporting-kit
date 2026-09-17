/** Shared date display and truck-grain helpers for Out Schedule / Trucks Return. */

export function formatOpsDate(iso: string, emptyLabel = "—"): string {
  if (!iso) return emptyLabel
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [, month, day] = iso.split("-")
  return `${month}/${day}/${iso.slice(0, 4)}`
}

export function weekdayFromIso(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ""
  const date = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(date)
}

/** Monday (inclusive) of the UTC week containing `iso` (YYYY-MM-DD). */
export function mondayOfWeek(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ""
  const date = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return ""
  const day = date.getUTCDay() // 0 Sun … 6 Sat
  const offset = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function addDaysIso(iso: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ""
  const date = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return ""
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function sundayOfWeek(monday: string): string {
  return addDaysIso(monday, 6)
}

/** Short range label e.g. "Sep 14–20". */
export function weekRangeLabel(monday: string): string {
  const sunday = sundayOfWeek(monday)
  if (!monday || !sunday) return ""
  const from = new Date(`${monday}T12:00:00Z`)
  const to = new Date(`${sunday}T12:00:00Z`)
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
  const a = fmt.format(from)
  const bDay = to.getUTCDate()
  return `${a}–${bDay}`
}

export function isoInWeek(iso: string, monday: string): boolean {
  if (!iso || !monday) return false
  const sunday = sundayOfWeek(monday)
  return iso >= monday && iso <= sunday
}

/** Unique Monday ISO strings present in `dates`, sorted ascending. Empty dates ignored. */
export function availableMondays(dates: string[]): string[] {
  const set = new Set<string>()
  for (const iso of dates) {
    if (!iso) continue
    const monday = mondayOfWeek(iso)
    if (monday) set.add(monday)
  }
  return [...set].sort()
}

export function currentMonday(todayIso?: string): string {
  const today =
    todayIso && /^\d{4}-\d{2}-\d{2}$/.test(todayIso)
      ? todayIso
      : new Date().toISOString().slice(0, 10)
  return mondayOfWeek(today)
}

/**
 * Default focus Monday: current week if it has data or no weeks exist;
 * otherwise nearest available Monday (prefer upcoming, else latest past).
 */
export function defaultFocusMonday(mondays: string[], todayIso?: string): string {
  const current = currentMonday(todayIso)
  if (mondays.length === 0) return current
  if (mondays.includes(current)) return current
  const upcoming = mondays.find((m) => m >= current)
  if (upcoming) return upcoming
  return mondays[mondays.length - 1] ?? current
}

export function shiftFocusMonday(
  focusMonday: string,
  mondays: string[],
  direction: -1 | 1
): string {
  if (mondays.length === 0) return focusMonday
  const idx = mondays.indexOf(focusMonday)
  if (idx < 0) {
    if (direction < 0) {
      const past = [...mondays].reverse().find((m) => m < focusMonday)
      return past ?? mondays[0] ?? focusMonday
    }
    const next = mondays.find((m) => m > focusMonday)
    return next ?? mondays[mondays.length - 1] ?? focusMonday
  }
  return mondays[idx + direction] ?? focusMonday
}

export type CollapsibleDriverRow = {
  truck: string
  eventDate: string
  drivers: string[]
  fields: Record<string, string>
}

export type CollapsedTruckRow = {
  truck: string
  eventDate: string
  day: string
  driver1: string
  driver2: string
  solo: string
  fields: Record<string, string>
  sourceRowCount: number
  extraDrivers: boolean
}

function joinDistinct(values: string[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = raw.trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out.join(" / ")
}

function uniqueDrivers(names: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    const value = raw.trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

/** Collapse driver-grain rows to one row per truck + event date. */
export function collapseTruckRows(rows: CollapsibleDriverRow[]): CollapsedTruckRow[] {
  const groups = new Map<
    string,
    {
      truck: string
      eventDate: string
      drivers: string[]
      fieldBags: Record<string, string[]>
      sourceRowCount: number
    }
  >()

  for (const row of rows) {
    const truck = row.truck.trim()
    if (!truck) continue
    const eventDate = row.eventDate.trim()
    const key = `${truck}\0${eventDate}`
    let group = groups.get(key)
    if (!group) {
      group = {
        truck,
        eventDate,
        drivers: [],
        fieldBags: {},
        sourceRowCount: 0,
      }
      groups.set(key, group)
    }
    group.sourceRowCount += 1
    group.drivers.push(...row.drivers)
    for (const [field, value] of Object.entries(row.fields)) {
      if (!group.fieldBags[field]) group.fieldBags[field] = []
      group.fieldBags[field].push(value)
    }
  }

  const collapsed: CollapsedTruckRow[] = []
  for (const group of groups.values()) {
    const drivers = uniqueDrivers(group.drivers)
    const fields: Record<string, string> = {}
    for (const [field, values] of Object.entries(group.fieldBags)) {
      fields[field] = joinDistinct(values)
    }
    const driver1 = drivers[0] ?? ""
    const rest = drivers.slice(1)
    const driver2 = rest.length ? rest.join(" / ") : ""
    collapsed.push({
      truck: group.truck,
      eventDate: group.eventDate,
      day: group.eventDate ? weekdayFromIso(group.eventDate) : "",
      driver1,
      driver2,
      solo: drivers.length === 1 ? "Yes" : "—",
      fields,
      sourceRowCount: group.sourceRowCount,
      extraDrivers: drivers.length > 2,
    })
  }

  return collapsed.sort(
    (a, b) =>
      (a.eventDate || "9999-99-99").localeCompare(b.eventDate || "9999-99-99") ||
      a.truck.localeCompare(b.truck)
  )
}

export function distinctTrucksInWeek(
  rows: CollapsedTruckRow[],
  monday: string
): number {
  const trucks = new Set<string>()
  for (const row of rows) {
    if (!row.eventDate) continue
    if (isoInWeek(row.eventDate, monday)) trucks.add(row.truck)
  }
  return trucks.size
}

export function distinctUndatedTrucks(rows: CollapsedTruckRow[]): number {
  return new Set(rows.filter((row) => !row.eventDate).map((row) => row.truck)).size
}
