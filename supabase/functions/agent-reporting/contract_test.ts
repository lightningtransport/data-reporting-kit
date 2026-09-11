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
