// Keep this contract suite under tests/: the Edge Function source and its own tests
// are maintained independently. Run with `deno test --allow-read tests/outside_repairs_contract_test.ts`.
import { GLOBAL_GUIDANCE, REPORTS, TABLES } from "../supabase/functions/agent-reporting/metadata.ts";
import {
  isReportAuthorized,
  normalizedFilters,
  reportFilters,
  supportedReports,
  tableSelect,
  validateReportValues,
  validateStrictParameters,
  type SupportedReport,
} from "../supabase/functions/agent-reporting/request_logic.ts";

const report = "outside_repairs" as SupportedReport;
const expectedFields: Record<string, [string, boolean]> = {
  id: ["bigint", false],
  created_at: ["timestamptz", false],
  Status: ["text", true],
  Truck: ["numeric", true],
  Trailer: ["text", true],
  Date: ["date", true],
  "Repair Company": ["text", true],
  Choice: ["text", true],
  "Type of Work": ["text", true],
  "Total Cost": ["numeric", true],
  AHS: ["text", true],
  owner: ["text", true],
  Ninox_ID: ["numeric", true],
  Exceptions: ["text", true],
};
const expectedFilters = [
  "truck", "trailer", "date_from", "date_to", "company", "choice",
  "type_of_work", "ahs", "owner", "ninox_id", "exceptions",
];
const metadataTables = TABLES as unknown as Record<string, {
  source: string;
  fields: Record<string, { type: string; nullable: boolean; meaning: string }>;
  [key: string]: unknown;
}>;
const metadataReports = REPORTS as unknown as Record<string, {
  source: string;
  filters: Record<string, string>;
  [key: string]: unknown;
}>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function rejects(fn: () => unknown, expected: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(message)}`);
    return;
  }
  throw new Error(`expected validation rejection containing ${JSON.stringify(expected)}`);
}
function valid(query: string): Record<string, string> {
  const params = new URLSearchParams(`report=outside_repairs&${query}`);
  validateStrictParameters(params, report, false);
  validateReportValues(params, report);
  return normalizedFilters(params, report);
}

Deno.test("outside_repairs is registered, authorized by the normal allowlist, and points at its physical table", () => {
  assert(supportedReports.includes(report), "report missing from supportedReports/catalog registry");
  assert(isReportAuthorized(null, report), "unrestricted key must authorize the new report");
  assert(!isReportAuthorized(new Set(["fuel"]), report), "restricted key must not authorize the new report");
  assert(isReportAuthorized(new Set(["outside_repairs"]), report), "explicitly allowed key must authorize the new report");
  assert(metadataTables.outside_repairs?.source === 'public."Outside_Repairs"', "wrong physical source in table metadata");
  assert(metadataReports.outside_repairs?.source === 'public."Outside_Repairs"', "wrong report source");
});

Deno.test("outside_repairs metadata enumerates exactly the physical fields and types", () => {
  const fields = metadataTables.outside_repairs?.fields;
  assert(fields, "outside_repairs table metadata missing");
  assert(JSON.stringify(Object.keys(fields)) === JSON.stringify(Object.keys(expectedFields)),
    `physical fields differ: ${JSON.stringify(Object.keys(fields))}`);
  for (const [name, [type, nullable]] of Object.entries(expectedFields)) {
    const field = fields[name];
    assert(field.type === type && field.nullable === nullable, `${name} has incorrect physical type/nullability`);
    assert(typeof field.meaning === "string" && field.meaning.length > 10, `${name} needs a meaningful description`);
  }
  const select = tableSelect(report as Exclude<SupportedReport, "settlement_summary">, false).split(",");
  const expectedSelect = Object.keys(expectedFields).map((name) =>
    /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name}"`
  );
  assert(JSON.stringify(select) === JSON.stringify(expectedSelect), "default projection must contain all and only physical columns");
});

Deno.test("outside_repairs advertises and accepts exactly its intended filters", () => {
  const allowed = reportFilters[report];
  assert(allowed && JSON.stringify([...allowed]) === JSON.stringify(expectedFilters), "runtime filter allowlist drifted");
  assert(JSON.stringify(Object.keys(metadataReports.outside_repairs?.filters ?? {})) === JSON.stringify(expectedFilters),
    "metadata filter list drifted");
  const filters = valid("truck=123&trailer=T-42&date_from=2026-09-01&date_to=2026-09-30&company=ACME&choice=Truck&type_of_work=Engine&ahs=No&owner=SOLO+INC.&ninox_id=234&exceptions=note&limit=10&offset=5");
  assert(JSON.stringify(Object.keys(filters)) === JSON.stringify(expectedFilters), "normalization dropped a filter or included pagination");
  assert(filters.owner === "SOLO INC." && filters.company === "ACME", "exact text values must retain casing");
  for (const alias of ["truck_number", "repair_company", "type", "store_from", "shared_owner", "status"]) {
    rejects(() => validateStrictParameters(new URLSearchParams(`report=outside_repairs&truck=123&${alias}=x`), report, false), "Unsupported parameter");
  }
  rejects(() => validateStrictParameters(new URLSearchParams("report=outside_repairs&truck=1&truck=2"), report, false), "Duplicate parameter");
  rejects(() => validateStrictParameters(new URLSearchParams("report=outside_repairs&metadata=true&truck=1"), report, true), "Metadata requests cannot include");
});

Deno.test("outside_repairs requires truck, trailer, date_from or ninox_id anchor", () => {
  for (const query of ["truck=0", "trailer=T-42", "date_from=2026-09-01", "ninox_id=15"]) {
    valid(query);
  }
  for (const query of ["", "owner=Acme", "choice=Truck", "date_to=2026-09-30", "company=Acme&ahs=No", "type_of_work=Engine&exceptions=note"]) {
    rejects(() => valid(query), "requires");
  }
});

Deno.test("outside_repairs rejects malformed identifiers, date bounds, blanks and enums", () => {
  const failures: [string, string][] = [
    ["truck=not-a-number", "truck must be numeric"],
    ["ninox_id=not-a-number", "ninox_id must be numeric"],
    ["date_from=2026-02-30", "date_from must be a real date"],
    ["truck=1&date_to=2026-09-31", "date_to must be a real date"],
    ["date_from=2026-09-10&date_to=2026-09-01", "date_from cannot be after date_to"],
    ["truck=1&trailer=++", "trailer must not be empty"],
    ["truck=1&choice=Vehicle", "choice must be"],
    ["truck=1&ahs=Maybe", "ahs must be"],
  ];
  for (const [query, expected] of failures) rejects(() => valid(query), expected);
  valid("truck=1&choice=Truck&ahs=Yes");
  valid("trailer=42&choice=Trailer&ahs=No");
});

Deno.test("outside_repairs metadata states expense attribution and non-overlapping totals", () => {
  const text = JSON.stringify({ table: metadataTables.outside_repairs, report: metadataReports.outside_repairs, guidance: GLOBAL_GUIDANCE });
  assert(/Choice/.test(text) && /Trailer/.test(text) && /Truck/.test(text) && /expense|cost/i.test(text), "truck/trailer attribution rule missing");
  assert(/AHS/.test(text) && /null|blank/i.test(text) && /No/.test(text), "null AHS as No rule missing");
  assert(/Type of Work/.test(text) && /comma|multi.category/i.test(text) && /overlap|double.count/i.test(text), "multi-category overlap caveat missing");
});

Deno.test("outside_repairs query targets source, exact columns, date bounds and stable lowercase id", async () => {
  const source = await Deno.readTextFile(new URL("../supabase/functions/agent-reporting/index.ts", import.meta.url));
  const start = source.indexOf('report === "outside_repairs"');
  assert(start >= 0, "dedicated outside_repairs query branch missing");
  const branch = source.slice(start, source.indexOf("} else", start + 1) < 0 ? undefined : source.indexOf("} else", start + 1));
  assert(branch.includes('from("Outside_Repairs")'), "query must read physical Outside_Repairs table");
  assert(branch.includes('count: "exact"'), "query must request exact total count");
  for (const column of ["Truck", "Trailer", "Repair Company", "Choice", "owner", "Ninox_ID", "Exceptions"]) {
    assert(branch.includes(JSON.stringify(column)), `${column} filter missing from branch`);
  }
  assert(branch.includes('gte("Date"') && branch.includes('lte("Date"'), "inclusive service-date bounds missing");
  assert(branch.includes('order("id"') && branch.includes('order("Date"'), "stable Date/id ordering missing");
  assert(branch.includes('"AHS"') && /\.is\(|\.or\(/.test(branch), "AHS No must include null rows");
  assert(branch.includes('"Type of Work"') && /\.or\(|\.filter\(/.test(branch), "category must match comma-separated tokens");
});
