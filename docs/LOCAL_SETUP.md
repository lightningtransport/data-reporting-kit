# Local setup

## Requirements

- Node.js 22 LTS or newer
- A dedicated read-only `AGENT_REPORTING_KEY` supplied through the approved Supabase secret workflow

## Run

```bash
cd chatgpt-plugin/mcp-server
cp .env.example .env
# Set AGENT_REPORTING_KEY in the shell or a local ignored environment file.
npm install
npm run build
REPORTING_KNOWLEDGE_ROOT=../.. AGENT_REPORTING_KEY="$AGENT_REPORTING_KEY" npm run dev
```

The server listens on `http://localhost:8000`, exposes `GET /health`, and exposes MCP Streamable HTTP at `/mcp`.

## Test

```bash
curl -fsS http://localhost:8000/health
npx @modelcontextprotocol/inspector@latest
```

In MCP Inspector choose Streamable HTTP and enter `http://localhost:8000/mcp`. Initialize, inspect the tool schemas, and call `get_oos_trucks` with `{ "minHoursOOS": 0, "limit": 20 }`.

The Inspector call uses live reporting data and causes the upstream gateway's normal audit behavior. Do not paste the key into the URL or tool input.

