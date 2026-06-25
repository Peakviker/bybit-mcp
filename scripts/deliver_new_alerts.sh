#!/usr/bin/env bash
set -euo pipefail
cd /home/peakviker/bybit-mcp
export PATH="$HOME/.bun/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
output=$( /home/peakviker/bybit-mcp/node_modules/.bin/tsx scripts/emit_new_alerts.ts WARN )
if [ "$output" = "NO_NEW_ALERTS" ]; then
  exit 0
fi
printf '%s\n' "$output"
