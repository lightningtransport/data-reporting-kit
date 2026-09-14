FROM node:22-alpine

WORKDIR /app
COPY chatgpt-plugin/mcp-server/package*.json ./
RUN npm ci
COPY chatgpt-plugin/mcp-server/tsconfig.json ./
COPY chatgpt-plugin/mcp-server/src ./src
COPY docs ./docs
COPY api ./api
COPY AGENTS.md ./
RUN npm run build && npm prune --omit=dev

USER node
EXPOSE 8000
CMD ["node", "dist/server.js"]
