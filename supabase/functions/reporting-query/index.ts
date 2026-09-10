import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const allow = new Set(["fleet_status", "current_returns", "driver_assignments", "settlement_summary"]);

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function isoReturnDate(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const iso = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) || raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  return us ? `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}` : undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const requestId = crypto.randomUUID();
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, service);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401);
  const user = userData.user;

  let body: { report?: string; filters?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: "JSON body required" }, 400); }
  const report = body.report;
  const filters = body.filters && typeof body.filters === "object" && !Array.isArray(body.filters) ? body.filters : {};
  if (!report || !allow.has(report)) return json({ error: "Unknown report" }, 400);

  const { data: membership } = await admin
    .from("user_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    await admin.schema("reporting").from("agent_query_audit").insert({ request_id: requestId, user_id: user.id, report_name: report, filters, outcome: "denied" });
    return json({ error: "No active organization membership" }, 403);
  }
  if (report === "settlement_summary" && !["finance", "owner", "admin"].includes(membership.role)) {
    await admin.schema("reporting").from("agent_query_audit").insert({ request_id: requestId, user_id: user.id, organization_id: membership.organization_id, role: membership.role, report_name: report, filters, outcome: "denied" });
    return json({ error: "This report requires the finance role" }, 403);
  }

  let data: unknown[] = [];
  let error: { message: string } | null = null;
  if (report === "fleet_status") {
    let q = admin.from("trucks").select("truck_number,dispatcher,insurance,make,odometer_miles,owner,last_known_address,model_year,license_plate,yard_location,samsara_last_connected_at,mechanic_status").eq("organization_id", membership.organization_id).limit(500);
    for (const [field, column] of [["truck_number", "truck_number"], ["owner", "owner"], ["dispatcher", "dispatcher"], ["mechanic_status", "mechanic_status"]] as const) { const v = text(filters[field]); if (v) q = q.eq(column, v); }
    ({ data, error } = await q);
  } else if (report === "current_returns") {
    const { data: rows, error: queryError } = await admin.from("returns").select('Insurance,Truck,"Driver Name","Return Date"').eq("organization_id", membership.organization_id).limit(1000);
    error = queryError;
    const from = text(filters.return_from); const to = text(filters.return_to); const truck = text(filters.truck);
    data = (rows || []).filter((row) => { const date = isoReturnDate(row["Return Date"]); return (!truck || row.Truck === truck) && (!from || (date && date >= from)) && (!to || (date && date <= to)); });
  } else if (report === "driver_assignments") {
    const truck = text(filters.truck_number); const outFrom = text(filters.out_from); const outTo = text(filters.out_to); const returnFrom = text(filters.return_from); const returnTo = text(filters.return_to);
    if (!truck && !outFrom && !returnFrom) return json({ error: "driver_assignments requires truck_number, out_from, or return_from" }, 400);
    let q = admin.from("DriverPay").select('Truck_Number,"Out Date","Return Date","Driver Name",First_Name:"First Name",Last_Name:"Last Name",Solo_Driver_if_1,owner,Dispatch_Name_').eq("organization_id", membership.organization_id).limit(500);
    if (truck) q = q.eq("Truck_Number", truck); if (outFrom) q = q.gte("Out Date", outFrom); if (outTo) q = q.lte("Out Date", outTo); if (returnFrom) q = q.gte("Return Date", returnFrom); if (returnTo) q = q.lte("Return Date", returnTo);
    ({ data, error } = await q);
  } else {
    const from = text(filters.from); const to = text(filters.to); const truck = text(filters.truck); const owner = text(filters.owner); const dispatch = text(filters.dispatch);
    let q = admin.from("settlements").select('Truck,Dispatch,Owner,Gross,tonu,"Total Expenses",Net,From,To,"Total Driver Pay","Fuel Expenses",Driven_miles,"To Report"').eq("organization_id", membership.organization_id).limit(1000);
    if (from) q = q.gte("From", from); if (to) q = q.lte("To", to); if (truck) q = q.eq("Truck", truck); if (owner) q = q.eq("Owner", owner); if (dispatch) q = q.eq("Dispatch", dispatch); if (!from && !to) q = q.in("To Report", ["Yes", "true", "TRUE"]);
    ({ data, error } = await q);
  }
  if (error) {
    await admin.schema("reporting").from("agent_query_audit").insert({ request_id: requestId, user_id: user.id, organization_id: membership.organization_id, role: membership.role, report_name: report, filters, outcome: "invalid" });
    return json({ error: "Report query failed", detail: error.message, request_id: requestId }, 500);
  }
  await admin.schema("reporting").from("agent_query_audit").insert({ request_id: requestId, user_id: user.id, organization_id: membership.organization_id, role: membership.role, report_name: report, filters, row_count: data.length, outcome: "success" });
  return json({ report, filters, row_count: data.length, as_of: new Date().toISOString(), data, request_id });
});
