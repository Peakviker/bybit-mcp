# Development Guide

## Repo layout

- `src/` — core MCP server and risk watcher logic
- `scripts/` — operator and analytics scripts
- `deploy/` — service definitions and deploy-facing artifacts
- `docs/` — handoff, research, and operator documentation
- `.env.example` — minimal required environment contract

## Local setup

```bash
cd /home/peakviker/bybit-mcp
npm install
cp .env.example .env
npm run check
npm run build
```

## Environment

Minimum local variables:

```bash
BYBIT_API_KEY=
BYBIT_API_SECRET=
BYBIT_TESTNET=false
BYBIT_RECV_WINDOW=5000
```

Do not commit `.env`. Keep `.env.example` as the only tracked env template.

## Validation

Fast validation loop:

```bash
npm run check
npm run build
```

For MCP startup validation:

```bash
node dist/index.js
# or
/home/peakviker/bybit-mcp/run-mcp.sh
```

## Operational notes

- `runtime/` is intentionally excluded from git and should stay machine-local.
- `dist/` is build output and should be recreated locally or in CI.
- Existing runtime/service docs are part of the project knowledge base and should be updated, not replaced casually.

## Near-term structuring targets

- stabilize runtime health checks and watcher boundaries
- isolate bot-layer client abstractions
- formalize analytics scripts into reusable operator tooling
- add tests around pure risk computation modules where practical
