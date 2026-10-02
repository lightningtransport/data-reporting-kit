# Lightning Reporting ChatGPT Plugin

This directory packages the two parts of an OpenAI ChatGPT plugin:

- `skills/lightning-reporting/SKILL.md`: the reusable operating rules.
- `mcp-server/`: a remote, read-only MCP server that retrieves the canonical repository docs and proxies only the approved `agent-reporting` Edge Function.

## Security model

The server is deliberately a narrow gateway:

- It exposes document retrieval plus report catalog, metadata, and approved reporting calls—never raw Supabase tables or SQL.
- `AGENT_REPORTING_KEY` is a server-only deployment secret. Do not add it to a ChatGPT action, browser app, repository, prompt, or URL.
- ChatGPT users sign in with Google. The server runs FastMCP's OAuth proxy (with the dynamic client registration ChatGPT requires) and then admits only verified Google Workspace accounts in `ALLOWED_EMAIL_DOMAINS`, plus any address in `ALLOWED_EMAILS`. Everyone else is rejected before any tool runs. Without `GOOGLE_CLIENT_ID` the server refuses to start, except locally with `MCP_ALLOW_UNAUTHENTICATED=1`.
- Only ChatGPT's OAuth callback may register as a client (`ALLOWED_CLIENT_REDIRECT_URIS` overrides this for testing with another MCP client).
- The connector is read-only, and every tool carries `readOnlyHint`. Do not add mutation tools without a separate approval and threat-model review.

## Local verification

```bash
python3 -m unittest discover -s mcp-server/tests -v
cd mcp-server && AGENT_REPORTING_KEY=... MCP_ALLOW_UNAUTHENTICATED=1 uv run python src/server.py
```

The service exposes streamable HTTP at `/mcp` on `PORT` (default `8000`). `search`/`fetch` read the docs from the local checkout when present, otherwise from this repository's `main` branch on GitHub, so a deployment always answers with the current rules.

## Deployment on Vercel

The `mcp-server/` folder is a self-contained Vercel Python project (`app.py`, `pyproject.toml`, `vercel.json`).

1. **Google OAuth client.** Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → *Web application*. Authorized redirect URI: `https://<production-domain>/auth/callback`. Set the OAuth consent screen to *Internal* so only the company Workspace can sign in.
2. **Vercel project.** New project from this repository with **Root Directory** `chatgpt-plugin/mcp-server`. Add **Upstash Redis** from the Vercel Marketplace to the project (it sets `REDIS_URL`).
3. **Environment variables** (Production): `AGENT_REPORTING_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL_DOMAINS`, `STORAGE_ENCRYPTION_KEY`, `JWT_SIGNING_KEY`, and `PUBLIC_BASE_URL` if a custom domain is used. See `mcp-server/.env.example` for how to generate each one.
4. Deploy, then check `https://<domain>/.well-known/oauth-protected-resource/mcp` returns JSON and `POST /mcp` without a token returns `401`.

`mcp-server/Dockerfile` remains available for container hosts; it needs the same environment variables.

## Connecting it in ChatGPT

- **Personal test (Plus/Pro):** Settings → Apps → Advanced settings → enable Developer mode → Create app → URL `https://<domain>/mcp`, authentication OAuth → sign in with an allowed Google account.
- **Team (Business):** a developer-mode app on a personal plan cannot be shared to another workspace. A Business workspace admin enables custom apps, creates the app with the same `https://<domain>/mcp` URL, adds `skills/lightning-reporting/SKILL.md` as its instructions, tests it as a draft, and publishes it to the approved group.

Before publishing, verify `search`/`fetch` citations, a catalog call, metadata retrieval, an authorized report, invalid-filter rejection, a denied non-Workspace account, sensitive-data restriction, and audit records.

The ChatGPT publishing UI is administered by OpenAI and may change; follow the current [OpenAI MCP guide](https://platform.openai.com/docs/mcp) when connecting the deployed endpoint.
