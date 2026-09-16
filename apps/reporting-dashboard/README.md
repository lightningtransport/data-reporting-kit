# Lightning reporting dashboard

Next.js App Router + shadcn/ui app for Grok Bot and Cursor agents. Views:

| Path | View | Data |
|---|---|---|
| `/` | Liquidaciones | `settlements` + `fuel` (≥12 months) |
| `/out-schedule` | Out Schedule | live Ninox Schedule_Teams share |
| `/trucks-return` | Trucks Return | `returns` (no Phone/CDL) |
| `/diesel` | Diesel | live `fuel` (≥12 months), month + owner filters |

A top-right **Vistas** menu switches between them. Visible copy is Spanish operational wording where applicable; kit evidence lives under **Datos técnicos**.

## Local

```bash
cd apps/reporting-dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires server-only `AGENT_REPORTING_KEY` for Liquidaciones, Trucks Return, and Diesel (live `agent-reporting` only; **no embedded snapshot**). Out Schedule always uses the public Schedule_Teams share live. Without the key, those three views show an explicit configuration error.

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

- Liquidaciones: https://lightning-settlement-dashboard.vercel.app
- Out Schedule: https://lightning-settlement-dashboard.vercel.app/out-schedule
- Trucks Return: https://lightning-settlement-dashboard.vercel.app/trucks-return
- Diesel: https://lightning-settlement-dashboard.vercel.app/diesel

Do not generate a replacement one-off HTML file. Keep UI changes in this app.
