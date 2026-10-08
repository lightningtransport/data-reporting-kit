import {
  isReportAuthorized,
  type SupportedReport,
  supportedReports,
  validateReportValues,
  validateStrictParameters,
} from "./request_logic.ts";
import { GLOBAL_GUIDANCE, REPORTS, SCHEMA_VERSION } from "./metadata.ts";
function assert(v: unknown, message = "assertion failed"): asserts v {
  if (!v) throw new Error(message);
}
function rejects(f: () => unknown) {
  try {
    f();
  } catch {
    return;
  }
  throw new Error("must reject");
}
Deno.test("live reports validate paired optional dates, real dates and inclusive 31-day maximum", () => {
  for (const name of ["out_schedule", "departures"]) {
    const report = name as SupportedReport;
    assert(
      (supportedReports as readonly string[]).includes(name),
      "report absent",
    );
    for (
      const query of [
        "",
        "out_from=2026-10-01&out_to=2026-10-31",
        "out_from=2026-10-05&out_to=2026-10-05",
      ]
    ) {
      const p = new URLSearchParams(query);
      validateStrictParameters(p, report, false);
      validateReportValues(p, report);
    }
    for (
      const query of [
        "out_from=2026-10-01",
        "out_to=2026-10-01",
        "out_from=2026-10-01&out_to=2026-11-01",
        "out_from=2026-02-30&out_to=2026-03-01",
        "out_from=2026-10-06&out_to=2026-10-05",
        "out_from=&out_to=2026-10-05",
        "include_sensitive=1",
        "offset=-1",
      ]
    ) rejects(() => validateReportValues(new URLSearchParams(query), report));
    for (
      const query of [
        "owner=A",
        "truck=12",
        "solo=true",
        "out_from=2026-10-01&out_from=2026-10-02",
        "return_null=true",
        "url=https://example.org",
      ]
    ) {
      rejects(() =>
        validateStrictParameters(new URLSearchParams(query), report, false)
      );
    }
    rejects(() =>
      validateStrictParameters(
        new URLSearchParams("metadata=true&limit=1"),
        report,
        true,
      )
    );
  }
});
Deno.test("departures requires permission for both inputs as well as the aggregate", () => {
  assert(isReportAuthorized(null, "departures"));
  assert(
    isReportAuthorized(
      new Set(["departures", "driver_pay", "out_schedule"]),
      "departures",
    ),
  );
  for (
    const allowed of [["departures"], ["driver_pay", "out_schedule"], [
      "departures",
      "driver_pay",
    ], ["departures", "out_schedule"]]
  ) assert(!isReportAuthorized(new Set(allowed), "departures"));
});
Deno.test("schema 3.8.0 exposes sources, date defaults, sensitivity and incomplete-total guidance", () => {
  assert(String(SCHEMA_VERSION) === "3.8.3");
  const reports = REPORTS as Record<string, unknown>;
  assert(reports.out_schedule && reports.departures);
  const text = JSON.stringify({
    reports: [reports.out_schedule, reports.departures],
    guidance: GLOBAL_GUIDANCE,
  });
  for (
    const term of [
      "America/New_York",
      "31",
      "Monday",
      "Sunday",
      "combined_distinct_total",
      "null",
      "Driver 1",
      "sensitive",
      "volatile",
      "no transfer/termination exclusions",
      "no team/solo formula",
    ]
  ) assert(text.includes(term), term);
  assert(
    !JSON.stringify(GLOBAL_GUIDANCE).includes(
      "that table is not available through this function",
    ),
  );
});
