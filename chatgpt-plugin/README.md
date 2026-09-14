# Lightning Reporting ChatGPT Plugin

This directory packages the two parts of an OpenAI ChatGPT plugin:

- `skills/lightning-reporting/SKILL.md`: the reusable operating rules.
- `mcp-server/`: a TypeScript remote, read-only MCP server that retrieves canonical repository docs and proxies only the approved `agent-reporting` Edge Function.

## Security model

The server is deliberately a narrow gateway:

- It exposes document retrieval plus report catalog, metadata, and approved reporting calls—never raw Supabase tables or SQL.
- `AGENT_REPORTING_KEY` is a server-only deployment secret. Do not add it to a ChatGPT action, browser app, repository, prompt, or URL.
- Configure the hosted MCP endpoint with OAuth through the ChatGPT plugin connection. Restrict plugin access to authorized workspace users and issue a least-privilege agent-reporting key for this connector.
- The connector is read-only. Do not add mutation tools without a separate approval and threat-model review.

## Local verification

```bash
cd mcp-server
npm install
npm run build
npm test
AGENT_REPORTING_KEY=... npm run dev
```

Set `AGENT_REPORTING_KEY` through your shell or deployment-secret manager before starting the server. The service exposes Streamable HTTP at `/mcp` and `GET /health` on `PORT` (default `8000`). Use MCP Inspector with `http://localhost:8000/mcp`.

## Deployment and ChatGPT connection

1. Deploy `mcp-server/Dockerfile` from the repository root to a public HTTPS host.
2. Set `AGENT_REPORTING_KEY` as a host-managed secret. Set `AGENT_REPORTING_ENDPOINT` only if the Edge Function endpoint changes.
3. Protect the public MCP URL with an OAuth authorization server supported by OpenAI's plugin connection flow; do not use a shared bearer secret for ChatGPT users.
4. In ChatGPT, enable Developer mode, open `ChatGPT Plugins`, add the hosted `/mcp` connection, and test it with an authorized account. See `../docs/CHATGPT_PLUGIN_SETUP.md` for the current steps.
5. Verify `search`/`fetch` citations, a catalog call, metadata retrieval, an authorized report, invalid-filter rejection, sensitive-data restriction, and audit records before workspace publication.

The precise ChatGPT publishing UI is administered by OpenAI and may change; follow the current [OpenAI plugin quickstart](https://platform.openai.com/plugins/quickstart) and [MCP guide](https://platform.openai.com/docs/mcp) when connecting the deployed endpoint.
