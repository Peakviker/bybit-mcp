#!/usr/bin/env bash
set -euo pipefail
cd /home/peakviker/bybit-mcp
export PATH="$HOME/.bun/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
exec /home/peakviker/bybit-mcp/node_modules/.bin/tsx src/grid_risk_watcher.ts
