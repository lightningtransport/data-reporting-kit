# Authentication

## Development

Run locally with `NODE_ENV=development` and `MCP_AUTH_MODE=development`. This bypass is only for localhost or a private development tunnel. The upstream `AGENT_REPORTING_KEY` is still required and remains server-side.

Do not expose development mode on a public hostname.

## Production

Use an established OAuth 2.1/OIDC provider. The MCP server expects:

- `MCP_AUTH_MODE=oauth`;
- `OAUTH_ISSUER`;
- `OAUTH_AUDIENCE` equal to the canonical MCP resource;
- `OAUTH_JWKS_URL`;
- a token containing `sub`, matching issuer/audience, expiry, and the `reporting:read` scope.

The server publishes `/.well-known/oauth-protected-resource` and returns a `WWW-Authenticate` challenge. Configure the provider for authorization-code + PKCE `S256`, preserve the MCP `resource` parameter, publish discovery metadata, and allow the redirect URI shown by ChatGPT for the connection.

The current P0 maps every authenticated user to the same least-privilege reporting principal at the upstream gateway. Before multi-role production use, map the verified user identity to Lightning permissions and separate agent-reporting principals or a user-aware gateway. Never put `AGENT_REPORTING_KEY` in OAuth claims, tool inputs, URLs, browser code, logs, or plugin files.

## Access boundaries

The MCP cannot execute SQL or mutate data. The upstream gateway enforces report allowlists, sensitive-field policy, tenant scope, strict filters, and audit behavior. The MCP does not use `reporting-query`, which remains a separate paused membership flow.

