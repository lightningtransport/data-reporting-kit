import { REPORTS, TABLES } from "./metadata.ts";

const expected: Record<keyof typeof TABLES, string[]> = {
  driver_pay: ["Truck_Number", "Out Date", "Return Date", "Transfer", "DriversDB_ID", "Termination", "Termination Date", "Transfer Date", "Transfer Truck", "Solo_Driver_if_1", "MoneyPerWeekSigned", "MoneyPerDaysigned", "CPM", "Pay CPM after Miles", "Driver Name", "First Name", "Last Name", "E-mail", "Phone Number", "CDL", "State", "owner", "Samsara_ID", "Dispatch_Name_", "Temporal_Driver", "ID"],
  drivers: ["FullName", "First Name", "Middle Name", "Last Name", "E-mail", "Phone Number", "Years Of Experience", "DOB", "Company Name (This is NOT the Insurance)", "CDL", "State", "CDL Expiration", "Gender", "Insurance", "Ninox_ID", "ID", "Date of Hire"],
  returns: ["Insurance", "Truck", "Driver Name", "Phone Number", "Return Date", "ID", "Ninox_ID", "CDL"],
  settlements: ["Truck", "truck_insurance", "Dispatch", "Owner", "Gross", "tonu", "Total Expenses", "Net", "From", "To", "truck_loans", "Otro", "LTR Invoices", "Tolls", "BestPass", "Insurance", "CabCards", "Trailer Rentals", "samsara", "PrePass", "Total Driver Pay", "Fuel Expenses", "To Report", "%AppliedSaved", "Gross_with_%_deduction_All", "Driven_miles", "ID"],
  trucks: ["truck_number", "dispatcher", "insurance", "vin", "make", "odometer_miles", "owner", "last_known_address", "model_year", "license_plate", "yard_location", "samsara_last_connected_at", "samsara_vehicle_id", "mechanic_status", "ID", "Ninox_ID"],
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("metadata covers all 94 live reporting columns exactly", () => {
  let count = 0;
  for (const [table, columns] of Object.entries(expected) as [keyof typeof TABLES, string[]][]) {
    const actual = Object.keys(TABLES[table].fields);
    assert(JSON.stringify(actual) === JSON.stringify(columns), `${table} columns differ`);
    count += actual.length;
  }
  assert(count === 94, `expected 94 fields, got ${count}`);
});

Deno.test("every field has a physical type, nullability, and meaning", () => {
  for (const [table, metadata] of Object.entries(TABLES)) {
    for (const [column, definition] of Object.entries(metadata.fields)) {
      assert(typeof definition.type === "string" && definition.type.length > 0, `${table}.${column} missing type`);
      assert(typeof definition.nullable === "boolean", `${table}.${column} missing nullability`);
      assert(typeof definition.meaning === "string" && definition.meaning.length > 10, `${table}.${column} missing meaning`);
    }
  }
});

Deno.test("all report filters are explicit", () => {
  for (const [report, metadata] of Object.entries(REPORTS)) {
    const filters = "filters" in metadata ? Object.keys(metadata.filters as Record<string, unknown>) : [];
    assert(new Set(filters).size === filters.length, `${report} repeats a filter name`);
  }
});

Deno.test("critical business rules are present", () => {
  const settlementText = JSON.stringify(TABLES.settlements);
  const returnText = JSON.stringify(TABLES.returns);
  const driverPayText = JSON.stringify(TABLES.driver_pay);
  assert(settlementText.includes("1 is Carlos") && settlementText.includes("2 is Jorge") && settlementText.includes("3 is CDT") && settlementText.includes("total truck_loans and Insurance"), "owner bucket rule missing");
  assert(!JSON.stringify(TABLES.trucks).includes("owner-assignment bucket"), "settlement-only bucket rule leaked into trucks metadata");
  assert(settlementText.includes("Do not infer current cycle") && settlementText.includes("do not treat as a tonnage"), "settlement safeguards missing");
  assert(returnText.includes("not a driver ID"), "returns ID warning missing");
  assert(driverPayText.includes("Out Date only") && driverPayText.includes("Return Date only"), "DriverPay date rules missing");
});

Deno.test("data dictionary references every exact live column", async () => {
  const dictionary = await Deno.readTextFile(new URL("../../../docs/data-dictionary.md", import.meta.url));
  for (const [table, columns] of Object.entries(expected)) {
    for (const column of columns) {
      assert(dictionary.includes(`\`${column}\``), `${table}.${column} missing from dictionary`);
    }
  }
});
