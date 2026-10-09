# Live Drivers Insurance — approved Ninox roster

## Approval and source selection

**Evidence:** user-approved source instruction 2026-10-09; live credential-free HTTP 200 `application/json`, no redirects, complete array and field/type coverage verified 2026-10-09 at 14:20:06Z. Observed row counts and insurance values are not durable facts.

Exact approved URL (preserve all query parameters):

`https://lightningtransport.ninoxdb.com/share/go6oxo2dl22j6n2c8mtzl709vcyi66xkmetx?locale=en&utcoffset=-240`

For **Drivers Insurance**, drivers with/under insurance, insured-driver lists/counts, insurance breakdowns, or an individual driver's current insurance, fetch this JSON **immediately before each answer**. The user identifies this as the company roster of drivers with or under insurance. Default scope is the entire feed; apply a specific insurer/name filter only when requested, using exact stored insurance values. Do not hard-code CTC, expand insurance codes into invented company names, or confuse driver Insurance with employer/company, truck insurance, settlement Insurance expense, or the unsupported legacy truck insurance-choice formula.

This is an approved direct external source, not a new Supabase table, gateway report enum, MCP report or Jev `ask` route. Do not query Supabase `drivers`, DriverPay, truck status or prior snapshots instead. Generic relational-fallback rules do not override this route: a missing roster attribute stays unknown unless the user explicitly requests a separate approved-source enrichment, with provenance and no replacement of roster membership or Insurance. MCP search/fetch exposes instructions only; use the host HTTP capability to download the data. If the host cannot fetch it, disclose unavailable evidence.

## Fresh bounded retrieval and validation

1. Request the exact URL with `Accept: application/json` and cache bypass; **no credentials**, cookies, Authorization, `x-agent-key`, Supabase key or employee session. Reject redirects, non-2xx responses, missing/non-JSON content type and HTML/login bodies. Enforce a **30-second overall deadline** including complete read, decoding, parsing and validation, and a **2 MiB** body bound. A truncated attached context or web preview is not the complete JSON. No conditional/cache reuse or saved business-row fallback.
2. Require a complete top-level JSON array of objects; reject malformed/truncated JSON, duplicate object keys (including escaped equivalents), non-finite numbers and decode errors. Validate every row before filters/counts. The observed field vocabulary is below; unknown keys or type drift require disclosure and verification, not silent dropping.
3. Require nonblank string `First Name`, `Last Name` and `Insurance` for this approved insured-roster route. Optional fields can be absent: absence means unknown, not a schema failure or exclusion. The verified feed contains missing CDL and sparse State/hire-date attributes. Explicit null/type drift is not established; fail closed and reverify rather than silently coercing it.

### Source fields (exact spelling)

| Key | Observed type / handling |
|---|---|
| `First Name` | Required string; preserve source spelling. |
| `Last Name` | Required string; preserve source spelling. |
| `Insurance` | Required nonblank string; exact literal insurance label, not proof of policy terms. |
| `CDL Number` | Optional string; sensitive identity key. Preserve leading zeros, punctuation and case; never convert to a number or repair the value. |
| `Gender` | Optional string; source value, not inferred from a name. |
| `DOB` | Optional date string; sensitive, potentially anomalous source value. |
| `State` | Optional string; missing is unknown, never inferred. |
| `Hire of Date` | Optional date string; do not rename it to Supabase `Date of Hire`. |
| `Years_of_Experience` | Optional finite JSON number, not boolean; do not recompute from dates. |

Do not correct questionable DOB/hire dates, gender, CDL values or experience silently. Validate calendar dates with a tool if the question depends on them; disclose implausible source values separately without mutating the roster or inventing eligibility. Optional attributes are not required to list an insured driver.

## Grain, counts, filters and identity

- One retrieved array is one current roster snapshot; no pagination/cursor or persistent record-ID contract is established. Retrieve and analyze **all** rows; do not union multiple snapshots.
- For a general insured-driver list, include every roster entry and show **names and insurance** by default. Preserve entries with missing CDL. Never deduplicate by name or use DOB/name/Supabase ID as a substitute identity key. A named-person match can be ambiguous; do not assert a unique identity from a name alone.
- Compute roster row count, distinct nonblank exact `CDL Number` count, missing/blank-CDL row count and duplicate-CDL evidence with tools. Keep these measures separate. If every CDL is present and unique, the distinct driver count is verified; otherwise label the roster row count as entries, and unique-driver identity/count as unresolved. Do not call only the known-CDL count the full insured total, or drop missing-CDL rows.
- Disclose repeated CDL or conflicting insurance/name attributes; do not arbitrarily merge them or assign one insurer. Insurance breakdowns count roster entries unless driver identity is completely reconciled; keep filtered and unfiltered counts separate. Display truncation must be explicitly labeled; a requested full list must contain every selected entry, using an attachment if necessary.
- Current coverage dates, premiums, limits, policy validity, eligibility, historical membership and uninsured-driver lists are not established. Absence from this insured roster is not proof of being uninsured or no longer employed. No all-drivers-minus-feed complement, history reconstructed from hire date, GPS/on-road inference, or financial insurance calculation.

## Evidence, privacy and failures

State source URL, fetch-start and completion timestamps with timezone, `as_of` (retrieval completion), current-snapshot scope, exact requested filters, row count and CDL-identity coverage/duplicates, and complete bounded JSON validation (one array, no pagination). Retrieval time is not upstream sync time; no reliable source-updated timestamp is exposed.

DOB and CDL are sensitive even though the share is credential-free. Output names and insurance by default; include other personal fields only for an explicit relevant user need. Never commit raw business rows, PII examples, downloaded JSON, private report outputs or credentials to this public kit.

Network/deadline/size/status/content-type/JSON/schema failures mean unavailable/incomplete evidence and **unknown/null** results, never zero. No partial/cached/Supabase fallback. A successfully retrieved, fully validated empty array means zero entries in that snapshot only, not global absence proof.
