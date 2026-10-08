import { REPORTS, TABLES } from "./metadata.ts";
import { tableSelect } from "./request_logic.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const components = [
  "Otro",
  "LTR Invoices",
  "Tolls",
  "BestPass",
  "CabCards",
  "Trailer Rentals",
  "samsara",
  "PrePass",
] as const;

Deno.test("settlement metadata retains nullable numeric/date types and Supabase row identity", () => {
  const fields = TABLES.settlements.fields;
  for (
    const name of [
      ...components,
      "Gross",
      "tonu",
      "Total Expenses",
      "Net",
      "truck_loans",
      "Insurance",
      "Total Driver Pay",
      "Fuel Expenses",
      "%AppliedSaved",
      "Gross_with_%_deduction_All",
      "Driven_miles",
    ] as const
  ) {
    assert(fields[name].type === "numeric", `${name} must remain numeric`);
    assert(fields[name].nullable === true, `${name} must remain nullable`);
  }
  for (const name of ["From", "To"] as const) {
    assert(fields[name].type === "date", `${name} must remain a date`);
    assert(fields[name].nullable === true, `${name} must remain nullable`);
  }
  assert(
    fields.Truck.type === "text",
    "Truck is an identifier, not a quantity",
  );
  assert(
    fields.ID.type === "bigint" && !fields.ID.nullable,
    "ID is a non-null bigint",
  );
  assert(
    fields.ID.meaning.includes("Supabase identity primary key") &&
      TABLES.settlements.primary_key.includes("Supabase identity"),
    "ID identifies the imported Supabase row, not a Ninox source record",
  );
  assert(
    !("Ninox_ID" in fields),
    "settlements does not expose a Ninox source ID",
  );
  assert(
    REPORTS.settlements.source === "public.settlements",
    "physical source changed",
  );
});

Deno.test("settlement HTTP contract preserves null/zero/negative components, buckets, dates and cursor sequence", async () => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  const originalGet = Deno.env.get;
  const originalToObject = Deno.env.toObject;
  const env: Record<string, string> = {
    SUPABASE_URL: "https://settlement-fixture.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-internal-only",
    AGENT_API_KEY: "synthetic-settlement-agent",
    AGENT_REPORTS: "settlements",
  };
  const owner = "Fixture Owner, LLC";
  const periodFrom = "2026-01-06";
  const periodTo = "2026-01-13";
  type Row = Record<string, unknown>;
  const row = (values: Row): Row => ({
    ...Object.fromEntries(
      Object.keys(TABLES.settlements.fields).map((key) => [key, null]),
    ),
    ...values,
  });
  // These are already-typed synthetic PostgREST JSON cells. The handler is a
  // pass-through, not a numeric-string parser or a client calculation gateway.
  const rows = [
    row({
      ID: 101,
      Truck: "1",
      Owner: owner,
      shared_owner: null,
      From: periodFrom,
      To: "2026-01-12",
      Insurance: 0,
      truck_loans: -5.25,
    }),
    row({
      ...Object.fromEntries(components.map((name) => [name, 0])),
      ID: 102,
      Truck: "9001",
      Owner: "Fixture Operating Entity",
      shared_owner: owner,
      From: periodFrom,
      To: "2026-01-12",
    }),
    row({
      ...Object.fromEntries(components.map((name) => [name, -12.5])),
      ID: 103,
      Truck: "9002",
      Owner: owner,
      shared_owner: owner,
      From: periodTo,
      To: "2026-01-19",
    }),
  ];
  let handler: ((request: Request) => Response | Promise<Response>) | undefined;
  const upstreamCalls: URL[] = [];
  const audits: Row[] = [];
  try {
    // Same fixture seam as handler_test.ts: import the actual entrypoint while
    // capturing its registered HTTP handler. No server or live upstream is used.
    Deno.env.get = (key: string) => env[key];
    Deno.env.toObject = () => ({ ...env });
    Deno.serve = ((callback: typeof handler) => {
      handler = callback;
      return {} as Deno.HttpServer;
    }) as typeof Deno.serve;
    globalThis.fetch = (input, init) => {
      const url = new URL(String(input));
      assert(url.origin === env.SUPABASE_URL, "unexpected network target");
      const headers = new Headers(init?.headers);
      assert(
        headers.get("apikey") === env.SUPABASE_SERVICE_ROLE_KEY,
        "missing synthetic upstream key",
      );
      assert(
        !headers.has("x-agent-key"),
        "agent key must not reach the upstream",
      );
      if (url.pathname === "/rest/v1/agent_query_audit") {
        assert(init?.method === "POST", "only mocked audit inserts may write");
        audits.push(JSON.parse(String(init.body)));
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      assert(
        url.pathname === "/rest/v1/settlements",
        "unexpected upstream path",
      );
      assert(init?.method === "GET", "settlements must be read-only");
      upstreamCalls.push(url);
      assert(
        url.searchParams.get("select") === tableSelect("settlements", false),
        "must select the complete non-sensitive settlement projection",
      );
      for (const name of components) {
        assert(
          url.searchParams.get("select")!.includes(
            name.includes(" ") ? `"${name}"` : name,
          ),
          `${name} must be selected even when null`,
        );
      }
      assert(
        headers.get("prefer")?.includes("count=exact"),
        "must request exact count",
      );
      assert(
        url.searchParams.get("or") ===
          '(Owner.eq."Fixture Owner, LLC",shared_owner.eq."Fixture Owner, LLC")',
        "owner must be an escaped exact primary-or-shared match",
      );
      assert(
        !url.searchParams.has("Owner") && !url.searchParams.has("shared_owner"),
        "owner branches must not become an AND",
      );
      assert(
        JSON.stringify(url.searchParams.getAll("From")) ===
          JSON.stringify([`gte.${periodFrom}`, `lte.${periodTo}`]),
        "both bounds must be inclusive on From",
      );
      assert(!url.searchParams.has("To"), "period_to bounds From, not To");
      assert(
        !url.searchParams.has("Truck"),
        "owner-allocation buckets must not be filtered out",
      );
      assert(
        url.searchParams.get("order") === "From.asc,ID.asc",
        "stable period/identity order changed",
      );
      assert(url.searchParams.get("limit") === "1", "page size changed");
      const offset = Number(url.searchParams.get("offset") ?? "0");
      assert(
        Number.isInteger(offset) && offset >= 0 && offset < rows.length,
        "unexpected cursor",
      );
      return Promise.resolve(Response.json(rows.slice(offset, offset + 1), {
        headers: { "content-range": `${offset}-${offset}/${rows.length}` },
      }));
    };
    await import("./index.ts");
    assert(handler, "entrypoint did not register its HTTP handler");
    const request = async (params: URLSearchParams) => {
      const response = await handler!(
        new Request(`https://gateway-fixture.invalid/?${params}`, {
          headers: { "x-agent-key": env.AGENT_API_KEY },
        }),
      );
      assert(
        response.status === 200,
        `unexpected HTTP status ${response.status}`,
      );
      return await response.json();
    };
    const metadata = await request(
      new URLSearchParams({ report: "settlements", metadata: "true" }),
    );
    assert(
      JSON.stringify(metadata.fields) ===
        JSON.stringify(TABLES.settlements.fields),
      "HTTP metadata drifted from canonical fields",
    );
    assert(
      metadata.primary_key === TABLES.settlements.primary_key,
      "HTTP identity metadata changed",
    );
    assert(
      upstreamCalls.length === 0 && audits.length === 0,
      "metadata must not retrieve settlement rows",
    );

    const params = new URLSearchParams({
      report: "settlements",
      owner,
      period_from: periodFrom,
      period_to: periodTo,
      limit: "1",
    });
    const seenIDs: unknown[] = [];
    for (let page = 0; page < rows.length; page++) {
      const result = await request(params);
      assert(
        result.report === "settlements" &&
          result.source === "public.settlements",
        "wrong report identity",
      );
      assert(
        result.offset === page && result.limit === 1,
        "response pagination context changed",
      );
      assert(
        result.count === 1 && result.page_count === 1 &&
          result.total_count === 3,
        "page count must not replace exact total",
      );
      assert(result.data.length === 1, "unexpected page length");
      assert(
        JSON.stringify(result.data[0]) === JSON.stringify(rows[page]),
        "handler changed upstream cells",
      );
      assert(
        JSON.stringify(result.sort) === JSON.stringify(["From asc", "ID asc"]),
        "response sort changed",
      );
      assert(
        result.filters.owner === owner &&
          result.filters.period_from === periodFrom &&
          result.filters.period_to === periodTo,
        "normalized filter context changed",
      );
      const current = result.data[0];
      seenIDs.push(current.ID);
      for (const name of components) {
        assert(Object.hasOwn(current, name), `${name} must remain present`);
        const expected = page === 0 ? null : page === 1 ? 0 : -12.5;
        assert(
          current[name] === expected,
          `${name} lost null/zero/negative distinction`,
        );
        if (page > 0) {
          assert(
            typeof current[name] === "number",
            `${name} changed JSON numeric type`,
          );
        }
      }
      for (const name of ["From", "To"] as const) {
        assert(
          typeof current[name] === "string" &&
            current[name] === rows[page][name],
          `${name} must remain the original ISO date string`,
        );
      }
      if (page === 0) {
        assert(current.Truck === "1", "non-physical owner bucket disappeared");
        assert(
          current.Insurance === 0 && current.truck_loans === -5.25,
          "stored bucket expenses changed",
        );
      }
      const hasMore = page < rows.length - 1;
      assert(result.has_more === hasMore, "has_more sequence changed");
      assert(
        result.next_offset === (hasMore ? page + 1 : null),
        "next_offset sequence changed",
      );
      if (hasMore) params.set("offset", String(result.next_offset));
    }
    assert(
      JSON.stringify(seenIDs) === "[101,102,103]",
      "cursor traversal duplicated or skipped a row",
    );
    assert(
      JSON.stringify(
        upstreamCalls.map((url) =>
          Number(url.searchParams.get("offset") ?? "0")
        ),
      ) === "[0,1,2]",
      "handler did not follow the requested cursor sequence",
    );
    assert(Number(audits.length) === 3, "each data page must be audited");
    for (const [offset, audit] of audits.entries()) {
      assert(
        audit.report_name === "settlements" && audit.outcome === "success" &&
          audit.row_count === 1,
        "wrong page audit",
      );
      const filters = audit.filters as { offset: number };
      assert(filters.offset === offset, "audit cursor changed");
    }
  } finally {
    Deno.serve = originalServe;
    globalThis.fetch = originalFetch;
    Deno.env.get = originalGet;
    Deno.env.toObject = originalToObject;
  }
});
