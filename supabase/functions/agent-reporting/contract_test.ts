import { SCHEMA_VERIFIED_AT } from "./metadata.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("OpenAPI agent response schemas are explicit and non-overlapping", async () => {
  const specification = await Deno.readTextFile(
    new URL("../../../api/openapi.yaml", import.meta.url),
  );
  for (
    const schema of [
      "AgentDataResponse",
      "LegacyResponse",
      "CatalogResponse",
      "MetadataResponse",
    ]
  ) {
    assert(
      specification.includes(`- {$ref: '#/components/schemas/${schema}'}`),
      `${schema} is absent from the response union`,
    );
  }
  const responseUnion = specification.slice(
    specification.indexOf("                oneOf:"),
    specification.indexOf(
      "        '400':",
      specification.indexOf("                oneOf:"),
    ),
  );
  assert(
    !responseUnion.includes("additionalProperties: true"),
    "response union still contains an overlapping catch-all",
  );
});

Deno.test("Supabase config preserves JWT verification per function", async () => {
  const config = await Deno.readTextFile(
    new URL("../../config.toml", import.meta.url),
  );
  assert(
    /\[functions\.agent-reporting\][\s\S]*?verify_jwt\s*=\s*false/.test(config),
    "agent-reporting must disable gateway JWT verification",
  );
  assert(
    /\[functions\.reporting-query\][\s\S]*?verify_jwt\s*=\s*true/.test(config),
    "reporting-query must keep gateway JWT verification",
  );
});

Deno.test("schema verification timestamp matches the OpenAPI date-time contract", async () => {
  assert(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(SCHEMA_VERIFIED_AT),
    "runtime schema_verified_at is not a UTC date-time",
  );
  const specification = await Deno.readTextFile(
    new URL("../../../api/openapi.yaml", import.meta.url),
  );
  const matches = specification.match(/schema_verified_at: \{type: string, format: date-time\}/g) ?? [];
  assert(matches.length === 2, "catalog and metadata schema_verified_at must both be date-time");
});

Deno.test("outside repairs apply Choice exactly, AHS No includes null and blank, and category uses safe pattern", async () => {
  const handler = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const start = handler.indexOf('report === "outside_repairs"');
  assert(start >= 0, "outside_repairs query branch missing");
  const end = handler.indexOf("} else", start + 1);
  const branch = handler.slice(start, end < 0 ? undefined : end);
  assert(branch.includes('["choice", "Choice"]') && branch.includes("query.eq(column, params.get(parameter))"), "Choice must be an exact physical filter");
  assert(branch.includes('query.eq("AHS", "Yes")'), "after-hours Yes must be exact");
  assert(branch.includes("AHS.eq.No") && branch.includes("AHS.is.null") && branch.includes('AHS.eq.\\"\\"'), "AHS No must match No, null and empty text");
  assert(branch.includes('query.filter("Type of Work", "imatch", workCategoryPattern('), "category must use escaped whole-token pattern");
});

Deno.test("returns owner and dispatcher are exact row filters in runtime and API spec", async () => {
  const handler = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const spec = await Deno.readTextFile(new URL("../../../api/openapi.yaml", import.meta.url));
  const returnsBranch = handler.slice(handler.indexOf('} else if (report === "returns")'), handler.indexOf('} else if (report === "fuel")'));
  assert(returnsBranch.includes('["dispatcher", "Dispatcher"]') && returnsBranch.includes('["owner", "Owner"]') && returnsBranch.includes('query.eq(column, params.get(parameter))'), "returns handler must apply exact filters to physical attribution columns");
  assert(returnsBranch.includes('query.gte("Return Date"') && returnsBranch.includes('query.lte("Return Date"') && returnsBranch.includes('.order("ID"'), "returns date bounds and stable pagination changed");
  assert(spec.includes("match the returns row Owner") && spec.includes("match the returns row Dispatcher"), "API spec missing returns-specific exact filters");
});

Deno.test("on-road filter applies both strict date bounds before paginating", async () => {
  const handler = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const branch = handler.slice(handler.indexOf('} else if (report === "driver_pay")'), handler.indexOf('} else if (report === "drivers")'));
  assert(branch.includes('query.lte("Out Date", date).gt("Return Date", date)'), "on-road comparison boundaries changed");
  assert(branch.includes('.not("Truck_Number", "is", null)'), "null truck identities should not qualify");
  assert(branch.includes('.order("ID"'), "stable pagination identity missing");
  const spec = await Deno.readTextFile(new URL("../../../api/openapi.yaml", import.meta.url));
  assert(spec.includes('- name: on_road_at') && spec.includes('Return Date > D'), "OpenAPI on-road contract missing");
});
