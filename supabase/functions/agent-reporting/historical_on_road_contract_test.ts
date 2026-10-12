import { GLOBAL_GUIDANCE, SCHEMA_VERSION, TABLES } from "./metadata.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("historical on-road counts use settlement gross, not default assignment overlap", () => {
  assert(String(SCHEMA_VERSION) === "3.8.4", "metadata contract must be versioned");
  const rules = GLOBAL_GUIDANCE as unknown as Record<string, unknown>;
  const history = JSON.stringify(rules.historical_on_road_trucks);
  for (const required of ["2026-10-12", "settlements", "Gross > 0", "Gross = 0", "Tuesday", "Monday", "distinct", "null", "negative", "1/2/3", "period_from", "period_to", "From", "shared_owner", "Dispatch", "pagination", "exact-day", "assignment overlap"]) {
    assert(history.includes(required), `missing historical rule: ${required}`);
  }
  const settlement = JSON.stringify(TABLES.settlements);
  assert(settlement.includes("historical on-road"), "settlement metadata must advertise historical use");
  assert(settlement.includes("Gross > 0") && settlement.includes("Gross = 0"), "settlement calculation rule missing");
  assert(JSON.stringify(TABLES.driver_pay).includes("not the default historical on-road count"), "assignment metric must not override settlement routing");
});
