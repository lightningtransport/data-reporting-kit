import * as live from "./live_departures.ts";
function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}
Deno.test("period defaults to New York Monday Sunday even before UTC day boundary", () => {
  equal(
    live.departurePeriod(
      new URLSearchParams(),
      new Date("2026-10-05T02:00:00Z"),
    ),
    {
      out_from: "2026-09-28",
      out_to: "2026-10-04",
      time_zone: "America/New_York",
    },
  );
});
Deno.test("distinct union ignores row multiplicity, solo, transfer and termination; filters blanks and dates", () => {
  const p = live.departurePeriod(
    new URLSearchParams("out_from=2026-10-05&out_to=2026-10-11"),
  );
  const dp = [
    {
      Truck_Number: " 0012 ",
      "Out Date": "2026-10-05",
      Termination: "Driver Changed",
    },
    {
      Truck_Number: "12",
      "Out Date": "2026-10-05",
      Transfer: "Transfer To Other Truck",
    },
    { Truck_Number: "13", "Out Date": "2026-10-11", Solo_Driver_if_1: 1 },
    { Truck_Number: "", "Out Date": "2026-10-06" },
    { Truck_Number: "99", "Out Date": "2026-10-12" },
    { Truck_Number: "98", "Out Date": null },
  ];
  const s = [
    { Truck: 12, "Out Date": "2026-10-06" },
    { Truck: 14, "Out Date": "2026-10-07" },
    { Truck: 14, "Out Date": "2026-10-07" },
    { Truck: null, "Out Date": "2026-10-07" },
  ];
  const result = live.reconcileDepartures(dp, s, p);
  equal(result.reconciliation, {
    driver_pay_count: 2,
    schedule_teams_count: 2,
    driver_pay_only_count: 1,
    schedule_teams_only_count: 1,
    overlap_count: 1,
    combined_distinct_total: 3,
  });
  equal(result.truck_sets, {
    driver_pay: ["12", "13"],
    schedule_teams: ["12", "14"],
    driver_pay_only: ["13"],
    schedule_teams_only: ["14"],
    overlap: ["12"],
    combined: ["12", "13", "14"],
  });
  equal(
    live.reconcileDepartures([], [], p).reconciliation.combined_distinct_total,
    0,
  );
  equal(
    live.reconcileDepartures(dp, null, p).reconciliation
      .combined_distinct_total,
    null,
  );
});
