import {
  buildAuditFilters,
  isReportAuthorized,
  normalizedFilters,
  requireExactCount,
  resolveRequestedReport,
  settlementSummarySelect,
  tableSelect,
  validateReportValues,
  validateStrictParameters,
} from "./request_logic.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(fn: () => unknown, expected: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      message.includes(expected),
      `expected error containing ${expected}, got ${message}`,
    );
    return;
  }
  throw new Error(`expected error containing ${expected}`);
}

Deno.test("omitted report resolves to settlement_summary and obeys report allowlist", () => {
  const request = resolveRequestedReport(new URLSearchParams("limit=1"));
  assert(
    request.report === "settlement_summary" && request.legacy,
    "legacy report did not resolve correctly",
  );
  assert(
    !isReportAuthorized(new Set(["trucks"]), request.report),
    "restricted key bypassed legacy authorization",
  );
  assert(
    isReportAuthorized(new Set(["settlement_summary"]), request.report),
    "authorized legacy report was denied",
  );
});

Deno.test("settlement summary uses the exact declared projection", () => {
  assert(
    settlementSummarySelect() ===
      "settlement_id,organization_id,truck,owner,period_from,period_to,gross,total_expenses,net,total_driver_pay,fuel_expenses,driven_miles",
    "settlement summary projection drifted",
  );
});

Deno.test("drivers omit Gender and other sensitive fields by default", () => {
  const defaultProjection = tableSelect("drivers", false);
  assert(
    !defaultProjection.includes("Gender"),
    "default projection exposed Gender",
  );
  assert(
    !defaultProjection.includes('"E-mail"'),
    "default projection exposed email",
  );
  assert(
    tableSelect("drivers", true).includes("Gender"),
    "sensitive projection omitted Gender",
  );
});

Deno.test("blank filters are rejected before normalization", () => {
  const params = new URLSearchParams({ report: "drivers", name: "   " });
  validateStrictParameters(params, "drivers", false);
  assertThrows(
    () => validateReportValues(params, "drivers"),
    "name must not be empty",
  );
});

Deno.test("numeric identifiers and temporal_driver enum are validated", () => {
  for (
    const [report, query, expected] of [
      ["drivers", "report=drivers&driver_id=abc", "driver_id must be numeric"],
      ["returns", "report=returns&ninox_id=nope", "ninox_id must be numeric"],
      [
        "trucks",
        "report=trucks&truck_number=12x",
        "truck_number must be numeric",
      ],
      [
        "driver_pay",
        "report=driver_pay&out_from=2026-09-01&temporal_driver=Maybe",
        "temporal_driver must be Yes or No",
      ],
    ] as const
  ) {
    const params = new URLSearchParams(query);
    validateStrictParameters(params, report, false);
    assertThrows(() => validateReportValues(params, report), expected);
  }
});

Deno.test("normalized filters contain only validated report filters", () => {
  const params = new URLSearchParams(
    "report=returns&return_from=2026-09-01&limit=20&offset=5",
  );
  validateStrictParameters(params, "returns", false);
  validateReportValues(params, "returns");
  assert(
    JSON.stringify(normalizedFilters(params, "returns")) ===
      '{"return_from":"2026-09-01"}',
    "normalization included non-filter parameters",
  );
});

Deno.test("audit payload distinguishes principal identity and role from outcome", () => {
  const value = buildAuditFilters(
    { id: "AGENT_API_KEY_7", role: "finance" },
    { period_from: "2026-09-01" },
    false,
    100,
    0,
  );
  assert(value.principal_id === "AGENT_API_KEY_7", "principal ID missing");
  assert(value.principal_role === "finance", "principal role missing");
  assert(
    value.include_sensitive === false && value.limit === 100 &&
      value.offset === 0,
    "audit options missing",
  );
  assert(
    value.applied_filters.period_from === "2026-09-01",
    "applied filters missing",
  );
});

Deno.test("missing or invalid exact counts fail instead of using page count", () => {
  for (const value of [null, undefined, -1, 1.5, "2"]) {
    assertThrows(
      () => requireExactCount(value),
      "Exact result count is missing or invalid",
    );
  }
  assert(
    requireExactCount(0) === 0 && requireExactCount(12) === 12,
    "valid exact count was rejected",
  );
});
