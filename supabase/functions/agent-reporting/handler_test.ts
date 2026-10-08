import { SCHEDULE_URL } from "./live_departures.ts";
function assert(v: unknown, message = "assertion failed"): asserts v {
  if (!v) throw new Error(message);
}
Deno.test("live-report HTTP path enforces auth/audit/pagination and preserves aggregate semantics", async () => {
  const serve = Deno.serve;
  const fetchOriginal = globalThis.fetch;
  const envGet = Deno.env.get;
  const envObject = Deno.env.toObject;
  const env: Record<string, string> = {
    SUPABASE_URL: "https://test.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "test-internal-only",
    AGENT_API_KEY: "test-unrestricted",
    AGENT_API_KEY_2: "test-restricted",
    AGENT_REPORTS_2: "departures,out_schedule",
    AGENT_ALLOW_SENSITIVE_2: "false",
    AGENT_API_KEY_3: "test-no-pii",
    AGENT_ALLOW_SENSITIVE_3: "false",
    AGENT_API_KEY_4: "test-empty",
    AGENT_REPORTS_4: "",
    AGENT_API_KEY_5: "test-expired",
    AGENT_EXPIRES_AT_5: "2000-01-01T00:00:00Z",
    AGENT_API_KEY_6: "test-missing-schedule",
    AGENT_REPORTS_6: "departures,driver_pay",
    AGENT_API_KEY_7: "test-missing-aggregate",
    AGENT_REPORTS_7: "driver_pay,out_schedule",
  };
  let handler: ((r: Request) => Response | Promise<Response>) | undefined;
  let scheduleDown = false,
    dpDown = false,
    auditDown = false,
    scheduleEmpty = false;
  let scheduleCalls = 0, dpCalls = 0;
  const audits: Record<string, any>[] = [];
  const dp = [{ ID: 1, Truck_Number: "12", "Out Date": "2026-10-05" }, {
    ID: 2,
    Truck_Number: "12",
    "Out Date": "2026-10-06",
  }, { ID: 3, Truck_Number: "13", "Out Date": "2026-10-11" }];
  try {
    Deno.env.get = (key: string) => env[key];
    Deno.env.toObject = () => env;
    Deno.serve = ((h: typeof handler) => {
      handler = h;
      return {} as Deno.HttpServer;
    }) as typeof Deno.serve;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      if (url === SCHEDULE_URL) {
        scheduleCalls++;
        assert(
          !headers.has("apikey") && !headers.has("authorization") &&
            !headers.has("x-agent-key"),
          "credential leak",
        );
        assert(init?.redirect === "error" && init.credentials === "omit");
        if (scheduleDown) return new Response("down", { status: 503 });
        return Response.json(
          scheduleEmpty ? [] : [
            {
              Truck: 12,
              "Out Date": "2026-10-05",
              "Team": "names",
              "Driver 1": "name",
              Driver_1_DriversDB_Id: 99,
            },
            { Truck: 14, "Out Date": "2026-10-11" },
            { Truck: 99, "Out Date": "2026-10-12" },
          ],
        );
      }
      assert(url.startsWith("https://test.invalid/rest/v1/"), "unexpected URL");
      assert(headers.get("apikey") === env.SUPABASE_SERVICE_ROLE_KEY);
      if (url.includes("agent_query_audit")) {
        audits.push(JSON.parse(String(init?.body)));
        return auditDown
          ? Response.json({ message: "audit down" }, { status: 500 })
          : new Response(null, { status: 201 });
      }
      if (url.includes("DriverPay")) {
        dpCalls++;
        if (dpDown) {
          return Response.json({ message: "dp down" }, { status: 500 });
        }
        const u = new URL(url);
        const offset = Number(u.searchParams.get("offset") ?? 0);
        assert(u.searchParams.get("select") === 'ID,Truck_Number,"Out Date"');
        assert(
          u.searchParams.getAll("Out Date").join(",") ===
            "gte.2026-10-05,lte.2026-10-11",
        );
        assert(u.searchParams.get("order")?.includes("ID.asc"));
        assert(
          !url.includes("Return") && !url.includes("Termination") &&
            !url.includes("Transfer") && !url.includes("Solo"),
        );
        return Response.json(dp.slice(offset, offset + 1), {
          headers: { "content-range": `${offset}-${offset}/3` },
        });
      }
      throw new Error("Unexpected REST path");
    };
    await import("./index.ts");
    assert(handler);
    const request = async (query: string, key = "test-unrestricted") => {
      const response = await handler!(
        new Request(`https://gateway.invalid/?${query}`, {
          headers: { "x-agent-key": key },
        }),
      );
      return { status: response.status, body: await response.json() };
    };
    const window = "out_from=2026-10-05&out_to=2026-10-11";
    const catalog = await request("report=catalog");
    assert(
      catalog.body.schema_version === "3.8.3" &&
        catalog.body.reports.departures && catalog.body.reports.out_schedule,
    );
    assert(catalog.body.guidance.off_duty_trucks.source_url === "https://lightningtransport.ninoxdb.com/share/jx7z6tkjcnxalvsui4icdnqjuszia04etdhi?locale=en&utcoffset=-240", "authenticated catalog omits approved off-duty feed");
    const onRoadText = JSON.stringify(catalog.body.guidance.on_road_trucks);
    assert(onRoadText.includes("https://lightningtransport.ninoxdb.com/share/eno5u22ebn2qdn215dpzwn02squ5wsixob8f?locale=en&utcoffset=-240"), "catalog omits current working source");
    assert(onRoadText.includes("historical") && onRoadText.includes("unknown/null") && onRoadText.includes("GPS"), "catalog loses semantic/failure boundaries");
    assert(!Object.keys(catalog.body.reports).includes("on_road_trucks"), "external share falsely claimed as a gateway report");
    const driverPayMetadata = await request("report=driver_pay&metadata=true");
    assert(driverPayMetadata.status === 200 && driverPayMetadata.body.filters.on_road_at.includes("Historical or explicit-date"));
    assert(JSON.stringify(driverPayMetadata.body.do_not_use_for).includes("current operational"));
    const truckMetadata = await request("report=trucks&metadata=true");
    assert(truckMetadata.body.guidance.on_road_trucks && JSON.stringify(truckMetadata.body.do_not_use_for).includes("current working"));
    assert(truckMetadata.status === 200 && truckMetadata.body.guidance.off_duty_trucks, "report metadata omits off-duty routing");
    const compactCatalog = await request("report=catalog&compact=true");
    assert(compactCatalog.status === 200, "compact catalog should be supported");
    assert(compactCatalog.body.metadata_required === true);
    assert(JSON.stringify(compactCatalog.body.principal) === JSON.stringify(catalog.body.principal));
    assert(JSON.stringify(compactCatalog.body.guidance) === JSON.stringify(catalog.body.guidance));
    assert(JSON.stringify(Object.keys(compactCatalog.body.reports)) === JSON.stringify(Object.keys(catalog.body.reports)));
    for (const [name, full] of Object.entries(catalog.body.reports) as [string, any][]) {
      const brief = compactCatalog.body.reports[name];
      assert(brief.source === full.source && brief.row_grain === full.row_grain);
      assert(JSON.stringify(brief.filters) === JSON.stringify(full.filters));
      assert(brief.required_anchor === full.required_anchor);
      assert(brief.metadata_url === `?report=${name}&metadata=true`);
      assert(!("fields" in brief) && !("calculation_rules" in brief));
    }
    assert(JSON.stringify(compactCatalog.body).length < JSON.stringify(catalog.body).length / 2);
    assert(JSON.stringify((await request("report=catalog&compact=false")).body) === JSON.stringify(catalog.body));
    for (const suffix of ["compact=1", "compact=TRUE", "compact=", "compact=true&compact=false", "unknown=true"]) {
      assert((await request(`report=catalog&${suffix}`)).status === 400);
    }
    assert((await request("report=catalog&compact=true", "wrong")).status === 401);
    assert((await request("report=catalog&compact=true", "test-expired")).status === 401);
    const emptyCatalog = await request("report=catalog&compact=true", "test-empty");
    assert(emptyCatalog.status === 200 && Object.keys(emptyCatalog.body.reports).length === 0);
    assert(emptyCatalog.body.principal.allowed_reports.length === 0);
    for (const key of ["test-restricted", "test-missing-schedule", "test-missing-aggregate"]) {
      const brief = await request("report=catalog&compact=true", key);
      assert(!brief.body.reports.departures);
      assert((await request("report=departures&metadata=true", key)).status === 403);
      assert((await request("report=departures", key)).status === 403);
    }
    const compactRestricted = await request("report=catalog&compact=true", "test-restricted");
    assert(!compactRestricted.body.reports.departures && compactRestricted.body.reports.out_schedule);
    for (const report of Object.keys(catalog.body.reports)) {
      assert((await request(`report=${report}&compact=true`)).status === 400);
      assert((await request(`report=${report}&metadata=true&compact=true`)).status === 400);
    }
    assert(dpCalls === 0 && scheduleCalls === 0);
    const restrictedCatalog = await request(
      "report=catalog",
      "test-restricted",
    );
    assert(
      !restrictedCatalog.body.reports.departures &&
        restrictedCatalog.body.reports.out_schedule,
    );
    assert(
      (await request("report=departures", "test-restricted")).status === 403,
    );
    assert(dpCalls === 0 && scheduleCalls === 0);
    assert(
      (await request(
        `report=out_schedule&${window}&include_sensitive=true`,
        "test-no-pii",
      )).status === 403,
    );
    assert(
      (await request("report=departures&out_from=2026-10-05")).status === 400,
    );
    assert(
      (await request(`report=departures&${window}`, "wrong")).status === 401,
    );
    const result = await request(`report=departures&${window}&limit=1`);
    assert(
      result.status === 200 && result.body.complete &&
        result.body.status === "complete",
    );
    assert(
      result.body.reconciliation.combined_distinct_total === 3 &&
        result.body.reconciliation.overlap_count === 1,
    );
    assert(
      JSON.stringify(result.body.truck_sets.combined) === '["12","13","14"]',
    );
    assert(
      result.body.count === 1 && result.body.page_count === 1 &&
        result.body.total_count === 1 && result.body.has_more === false &&
        result.body.next_offset === null,
    );
    assert(
      result.body.data.length === 1 &&
        result.body.data[0].reconciliation.combined_distinct_total === 3,
    );
    assert(Number(dpCalls) === 3);
    assert(
      audits.at(-1)?.filters.applied_filters.out_from === "2026-10-05" &&
        audits.at(-1)?.outcome === "success",
    );
    const schedule = await request(`report=out_schedule&${window}&limit=1`);
    assert(
      schedule.body.count === 1 && schedule.body.total_count === 2 &&
        schedule.body.next_offset === 1 && schedule.body.has_more,
    );
    assert(
      !("Team" in schedule.body.data[0]) &&
        !("Driver 1" in schedule.body.data[0]),
    );
    const full = await request(
      `report=out_schedule&${window}&include_sensitive=true`,
    );
    assert(
      full.body.data[0]["Driver 1"] === "name" &&
        !("Driver_1_DriversDB_Id" in full.body.data[0]),
    );
    assert(
      (await request(`report=departures&${window}&offset=1`)).status === 416,
    );
    assert(
      (await request(`report=out_schedule&${window}&offset=2`)).status === 416,
    );
    scheduleDown = true;
    const incomplete = await request(`report=departures&${window}`);
    assert(
      incomplete.status === 503 && incomplete.body.complete === false &&
        incomplete.body.status === "incomplete",
    );
    assert(
      incomplete.body.reconciliation.driver_pay_count === 2 &&
        incomplete.body.reconciliation.combined_distinct_total === null &&
        incomplete.body.truck_sets.combined === null,
    );
    assert(
      incomplete.body.data[0].reconciliation.combined_distinct_total === null &&
        audits.at(-1)?.outcome === "invalid",
    );
    assert((await request(`report=out_schedule&${window}`)).status === 503);
    scheduleDown = false;
    dpDown = true;
    const dpFailure = await request(`report=departures&${window}`);
    assert(
      dpFailure.status === 503 &&
        dpFailure.body.reconciliation.driver_pay_count === null &&
        dpFailure.body.reconciliation.schedule_teams_count === 2 &&
        dpFailure.body.reconciliation.combined_distinct_total === null,
    );
    dpDown = false;
    scheduleEmpty = true;
    const empty = await request(`report=out_schedule&${window}`);
    assert(
      empty.status === 200 && empty.body.complete &&
        empty.body.total_count === 0 && empty.body.data.length === 0,
    );
    auditDown = true;
    assert((await request(`report=departures&${window}`)).status === 500);
  } finally {
    Deno.serve = serve;
    globalThis.fetch = fetchOriginal;
    Deno.env.get = envGet;
    Deno.env.toObject = envObject;
  }
});
