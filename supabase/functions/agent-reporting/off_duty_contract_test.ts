import { GLOBAL_GUIDANCE, SCHEMA_VERSION, TABLES } from "./metadata.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("current off-duty questions route to exact fresh Ninox share rather than unavailable table fields", () => {
  const guidance = GLOBAL_GUIDANCE as unknown as Record<string, unknown>;
  const rule = guidance.off_duty_trucks as Record<string, unknown> | undefined;
  assert(rule, "off-duty source routing missing");
  assert(rule.source_url === "https://lightningtransport.ninoxdb.com/share/jx7z6tkjcnxalvsui4icdnqjuszia04etdhi?locale=en&utcoffset=-240", "source URL must remain exact");
  const text = JSON.stringify(rule);
  for (const term of ["in the yard", "off duty", "not working", "not on the road", "Ready To Go", "Outside", "immediately", "truck_number", "Days In Yard", "86400000", "historical", "zero", "credentials", "JSON array"]) {
    assert(text.includes(term), `off-duty rule missing ${term}`);
  }
  assert(String(SCHEMA_VERSION) === "3.8.2", "answer-affecting metadata version not bumped");
  assert(!JSON.stringify(GLOBAL_GUIDANCE).includes("in-yard/off-duty and insurance-choice calculation requires"), "contradictory unavailable rule retained");
  assert(JSON.stringify(TABLES.trucks).includes("off_duty_trucks"), "truck metadata must route current status questions");
});
