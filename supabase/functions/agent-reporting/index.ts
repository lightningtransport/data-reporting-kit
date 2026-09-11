import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { GLOBAL_GUIDANCE, REPORTS, SCHEMA_VERSION, SCHEMA_VERIFIED_AT } from "./metadata.ts";
import {
  buildAuditFilters,
  isReportAuthorized,
  normalizedFilters,
  parseInteger,
  parseNumber,
  requireExactCount,
  RequestValidationError,
  resolveRequestedReport,
  settlementSummarySelect,
  supportedReports,
  type SupportedReport,
  tableSelect,
  validateLegacyParameters,
  validateReportValues,
  validateStrictParameters,
} from "./request_logic.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");

function currentAdminKey(): string | undefined {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      console.error("SUPABASE_SECRET_KEYS is not valid JSON");
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

const adminKey = currentAdminKey();

function keySuffix(name: string): string {
  const match = name.match(/^AGENT_API_KEY_(\d+)$/);
  return match ? `_${match[1]}` : "";
}

const agentPrincipals = Object.entries(Deno.env.toObject())
  .filter(([name, value]) => (name === "AGENT_API_KEY" || /^AGENT_API_KEY_\d+$/.test(name)) && Boolean(value))
  .map(([name, value]) => {
    const suffix = keySuffix(name);
    const reportList = Deno.env.get(`AGENT_REPORTS${suffix}`)?.split(",").map((item) => item.trim()).filter(Boolean);
    return {
      id: name,
      key: value,
      organizationId: Deno.env.get(`AGENT_ORGANIZATION_ID${suffix}`) ?? Deno.env.get("AGENT_ORGANIZATION_ID"),
      role: Deno.env.get(`AGENT_ROLE${suffix}`) ?? "agent",
      allowedReports: reportList ? new Set(reportList) : null,
      // Approved AGENT_API_KEY principals have full read access by default. Set the
      // matching control to false only when a specific agent must not receive PII.
      allowSensitive: Deno.env.get(`AGENT_ALLOW_SENSITIVE${suffix}`) !== "false",
      expiresAt: Deno.env.get(`AGENT_EXPIRES_AT${suffix}`),
    };
  });

const seenAgentKeys = new Set<string>();
for (const principal of agentPrincipals) {
  if (seenAgentKeys.has(principal.key)) {
    throw new Error("Duplicate agent API key values are not allowed");
  }
  seenAgentKeys.add(principal.key);
  for (const report of principal.allowedReports ?? []) {
    if (!supportedReports.includes(report as SupportedReport)) {
      throw new Error(`Unknown report in ${principal.id} allowlist`);
    }
  }
}

if (!supabaseUrl || !adminKey || agentPrincipals.length === 0) {
  throw new Error("Required Supabase or agent authentication environment variables are missing");
}

const admin = createClient(supabaseUrl, adminKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set("apikey", adminKey);
      if (adminKey.startsWith("sb_secret_")) headers.delete("Authorization");
      return fetch(input, { ...init, headers });
    },
  },
});
const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: jsonHeaders });

class ServerError extends Error {
  auditContext?: { filters: Record<string, string>; includeSensitive: boolean; limit: number; offset: number };

  constructor(message: string, auditContext?: { filters: Record<string, string>; includeSensitive: boolean; limit: number; offset: number }) {
    super(message);
    this.name = "ServerError";
    this.auditContext = auditContext;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function findPrincipal(suppliedKey: string | null) {
  if (!suppliedKey) return null;
  return agentPrincipals.find((principal) => constantTimeEqual(principal.key, suppliedKey)) ?? null;
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

let singleOrganizationPromise: Promise<string> | null = null;
async function resolveOrganizationId(configured?: string): Promise<string> {
  if (configured) {
    if (!validUuid(configured)) throw new ServerError("Configured agent organization ID is invalid");
    return configured;
  }
  if (!singleOrganizationPromise) {
    singleOrganizationPromise = (async () => {
      const { data, error } = await admin.from("organizations").select("id").limit(2);
      if (error) throw new ServerError("Unable to resolve agent organization");
      if (!data || data.length !== 1) {
        throw new ServerError("Each agent key must be assigned an organization when the project has zero or multiple organizations");
      }
      return data[0].id as string;
    })();
  }
  return await singleOrganizationPromise;
}

async function audit(
  requestId: string,
  organizationId: string | null,
  principal: { id: string; role: string },
  report: string,
  appliedFilters: Record<string, string>,
  includeSensitive: boolean,
  limit: number,
  offset: number,
  outcome: "success" | "denied" | "invalid",
  rowCount: number | null,
): Promise<boolean> {
  try {
    const { error } = await admin.from("agent_query_audit").insert({
      request_id: requestId,
      user_id: null,
      organization_id: organizationId,
      role: principal.role,
      report_name: report,
      filters: buildAuditFilters(principal, appliedFilters, includeSensitive, limit, offset),
      row_count: rowCount,
      outcome,
    });
    if (error) {
      console.error("agent_query_audit insert failed", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("agent_query_audit insert failed", error instanceof Error ? error.message : String(error));
    return false;
  }
}

function catalogResponse(principal: { id: string; allowSensitive: boolean; allowedReports: Set<string> | null }) {
  const allowed = supportedReports.filter((report) => !principal.allowedReports || principal.allowedReports.has(report));
  return {
    schema_version: SCHEMA_VERSION,
    schema_verified_at: SCHEMA_VERIFIED_AT,
    endpoint: "/functions/v1/agent-reporting",
    method: "GET",
    authentication: "Send the assigned secret only in the x-agent-key header. Never place it in a URL, browser client, log, prompt, or repository.",
    principal: { id: principal.id, allowed_reports: allowed, sensitive_access: principal.allowSensitive },
    global_parameters: {
      report: { required: true, values: allowed },
      metadata: { type: "boolean", use: "Set true with a report to retrieve its full schema and rules without data filters." },
      limit: { type: "integer", default: 100, minimum: 1, maximum: 1000 },
      offset: { type: "integer", default: 0, minimum: 0, maximum: 100000 },
      include_sensitive: { type: "boolean", default: false, note: "All approved AGENT_API_KEY and AGENT_API_KEY_<number> principals may request the explicit sensitive-field allowlist by default. Set the matching AGENT_ALLOW_SENSITIVE control to false only to restrict one key." },
    },
    response_contract: {
      count: "Legacy alias of page_count for explicit reports; never interpret it as the full total.",
      page_count: "Rows in this page.",
      total_count: "Exact count for the normalized filters.",
      has_more: "True when another page exists.",
      next_offset: "Use as offset on the next request; null on the final page.",
      as_of: "API request time, not source-sync time.",
    },
    examples: [
      "?report=trucks&physical_only=true&dispatcher=Group%201",
      "?report=driver_pay&out_from=2026-09-01&out_to=2026-09-07",
      "?report=settlements&period_from=2026-09-01&period_to=2026-09-01",
      "?report=returns&return_from=2026-09-14&return_to=2026-09-20",
      "?report=settlements&metadata=true",
    ],
    guidance: GLOBAL_GUIDANCE,
    reports: Object.fromEntries(allowed.map((report) => [report, REPORTS[report]])),
  };
}

async function runLegacySettlementSummary(params: URLSearchParams, organizationId: string) {
  validateLegacyParameters(params);
  const rawLimit = Number(params.get("limit") ?? "100");
  const limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 1000) : 100;
  const filters: Record<string, string> = {};
  let query: any = admin.schema("reporting").from("settlement_summary").select(settlementSummarySelect()).eq("organization_id", organizationId);
  const truck = params.get("truck");
  const owner = params.get("owner");
  const periodFrom = params.get("period_from");
  const periodTo = params.get("period_to");
  if (truck !== null) {
    filters.truck = truck;
    query = query.eq("truck", truck);
  }
  if (owner !== null) {
    filters.owner = owner;
    query = query.eq("owner", owner);
  }
  if (periodFrom !== null) {
    filters.period_from = periodFrom;
    query = query.gte("period_from", periodFrom);
  }
  if (periodTo !== null) {
    filters.period_to = periodTo;
    query = query.lte("period_from", periodTo);
  }
  query = query.order("period_from", { ascending: true }).order("settlement_id", { ascending: true }).limit(limit);
  const { data, error } = await query;
  if (error) throw new ServerError("Unable to retrieve reporting data", { filters, includeSensitive: false, limit, offset: 0 });
  return { response: { count: data.length, data }, filters, limit };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Only GET requests are allowed" }, 405);

  const requestId = crypto.randomUUID();
  const principal = findPrincipal(req.headers.get("x-agent-key"));
  if (!principal) return json({ error: "Unauthorized", request_id: requestId }, 401);
  if (principal.expiresAt) {
    const expiresAt = Date.parse(principal.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return json({ error: "Agent credential expired", request_id: requestId }, 401);
    }
  }

  const url = new URL(req.url);
  const params = url.searchParams;
  const requested = resolveRequestedReport(params);
  const reportName = requested.report;
  let organizationId: string | null = null;

  if (requested.legacy && !isReportAuthorized(principal.allowedReports, "settlement_summary")) {
    const configuredOrganizationId = principal.organizationId && validUuid(principal.organizationId)
      ? principal.organizationId
      : null;
    await audit(requestId, configuredOrganizationId, principal, "settlement_summary_legacy", {}, false, 100, 0, "denied", null);
    return json({ error: "This agent key is not authorized for the requested report", request_id: requestId }, 403);
  }

  try {
    organizationId = await resolveOrganizationId(principal.organizationId);

    if (requested.legacy) {
      const legacy = await runLegacySettlementSummary(params, organizationId);
      const audited = await audit(
        requestId,
        organizationId,
        principal,
        "settlement_summary_legacy",
        legacy.filters,
        false,
        legacy.limit,
        0,
        "success",
        legacy.response.count,
      );
      if (!audited) return json({ error: "Unable to record reporting audit", request_id: requestId }, 500);
      return json(legacy.response);
    }

    if (reportName === "catalog") {
      for (const key of new Set(params.keys())) {
        if (params.getAll(key).length !== 1) throw new RequestValidationError(`Duplicate parameter is not allowed: ${key}`);
        if (key !== "report") throw new RequestValidationError(`Unsupported parameter for catalog: ${key}`);
      }
      return json(catalogResponse(principal));
    }

    if (!supportedReports.includes(reportName as SupportedReport)) {
      await audit(requestId, organizationId, principal, reportName, {}, false, 100, 0, "invalid", null);
      return json({ error: "Unsupported report", supported_reports: [...supportedReports, "catalog"], request_id: requestId }, 400);
    }
    const report = reportName as SupportedReport;
    if (!isReportAuthorized(principal.allowedReports, report)) {
      await audit(requestId, organizationId, principal, report, {}, false, 100, 0, "denied", null);
      return json({ error: "This agent key is not authorized for the requested report", request_id: requestId }, 403);
    }

    const metadata = params.get("metadata") === "true";
    validateStrictParameters(params, report, metadata);
    if (metadata) {
      return json({ schema_version: SCHEMA_VERSION, schema_verified_at: SCHEMA_VERIFIED_AT, report, guidance: GLOBAL_GUIDANCE, ...REPORTS[report] });
    }

    validateReportValues(params, report);
    const includeSensitive = params.get("include_sensitive") === "true";
    const limit = parseInteger(params.get("limit"), "limit", 100, 1, 1000);
    const offset = parseInteger(params.get("offset"), "offset", 0, 0, 100000);
    const filters = normalizedFilters(params, report);
    if (includeSensitive && !principal.allowSensitive) {
      await audit(requestId, organizationId, principal, report, filters, true, limit, offset, "denied", null);
      return json({ error: "This agent key is not authorized for sensitive fields", request_id: requestId }, 403);
    }

    let query: any;
    let sort: string[];
    if (report === "settlement_summary") {
      query = admin.schema("reporting").from("settlement_summary").select(settlementSummarySelect(), { count: "exact" }).eq("organization_id", organizationId);
      if (params.get("truck")) query = query.eq("truck", params.get("truck"));
      if (params.get("owner")) query = query.eq("owner", params.get("owner"));
      if (params.get("period_from")) query = query.gte("period_from", params.get("period_from"));
      if (params.get("period_to")) query = query.lte("period_from", params.get("period_to"));
      query = query.order("period_from", { ascending: true }).order("settlement_id", { ascending: true });
      sort = ["period_from asc", "settlement_id asc"];
    } else if (report === "settlements") {
      query = admin.from("settlements").select(tableSelect("settlements", includeSensitive), { count: "exact" }).eq("organization_id", organizationId);
      for (const [parameter, column] of [["truck", "Truck"], ["owner", "Owner"], ["dispatch", "Dispatch"], ["insurance", "truck_insurance"], ["to_report", "To Report"]]) {
        if (params.get(parameter)) query = query.eq(column, params.get(parameter));
      }
      if (params.get("period_from")) query = query.gte("From", params.get("period_from"));
      if (params.get("period_to")) query = query.lte("From", params.get("period_to"));
      query = query.order("From", { ascending: true }).order("ID", { ascending: true });
      sort = ["From asc", "ID asc"];
    } else if (report === "driver_pay") {
      query = admin.from("DriverPay").select(tableSelect("driver_pay", includeSensitive), { count: "exact" }).eq("organization_id", organizationId);
      for (const [parameter, column] of [["truck_number", "Truck_Number"], ["driver_id", "DriversDB_ID"], ["transfer", "Transfer"], ["termination", "Termination"], ["owner", "owner"], ["dispatch", "Dispatch_Name_"], ["temporal_driver", "Temporal_Driver"]]) {
        if (params.get(parameter)) query = query.eq(column, params.get(parameter));
      }
      if (params.get("out_from")) query = query.gte("Out Date", params.get("out_from"));
      if (params.get("out_to")) query = query.lte("Out Date", params.get("out_to"));
      if (params.get("return_from")) query = query.gte("Return Date", params.get("return_from"));
      if (params.get("return_to")) query = query.lte("Return Date", params.get("return_to"));
      if (params.get("solo") === "true") query = query.eq("Solo_Driver_if_1", 1);
      if (params.get("solo") === "false") query = query.or('"Solo_Driver_if_1".neq.1,"Solo_Driver_if_1".is.null');
      query = query.order("Out Date", { ascending: true, nullsFirst: false }).order("ID", { ascending: true });
      sort = ["Out Date asc nulls last", "ID asc"];
    } else if (report === "drivers") {
      const minExperience = parseNumber(params.get("min_experience"), "min_experience");
      const maxExperience = parseNumber(params.get("max_experience"), "max_experience");
      const hireFrom = params.get("hire_from");
      const hireTo = params.get("hire_to");
      query = admin.from("drivers").select(tableSelect("drivers", includeSensitive), { count: "exact" }).eq("organization_id", organizationId);
      const driverId = parseNumber(params.get("driver_id"), "driver_id");
      if (driverId !== null) query = query.eq("Ninox_ID", driverId);
      for (const [parameter, column] of [["first_name", "First Name"], ["last_name", "Last Name"], ["state", "State"], ["insurance", "Insurance"], ["company", "Company Name (This is NOT the Insurance)"]]) {
        if (params.get(parameter)) query = query.eq(column, params.get(parameter));
      }
      if (params.get("name")) query = query.ilike("FullName", `%${params.get("name")}%`);
      if (minExperience !== null) query = query.gte("Years Of Experience", minExperience);
      if (maxExperience !== null) query = query.lte("Years Of Experience", maxExperience);
      if (hireFrom) query = query.gte("Date of Hire", hireFrom);
      if (hireTo) query = query.lte("Date of Hire", hireTo);
      query = query.order("Ninox_ID", { ascending: true, nullsFirst: false }).order("ID", { ascending: true });
      sort = ["Ninox_ID asc nulls last", "ID asc"];
    } else if (report === "returns") {
      query = admin.from("returns").select(tableSelect("returns", includeSensitive), { count: "exact" }).eq("organization_id", organizationId);
      const ninoxId = parseNumber(params.get("ninox_id"), "ninox_id");
      if (ninoxId !== null) query = query.eq("Ninox_ID", ninoxId);
      for (const [parameter, column] of [["truck", "Truck"], ["insurance", "Insurance"]]) {
        if (params.get(parameter)) query = query.eq(column, params.get(parameter));
      }
      if (params.get("driver_name")) query = query.ilike("Driver Name", `%${params.get("driver_name")}%`);
      if (params.get("return_from")) query = query.gte("Return Date", params.get("return_from"));
      if (params.get("return_to")) query = query.lte("Return Date", params.get("return_to"));
      query = query.order("Return Date", { ascending: true, nullsFirst: false }).order("ID", { ascending: true });
      sort = ["Return Date asc nulls last", "ID asc"];
    } else {
      const minOdometer = parseNumber(params.get("min_odometer"), "min_odometer");
      const maxOdometer = parseNumber(params.get("max_odometer"), "max_odometer");
      const minModelYear = parseNumber(params.get("min_model_year"), "min_model_year");
      const maxModelYear = parseNumber(params.get("max_model_year"), "max_model_year");
      query = admin.from("trucks").select(tableSelect("trucks", includeSensitive), { count: "exact" }).eq("organization_id", organizationId);
      const truckNumber = parseNumber(params.get("truck_number"), "truck_number");
      const ninoxId = parseNumber(params.get("ninox_id"), "ninox_id");
      if (truckNumber !== null) query = query.eq("truck_number", truckNumber);
      if (ninoxId !== null) query = query.eq("Ninox_ID", ninoxId);
      for (const column of ["dispatcher", "owner", "insurance", "yard_location", "mechanic_status"]) {
        if (params.get(column)) query = query.eq(column, params.get(column));
      }
      if (params.get("make")) query = query.ilike("make", `%${params.get("make")}%`);
      if (minOdometer !== null) query = query.gte("odometer_miles", minOdometer);
      if (maxOdometer !== null) query = query.lte("odometer_miles", maxOdometer);
      if (minModelYear !== null) query = query.gte("model_year", minModelYear);
      if (maxModelYear !== null) query = query.lte("model_year", maxModelYear);
      if (params.get("physical_only") === "true") query = query.not("truck_number", "in", "(1,2,3)");
      query = query.order("truck_number", { ascending: true }).order("ID", { ascending: true });
      sort = ["truck_number asc", "ID asc"];
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) {
      console.error(`agent-reporting ${report} query failed`, error.message);
      await audit(requestId, organizationId, principal, report, filters, includeSensitive, limit, offset, "invalid", null);
      if (error.code === "PGRST103") {
        return json({ error: "Requested offset is beyond the available result range", request_id: requestId }, 416);
      }
      return json({ error: "Unable to retrieve reporting data", request_id: requestId }, 500);
    }
    let totalCount: number;
    try {
      totalCount = requireExactCount(count);
    } catch {
      console.error(`agent-reporting ${report} exact count was missing or invalid`);
      await audit(requestId, organizationId, principal, report, filters, includeSensitive, limit, offset, "invalid", null);
      return json({ error: "Unable to determine exact result count", request_id: requestId }, 500);
    }
    const pageCount = data?.length ?? 0;
    const hasMore = offset + pageCount < totalCount;
    const audited = await audit(requestId, organizationId, principal, report, filters, includeSensitive, limit, offset, "success", pageCount);
    if (!audited) return json({ error: "Unable to record reporting audit", request_id: requestId }, 500);
    return json({
      schema_version: SCHEMA_VERSION,
      report,
      source: REPORTS[report].source,
      filters,
      sort,
      offset,
      limit,
      count: pageCount,
      page_count: pageCount,
      total_count: totalCount,
      has_more: hasMore,
      next_offset: hasMore ? offset + pageCount : null,
      sensitive_fields_included: includeSensitive,
      as_of: new Date().toISOString(),
      source_freshness: "unknown: source tables do not expose a sync timestamp",
      caveats: GLOBAL_GUIDANCE.answer_evidence,
      data: data ?? [],
      request_id: requestId,
    });
  } catch (error) {
    const isValidationError = error instanceof RequestValidationError;
    const internalMessage = error instanceof Error ? error.message : String(error);
    if (!isValidationError) console.error("agent-reporting server failure", internalMessage);
    const auditContext = error instanceof ServerError ? error.auditContext : undefined;
    await audit(
      requestId,
      organizationId,
      principal,
      reportName,
      auditContext?.filters ?? {},
      auditContext?.includeSensitive ?? false,
      auditContext?.limit ?? 100,
      auditContext?.offset ?? 0,
      "invalid",
      null,
    );
    return json({
      error: isValidationError ? internalMessage : "Unable to process reporting request",
      request_id: requestId,
    }, isValidationError ? 400 : 500);
  }
});
