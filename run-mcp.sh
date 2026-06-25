#!/bin/bash
set -euo pipefail
cd /home/peakviker/bybit-mcp
exec node /home/peakviker/bybit-mcp/dist/index.js
