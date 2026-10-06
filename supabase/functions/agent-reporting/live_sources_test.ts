import {
  fetchDriverPay,
  fetchSchedule,
  MAX_BYTES,
  MAX_SOURCE_ROWS,
  projectSchedule,
  SCHEDULE_URL,
} from "./live_departures.ts";
function assert(v: unknown) {
  if (!v) throw new Error("assertion failed");
}
async function rejects(f: () => Promise<unknown>) {
  try {
    await f();
  } catch {
    return;
  }
  throw new Error("must reject");
}
Deno.test("bounded schedule fetch exact URL no credentials no redirects; sensitive optin and ID omission", async () => {
  const rows = await fetchSchedule(async (input, init) => {
    assert(input === SCHEDULE_URL);
    assert(init?.redirect === "error" && init?.credentials === "omit");
    const h = new Headers(init?.headers);
    assert(
      !h.has("authorization") && !h.has("apikey") && !h.has("x-agent-key"),
    );
    return Response.json([{
      Truck: 12,
      "Out Date": "2026-10-05",
      "Team": "A / B",
      "Driver 1": "A",
      "Driver 2": "B",
      Driver_1_DriversDB_Id: 4,
      secret: "hidden",
    }]);
  });
  const safe = projectSchedule(rows, false);
  assert(!("Team" in safe[0]) && !("Driver 1" in safe[0]));
  const full = projectSchedule(rows, true);
  assert(
    full[0]["Driver 1"] === "A" && !("Driver_1_DriversDB_Id" in full[0]) &&
      !("secret" in full[0]),
  );
});
Deno.test("schedule failure malformed JSON wrong shape invalid date oversize row bound fail closed", async () => {
  for (
    const response of [
      new Response("down", { status: 503 }),
      new Response("{bad"),
      Response.json({ data: [] }),
      Response.json([null]),
      Response.json([{ Truck: 12, "Out Date": "2026-02-30" }]),
      new Response("[]", {
        headers: { "content-length": String(MAX_BYTES + 1) },
      }),
      Response.json(
        Array(MAX_SOURCE_ROWS + 1).fill({ Truck: 1, "Out Date": "2026-10-05" }),
      ),
      new Response(" ".repeat(MAX_BYTES + 1)),
    ]
  ) await rejects(() => fetchSchedule(async () => response));
  await rejects(() =>
    fetchSchedule(async () => {
      throw new Error("network");
    })
  );
  assert((await fetchSchedule(async () => Response.json([]))).length === 0);
});
Deno.test("DriverPay pagination follows exact total even short server pages; rejects repeated pages/count drift", async () => {
  const p = {
    out_from: "2026-10-05",
    out_to: "2026-10-11",
    time_zone: "America/New_York",
  };
  const offsets: number[] = [];
  const rows = await fetchDriverPay(async (offset) => {
    offsets.push(offset);
    return {
      data: [{
        ID: offset + 1,
        Truck_Number: String(offset + 1),
        "Out Date": "2026-10-05",
      }],
      count: 3,
      error: null,
    };
  }, p);
  assert(rows.length === 3 && JSON.stringify(offsets) === "[0,1,2]");
  await rejects(() =>
    fetchDriverPay(
      async () => ({
        data: [{ ID: 1, Truck_Number: "1", "Out Date": "2026-10-05" }],
        count: 3,
        error: null,
      }),
      p,
    )
  );
  await rejects(() =>
    fetchDriverPay(async () => ({ data: [], count: 1, error: null }), p)
  );
  await rejects(() =>
    fetchDriverPay(async () => ({ data: [], count: null, error: null }), p)
  );
  await rejects(() =>
    fetchDriverPay(
      async () => ({ data: null, count: null, error: { message: "down" } }),
      p,
    )
  );
  await rejects(() =>
    fetchDriverPay(
      async (offset) => ({
        data: [{ ID: offset + 1, Truck_Number: "1", "Out Date": "2026-10-05" }],
        count: offset ? 3 : 2,
        error: null,
      }),
      p,
    )
  );
  assert(
    (await fetchDriverPay(async () => ({ data: [], count: 0, error: null }), p))
      .length === 0,
  );
});
Deno.test("DriverPay rejects unsafe totals, malformed identities, dates and byte overflows", async () => {
  const p = {
    out_from: "2026-10-05",
    out_to: "2026-10-11",
    time_zone: "America/New_York",
  };
  for (const count of [-1, 1.5, MAX_SOURCE_ROWS + 1]) {
    await rejects(() =>
      fetchDriverPay(async () => ({ data: [], count, error: null }), p)
    );
  }
  for (
    const row of [
      { Truck_Number: "12", "Out Date": "2026-10-05" },
      { ID: 1, Truck_Number: "12", "Out Date": "2026-10-12" },
      { ID: 1, Truck_Number: "12", "Out Date": "2026-02-30" },
      { ID: 1, Truck_Number: "x".repeat(MAX_BYTES), "Out Date": "2026-10-05" },
    ]
  ) {
    await rejects(() =>
      fetchDriverPay(async () => ({ data: [row], count: 1, error: null }), p)
    );
  }
  await rejects(() =>
    fetchDriverPay(async () => ({ data: null, count: 0, error: null }), p)
  );
  await rejects(() =>
    fetchDriverPay(async () => {
      throw new Error("network");
    }, p)
  );
});
Deno.test("schedule schema drift cannot silently become zero departures", async () => {
  for (
    const rows of [[{}], [{ Truck: 12 }], [{ "Out Date": "2026-10-05" }], [{
      Truck: { ID: 12 },
      "Out Date": "2026-10-05",
    }], [{ Truck: 12, "Out Date": "2026-10-05", Team: { hidden: "internal" } }]]
  ) await rejects(() => fetchSchedule(async () => Response.json(rows)));
});
Deno.test("schedule cancels failed responses and stalled bodies", async () => {
  let failedCancelled = false;
  const failed = new ReadableStream<Uint8Array>({
    cancel() {
      failedCancelled = true;
    },
  });
  await rejects(() =>
    fetchSchedule(async () => new Response(failed, { status: 503 }))
  );
  assert(failedCancelled);
  let stalledCancelled = false;
  const stalled = new ReadableStream<Uint8Array>({
    cancel() {
      stalledCancelled = true;
    },
  });
  await rejects(() => fetchSchedule(async () => new Response(stalled), 5));
  assert(stalledCancelled);
});
Deno.test("source deadlines abort stalled fetch and pagination; streams enforce actual byte bound", async () => {
  let scheduleSignal: AbortSignal | null | undefined;
  await rejects(() =>
    fetchSchedule((_input, init) => {
      scheduleSignal = init?.signal;
      return new Promise<Response>(() => {});
    }, 5)
  );
  assert(scheduleSignal?.aborted);
  let dpSignal: AbortSignal | undefined;
  const period = {
    out_from: "2026-10-05",
    out_to: "2026-10-11",
    time_zone: "America/New_York",
  };
  await rejects(() =>
    fetchDriverPay(
      (_offset, _limit, signal) => {
        dpSignal = signal;
        return new Promise(() => {});
      },
      period,
      5,
    )
  );
  assert(dpSignal?.aborted);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_BYTES));
      controller.enqueue(new Uint8Array(1));
      controller.close();
    },
  });
  await rejects(() => fetchSchedule(async () => new Response(stream)));
});
