import { REPORTS, TABLES } from "./metadata.ts";

export const supportedReports = [
  "settlement_summary",
  "settlements",
  "driver_pay",
  "drivers",
  "returns",
  "trucks",
] as const;
export type SupportedReport = typeof supportedReports[number];

export const reportFilters: Record<SupportedReport, Set<string>> = {
  settlement_summary: new Set(["truck", "owner", "period_from", "period_to"]),
  settlements: new Set([
    "truck",
    "owner",
    "dispatch",
    "insurance",
    "to_report",
    "period_from",
    "period_to",
  ]),
  driver_pay: new Set([
    "truck_number",
    "driver_id",
    "out_from",
    "out_to",
    "return_from",
    "return_to",
    "transfer",
    "termination",
    "solo",
    "owner",
    "dispatch",
    "temporal_driver",
  ]),
  drivers: new Set([
    "driver_id",
    "name",
    "first_name",
    "last_name",
    "state",
    "insurance",
    "company",
    "min_experience",
    "max_experience",
  ]),
  returns: new Set([
    "truck",
    "insurance",
    "ninox_id",
    "driver_name",
    "return_from",
    "return_to",
  ]),
  trucks: new Set([
    "truck_number",
    "dispatcher",
    "owner",
    "insurance",
    "yard_location",
    "mechanic_status",
    "make",
    "min_odometer",
    "max_odometer",
    "min_model_year",
    "max_model_year",
    "physical_only",
  ]),
};

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export function resolveRequestedReport(
  params: URLSearchParams,
): { report: SupportedReport | string; legacy: boolean } {
  return params.has("report")
    ? { report: params.get("report") ?? "", legacy: false }
    : { report: "settlement_summary", legacy: true };
}

export function isReportAuthorized(
  allowedReports: Set<string> | null,
  report: string,
): boolean {
  return !allowedReports || allowedReports.has(report);
}

function invalid(message: string): never {
  throw new RequestValidationError(message);
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

export function parseInteger(
  value: string | null,
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  if (value === null) return defaultValue;
  if (!/^\d+$/.test(value)) {
    invalid(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    invalid(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

export function parseNumber(value: string | null, name: string): number | null {
  if (value === null) return null;
  if (value.trim() === "" || !Number.isFinite(Number(value))) {
    invalid(`${name} must be numeric`);
  }
  return Number(value);
}

export function parseBoolean(
  value: string | null,
  name: string,
): boolean | null {
  if (value === null) return null;
  if (value !== "true" && value !== "false") {
    invalid(`${name} must be true or false`);
  }
  return value === "true";
}

export function validateDateRange(
  params: URLSearchParams,
  fromName: string,
  toName: string,
): void {
  const from = params.get(fromName);
  const to = params.get(toName);
  if (from !== null && !isRealDate(from)) {
    invalid(`${fromName} must be a real date in YYYY-MM-DD format`);
  }
  if (to !== null && !isRealDate(to)) {
    invalid(`${toName} must be a real date in YYYY-MM-DD format`);
  }
  if (from && to && from > to) invalid(`${fromName} cannot be after ${toName}`);
}

export function validateStrictParameters(
  params: URLSearchParams,
  report: SupportedReport,
  metadata: boolean,
): void {
  const global = new Set([
    "report",
    "metadata",
    "limit",
    "offset",
    "include_sensitive",
  ]);
  const allowed = new Set([...global, ...reportFilters[report]]);
  for (const key of new Set(params.keys())) {
    if (params.getAll(key).length !== 1) {
      invalid(`Duplicate parameter is not allowed: ${key}`);
    }
    if (!allowed.has(key)) {
      invalid(`Unsupported parameter for ${report}: ${key}`);
    }
  }
  if (metadata) {
    for (const key of params.keys()) {
      if (key !== "report" && key !== "metadata") {
        invalid(
          "Metadata requests cannot include data filters, pagination, or sensitive-field options",
        );
      }
    }
  }
  const metadataValue = params.get("metadata");
  if (
    metadataValue !== null && metadataValue !== "true" &&
    metadataValue !== "false"
  ) {
    invalid("metadata must be true or false");
  }
}

function rejectBlankFilters(
  params: URLSearchParams,
  report: SupportedReport,
): void {
  for (const name of reportFilters[report]) {
    const value = params.get(name);
    if (value !== null && value.trim() === "") {
      invalid(`${name} must not be empty`);
    }
  }
}

export function validateReportValues(
  params: URLSearchParams,
  report: SupportedReport,
): void {
  rejectBlankFilters(params, report);
  parseInteger(params.get("limit"), "limit", 100, 1, 1000);
  parseInteger(params.get("offset"), "offset", 0, 0, 100000);
  parseBoolean(params.get("include_sensitive"), "include_sensitive");

  if (report === "settlement_summary" || report === "settlements") {
    validateDateRange(params, "period_from", "period_to");
    if (!params.get("truck") && !params.get("period_from")) {
      invalid(`${report} requires truck or period_from`);
    }
  } else if (report === "driver_pay") {
    validateDateRange(params, "out_from", "out_to");
    validateDateRange(params, "return_from", "return_to");
    if (
      !["truck_number", "driver_id", "out_from", "return_from"].some((name) =>
        params.get(name)
      )
    ) {
      invalid(
        "driver_pay requires truck_number, driver_id, out_from, or return_from",
      );
    }
    parseBoolean(params.get("solo"), "solo");
    const temporalDriver = params.get("temporal_driver");
    if (
      temporalDriver !== null && temporalDriver !== "Yes" &&
      temporalDriver !== "No"
    ) {
      invalid("temporal_driver must be Yes or No");
    }
  } else if (report === "drivers") {
    parseNumber(params.get("driver_id"), "driver_id");
    const minimum = parseNumber(params.get("min_experience"), "min_experience");
    const maximum = parseNumber(params.get("max_experience"), "max_experience");
    if (minimum !== null && maximum !== null && minimum > maximum) {
      invalid("min_experience cannot be greater than max_experience");
    }
  } else if (report === "returns") {
    validateDateRange(params, "return_from", "return_to");
    parseNumber(params.get("ninox_id"), "ninox_id");
  } else {
    parseNumber(params.get("truck_number"), "truck_number");
    const minimumOdometer = parseNumber(
      params.get("min_odometer"),
      "min_odometer",
    );
    const maximumOdometer = parseNumber(
      params.get("max_odometer"),
      "max_odometer",
    );
    const minimumModelYear = parseNumber(
      params.get("min_model_year"),
      "min_model_year",
    );
    const maximumModelYear = parseNumber(
      params.get("max_model_year"),
      "max_model_year",
    );
    if (
      minimumOdometer !== null && maximumOdometer !== null &&
      minimumOdometer > maximumOdometer
    ) invalid("min_odometer cannot be greater than max_odometer");
    if (
      minimumModelYear !== null && maximumModelYear !== null &&
      minimumModelYear > maximumModelYear
    ) invalid("min_model_year cannot be greater than max_model_year");
    parseBoolean(params.get("physical_only"), "physical_only");
  }
}

export function validateLegacyParameters(params: URLSearchParams): void {
  for (const name of ["truck", "owner", "period_from", "period_to"]) {
    const value = params.get(name);
    if (value !== null && value.trim() === "") {
      invalid(`${name} must not be empty`);
    }
  }
  validateDateRange(params, "period_from", "period_to");
}

function quoteColumn(name: string): string {
  return /^[a-z_][a-z0-9_]*$/.test(name)
    ? name
    : `"${name.replaceAll('"', '""')}"`;
}

export function tableSelect(
  report: Exclude<SupportedReport, "settlement_summary">,
  includeSensitive: boolean,
): string {
  const fields = TABLES[report === "driver_pay" ? "driver_pay" : report]
    .fields as Record<string, { sensitive?: boolean }>;
  return Object.entries(fields)
    .filter(([, definition]) => includeSensitive || !definition.sensitive)
    .map(([name]) => quoteColumn(name))
    .join(",");
}

export function settlementSummarySelect(): string {
  return REPORTS.settlement_summary.returned_fields.map(quoteColumn).join(",");
}

export function normalizedFilters(
  params: URLSearchParams,
  report: SupportedReport,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of reportFilters[report]) {
    const value = params.get(name);
    if (value !== null) result[name] = value;
  }
  return result;
}

export function buildAuditFilters(
  principal: { id: string; role: string },
  appliedFilters: Record<string, string>,
  includeSensitive: boolean,
  limit: number,
  offset: number,
) {
  return {
    principal_id: principal.id,
    principal_role: principal.role,
    applied_filters: appliedFilters,
    include_sensitive: includeSensitive,
    limit,
    offset,
  };
}

export function requireExactCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("Exact result count is missing or invalid");
  }
  return value;
}
