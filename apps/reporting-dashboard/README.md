# Lightning reporting dashboard

Next.js App Router + shadcn/ui app for Grok Bot and Cursor agents. Views:

| Path | View | Data |
|---|---|---|
| `/` | Settlements | `settlements` + `fuel` (≥12 months) |
| `/out-schedule` | Out Schedule | `departures` union KPI + live Ninox Schedule_Teams-only planned table |
| `/trucks-return` | Trucks Return | `returns` (no Phone/CDL) |
| `/diesel` | Diesel | live `fuel` (focus month first; 12-month trend cached ~3 min) |

A top-right **Views** menu switches between them. Visible copy is English operational wording; kit evidence lives under **Technical details**. Each route has its own loading screen (Settlements / Out Schedule / Trucks Return / Diesel).

## Local

```bash
cd apps/reporting-dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires server-only `AGENT_REPORTING_KEY` for governed reports (live `agent-reporting` only; **no embedded snapshot**). The Out Schedule key must be authorized for `departures`, `driver_pay`, and `out_schedule` in addition to its existing reports. Without a key or either departure source, union KPIs show **Unavailable**, never a schedule-only total.

Out Schedule uses the same inclusive Monday–Sunday `Out Date` period in America/New_York for both sources. Selected and following weeks are distinct DriverPay + live Schedule_Teams truck unions with source counts, overlap, source-only counts and complete truck sets in Technical details. No return exclusions or team/solo formulas apply. Initial reports load server-side; calendar navigation uses the same-origin `/api/reporting/departures?out_from=YYYY-MM-DD&out_to=YYYY-MM-DD` route. That route validates an inclusive range of up to 31 days, rejects unknown/duplicate parameters, sends the key only in a server-side header, and never caches live results.

The planned table, search/owner/dispatch filters, export and day strip remain **Schedule_Teams-only**. They do not filter the combined KPIs. The exact public share URL retains `?locale=en&utcoffset=-240`; share and gateway fetches reject redirects, omit ambient credentials, cap streamed JSON at 5 MiB, and have a 20-second deadline. Planned rows can disappear; DriverPay sync freshness is unknown.

Verification: `npm test`, `npm run lint`, `npm run build`.

## Vercel deploy

1. In the Vercel project, set **Root Directory** to `apps/reporting-dashboard` (Framework Preset: Next.js).
2. Do **not** put the agent key in git, `NEXT_PUBLIC_*`, or client code.
3. Optional live data (server only):
   - `AGENT_REPORTING_KEY` — assigned `x-agent-key` (Sensitive)
   - `AGENT_REPORTING_ENDPOINT` — defaults to the published `agent-reporting` URL
4. Production is live at [https://lightning-settlement-dashboard.vercel.app](https://lightning-settlement-dashboard.vercel.app). Keep `NEXT_PUBLIC_DASHBOARD_URL` aligned with that host.
5. Deploy from this directory:

```bash
cd apps/reporting-dashboard
npx vercel --prod
```

Git integration also works: connecting this GitHub repo and using Root Directory `apps/reporting-dashboard` creates preview URLs on each PR and production on `main`.

## Grok / Cursor

Link the matching deep URL:

- Settlements: https://lightning-settlement-dashboard.vercel.app
- Out Schedule: https://lightning-settlement-dashboard.vercel.app/out-schedule
- Trucks Return: https://lightning-settlement-dashboard.vercel.app/trucks-return
- Diesel: https://lightning-settlement-dashboard.vercel.app/diesel

Do not generate a replacement one-off HTML file. Keep UI changes in this app.
