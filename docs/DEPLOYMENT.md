# Deployment

## Recommended P0 host

Use a persistent container service such as Render. It supports a long-running Node process, HTTPS, managed secrets, health checks, and Streamable HTTP. Any equivalent container host is acceptable if it preserves streaming and does not buffer MCP responses.

## Render configuration

Create a Web Service from this repository:

- Root directory: repository root
- Build command: `cd chatgpt-plugin/mcp-server && npm ci && npm run build`
- Start command: `cd chatgpt-plugin/mcp-server && npm start`
- Health check path: `/health`
- Port: `8000` (or the host-provided `PORT`)

Set secrets/configuration in the host, never in Git:

- `AGENT_REPORTING_KEY` — dedicated least-privilege upstream key
- `AGENT_REPORTING_ENDPOINT` — normally the documented Supabase Edge Function URL
- `NODE_ENV=production`
- `MCP_AUTH_MODE=oauth`
- `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_JWKS_URL`
- optional timeout/rate/page settings from `.env.example`

The resulting endpoint must be a stable HTTPS URL ending in `/mcp`, for example `https://lightning-reporting.example.com/mcp`. Do not claim a live URL until the host has actually been provisioned.

## Docker

```bash
docker build -f chatgpt-plugin/mcp-server/Dockerfile -t lightning-reporting-mcp .
docker run --rm -p 8000:8000 \
  -e NODE_ENV=production \
  -e MCP_AUTH_MODE=oauth \
  -e AGENT_REPORTING_KEY \
  -e OAUTH_ISSUER -e OAUTH_AUDIENCE -e OAUTH_JWKS_URL \
  lightning-reporting-mcp
```

The container must not contain `.env`, secrets, or a database credential. Configure TLS and OAuth at the service or a trusted proxy, and make sure the proxy supports POST/GET/DELETE for `/mcp`, preserves authorization headers, and does not buffer responses.

## Troubleshooting

- `500` at startup in production: OAuth variables are missing or development auth is still selected.
- `401`: inspect protected-resource metadata, issuer/audience, JWKS, scopes, and the OAuth redirect allowlist.
- `503`/`504`: inspect host egress, upstream gateway availability, and timeout settings.
- Missing or stale tools: restart/refresh the ChatGPT MCP connection after metadata changes.

