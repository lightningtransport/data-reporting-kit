# Lightning reporting dashboard

Next.js App Router + shadcn/ui dashboard for settlement_summary. This is the deployable settlement screen for Grok Bot and Cursor agents.

## Local

```bash
cd apps/reporting-dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). v1 serves the embedded ≥3-month `settlement_summary` snapshot. If `AGENT_REPORTING_KEY` is set in the server environment, `getSettlementSummary()` fetches live windows instead.

## Vercel deploy

1. In the Vercel project, set **Root Directory** to `apps/reporting-dashboard` (Framework Preset: Next.js).
2. Do **not** put the agent key in git, `NEXT_PUBLIC_*`, or client code.
3. Optional live data (server only):
   - `AGENT_REPORTING_KEY` — assigned `x-agent-key` (Sensitive)
   - `AGENT_REPORTING_ENDPOINT` — defaults to the published `agent-reporting` URL
4. After the first production deploy, set `NEXT_PUBLIC_DASHBOARD_URL` to that production URL and record it in `docs/html-reporting.md`.
5. Deploy from this directory:

```bash
cd apps/reporting-dashboard
npx vercel --prod
```

Git integration also works: connecting this GitHub repo and using Root Directory `apps/reporting-dashboard` creates preview URLs on each PR and production on `main`.

## Grok / Cursor

When answering questions about this screen, **link the live dashboard URL**. Do not generate a replacement one-off HTML file. Keep UI changes in this app.
