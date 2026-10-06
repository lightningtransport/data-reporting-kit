export type Period = { out_from: string; out_to: string; time_zone: string };
export const SCHEDULE_URL =
  "https://lightningtransport.ninoxdb.com/share/p10ce94o8paa2q4a1z4nw0emznn2ubhriza6?locale=en&utcoffset=-240";
export const MAX_SOURCE_ROWS = 50000;
export const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15000;
export type Row = Record<string, unknown>;
export const SCHEDULE_FIELDS = [
  "Truck",
  "Out Date",
  "Owner",
  "Dispatch",
  "Flatbed",
  "solo",
] as const;
export const SCHEDULE_SENSITIVE_FIELDS = [
  "Team",
  "Driver 1",
  "Driver 2",
] as const;

function realDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}
function checkedRows(value: unknown): Row[] {
  if (!Array.isArray(value) || value.length > MAX_SOURCE_ROWS) {
    throw new Error("Invalid source rows");
  }
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Invalid source row");
    }
    const date = row["Out Date"];
    if (date !== null && date !== undefined && date !== "" && !realDate(date)) {
      throw new Error("Invalid source date");
    }
  }
  return value;
}
async function bounded<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Source timeout"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
export async function fetchSchedule(
  fetcher: typeof fetch = fetch,
  timeoutMs = TIMEOUT_MS,
): Promise<Row[]> {
  return await bounded(async (signal) => {
    const response = await fetcher(SCHEDULE_URL, {
      method: "GET",
      redirect: "error",
      credentials: "omit",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Schedule upstream failed");
    }
    const declared = response.headers.get("content-length");
    if (
      declared !== null &&
      (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)
    ) {
      await response.body?.cancel();
      throw new Error("Schedule payload exceeds bound");
    }
    if (!response.body) throw new Error("Missing schedule payload");
    const reader = response.body.getReader();
    const abort = () => {
      void reader.cancel().catch(() => {});
    };
    signal.addEventListener("abort", abort, { once: true });
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) {
          throw new Error("Schedule payload exceeds bound");
        }
        chunks.push(value);
      }
    } finally {
      signal.removeEventListener("abort", abort);
      await reader.cancel();
      reader.releaseLock();
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    const rows = checkedRows(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)),
    );
    for (const row of rows) {
      if (!Object.hasOwn(row, "Truck") || !Object.hasOwn(row, "Out Date")) {
        throw new Error("Schedule schema changed");
      }
      for (const key of [...SCHEDULE_FIELDS, ...SCHEDULE_SENSITIVE_FIELDS]) {
        const value = row[key];
        if (
          value !== null && value !== undefined &&
          !["string", "number", "boolean"].includes(typeof value)
        ) throw new Error("Invalid schedule field");
      }
      if (
        row.Truck !== null && typeof row.Truck !== "string" &&
        typeof row.Truck !== "number"
      ) throw new Error("Invalid schedule truck");
    }
    return rows;
  }, timeoutMs);
}
export function projectSchedule(rows: Row[], includeSensitive: boolean): Row[] {
  const fields = [
    ...SCHEDULE_FIELDS,
    ...(includeSensitive ? SCHEDULE_SENSITIVE_FIELDS : []),
  ];
  return rows.map((row) =>
    Object.fromEntries(
      fields.filter((key) => Object.hasOwn(row, key)).map(
        (key) => [key, row[key]],
      ),
    )
  );
}
export type DriverPayPage = {
  data: unknown;
  count: number | null;
  error: unknown;
};
export type DriverPayLoader = (
  offset: number,
  limit: number,
  signal: AbortSignal,
) => PromiseLike<DriverPayPage>;
export async function fetchDriverPay(
  loader: DriverPayLoader,
  period: Period,
  timeoutMs = TIMEOUT_MS,
): Promise<Row[]> {
  return await bounded(async (signal) => {
    const rows: Row[] = [];
    const ids = new Set<string>();
    let total: number | undefined;
    let bytes = 0;
    do {
      const page = await loader(rows.length, 1000, signal);
      if (
        page.error || !Number.isSafeInteger(page.count) ||
        page.count === null || page.count < 0 || page.count > MAX_SOURCE_ROWS
      ) throw new Error("DriverPay page failed");
      if (total !== undefined && total !== page.count) {
        throw new Error("DriverPay count changed");
      }
      total = page.count;
      const batch = checkedRows(page.data);
      if (
        batch.length > 1000 || rows.length + batch.length > total ||
        (!batch.length && rows.length < total)
      ) throw new Error("Incomplete DriverPay pagination");
      bytes += new TextEncoder().encode(JSON.stringify(batch)).length;
      if (bytes > MAX_BYTES) throw new Error("DriverPay payload exceeds bound");
      for (const row of batch) {
        const id = row.ID;
        if (
          (typeof id !== "number" && typeof id !== "string") ||
          !String(id).trim() ||
          (typeof id === "number" && !Number.isFinite(id)) ||
          ids.has(String(id))
        ) throw new Error("Invalid or repeated DriverPay identity");
        if (!inPeriod(row, period)) {
          throw new Error("DriverPay row outside requested period");
        }
        ids.add(String(id));
        rows.push(row);
      }
    } while (rows.length < total);
    return rows;
  }, timeoutMs);
}
export function truckKey(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const key = String(value).trim();
  if (!key || (typeof value === "number" && !Number.isFinite(value))) {
    return null;
  }
  if (/^\d+(?:\.0+)?$/.test(key)) {
    return key.split(".")[0].replace(/^0+(?=\d)/, "");
  }
  return key;
}
export function inPeriod(row: Row, period: Period): boolean {
  const date = row["Out Date"];
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    date >= period.out_from && date <= period.out_to;
}
function trucks(rows: Row[], column: string, period: Period): string[] {
  return [
    ...new Set(
      rows.filter((r) => inPeriod(r, period)).map((r) => truckKey(r[column]))
        .filter((k): k is string => k !== null),
    ),
  ].sort();
}
export function reconcileDepartures(
  dp: Row[] | null,
  schedule: Row[] | null,
  period: Period,
) {
  const d = dp === null ? null : trucks(dp, "Truck_Number", period);
  const s = schedule === null ? null : trucks(schedule, "Truck", period);
  const complete = d !== null && s !== null;
  const dSet = new Set(d ?? []), sSet = new Set(s ?? []);
  const overlap = complete ? d.filter((k) => sSet.has(k)) : null;
  const driver_pay_only = complete ? d.filter((k) => !sSet.has(k)) : null;
  const schedule_teams_only = complete ? s.filter((k) => !dSet.has(k)) : null;
  const combined = complete ? [...new Set([...d, ...s])].sort() : null;
  return {
    status: complete ? "complete" : "incomplete",
    complete,
    period,
    reconciliation: {
      driver_pay_count: d?.length ?? null,
      schedule_teams_count: s?.length ?? null,
      driver_pay_only_count: driver_pay_only?.length ?? null,
      schedule_teams_only_count: schedule_teams_only?.length ?? null,
      overlap_count: overlap?.length ?? null,
      combined_distinct_total: combined?.length ?? null,
    },
    truck_sets: {
      driver_pay: d,
      schedule_teams: s,
      driver_pay_only,
      schedule_teams_only,
      overlap,
      combined,
    },
  };
}

export function departurePeriod(
  params: URLSearchParams,
  now = new Date(),
): Period {
  const time_zone = "America/New_York";
  if (params.has("out_from") && params.has("out_to")) {
    return {
      out_from: params.get("out_from")!,
      out_to: params.get("out_to")!,
      time_zone,
    };
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: time_zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (name: string) => parts.find((p) => p.type === name)!.value;
  const monday = new Date(
    `${value("year")}-${value("month")}-${value("day")}T00:00:00Z`,
  );
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return {
    out_from: monday.toISOString().slice(0, 10),
    out_to: sunday.toISOString().slice(0, 10),
    time_zone,
  };
}
