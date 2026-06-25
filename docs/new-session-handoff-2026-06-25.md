# Bybit Grid Risk Watcher — New Session Handoff

Date: 2026-06-25
Project root: `/home/peakviker/bybit-mcp`
Environment: `[MAINNET]`
Target bot: `624873434886723147`

## What is already running

### 1. Risk watcher service

Service name:
- `grid-risk-watcher.service`

Check status:
```bash
systemctl --user status grid-risk-watcher.service --no-pager
```

Restart:
```bash
systemctl --user restart grid-risk-watcher.service
```

Logs:
```bash
journalctl --user -u grid-risk-watcher.service -n 100 --no-pager
```

### 2. Hermes alert delivery cron

Cron job name:
- `bybit-grid-risk-delivery`

Check jobs:
```bash
hermes cron list
```

Behavior:
- every 1 minute Hermes runs `deliver_new_alerts.sh`
- if no new `WARN/CRITICAL` alert exists, nothing is delivered
- if a new alert exists, it is delivered to `origin`

## Core architecture

The feature is now implemented as:
- private WS source
- periodic 20-second snapshot cycle
- bot-layer state from `fgridbot/detail`
- metrics
- deltas
- rules
- formatted alerts
- stateful fan-out

## Important current fact

The system is operational even if Bybit does not emit useful grid lifecycle events on generic WS topics.

Why:
- watcher now triggers a full cycle every 20 seconds regardless of WS updates
- WS is still useful when real private updates arrive
- timer-driven monitoring is the guaranteed baseline

## Recent maintenance updates

Two safe refactors were completed after the initial watcher rollout:

- runtime and env absolute paths were centralized into `src/paths.ts`
- snapshot collection no longer hardcodes `BTCUSDT` for active orders; symbol is now derived from authoritative bot detail (`fgridbot/detail`)

Why this matters:
- fewer path constants are scattered across scripts and watcher modules
- snapshot logic is more robust if the monitored grid bot symbol changes

## Files you should know first

### Main docs
- `/home/peakviker/bybit-mcp/docs/grid-risk-watcher-end-to-end-guide.md`
- `/home/peakviker/bybit-mcp/docs/phase2-snapshot-result.md`
- `/home/peakviker/bybit-mcp/docs/phase3-risk-metrics-result.md`
- `/home/peakviker/bybit-mcp/docs/phase4-rule-engine-result.md`
- `/home/peakviker/bybit-mcp/docs/phase5-formatter-delivery-result.md`
- `/home/peakviker/bybit-mcp/docs/phase6-service-runtime-result.md`
- `/home/peakviker/bybit-mcp/docs/phase7-fanout-result.md`

### Main runtime files
- `/home/peakviker/bybit-mcp/runtime/grid-risk-watcher.jsonl`
- `/home/peakviker/bybit-mcp/runtime/grid-snapshots.jsonl`
- `/home/peakviker/bybit-mcp/runtime/risk-metrics.jsonl`
- `/home/peakviker/bybit-mcp/runtime/risk-deltas.jsonl`
- `/home/peakviker/bybit-mcp/runtime/risk-alerts.jsonl`
- `/home/peakviker/bybit-mcp/runtime/risk-alerts-formatted.log`
- `/home/peakviker/bybit-mcp/runtime/alert-delivery-state.json`

### Main code files
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts`
- `/home/peakviker/bybit-mcp/src/grid_snapshot.ts`
- `/home/peakviker/bybit-mcp/src/paths.ts`
- `/home/peakviker/bybit-mcp/src/risk_metrics.ts`
- `/home/peakviker/bybit-mcp/src/risk_delta.ts`
- `/home/peakviker/bybit-mcp/src/risk_rules.ts`
- `/home/peakviker/bybit-mcp/src/format_alert.ts`
- `/home/peakviker/bybit-mcp/src/alert_delivery.ts`
- `/home/peakviker/bybit-mcp/src/delivery_state.ts`

### Delivery scripts
- `/home/peakviker/bybit-mcp/scripts/show_latest_alert.ts`
- `/home/peakviker/bybit-mcp/scripts/emit_new_alerts.ts`
- `/home/peakviker/bybit-mcp/scripts/alert_stats.ts`
- `/home/peakviker/bybit-mcp/scripts/risk_metrics_stats.ts`
- `/home/peakviker/bybit-mcp/scripts/deliver_new_alerts.sh`
- `/home/peakviker/.hermes/scripts/deliver_new_alerts.sh`

### Operator / analytics scripts
- `/home/peakviker/bybit-mcp/scripts/alert_stats.ts`
  - alert count by severity/code/hour
  - detailed alert timeline
  - ASCII timeline with risk metrics next to each alert
- `/home/peakviker/bybit-mcp/scripts/risk_metrics_stats.ts`
  - full-history summary of `risk-metrics.jsonl`
  - latest snapshot
  - min/max/first/last/delta per metric
  - sparklines for recent samples
  - hourly rollup of risk profile
- `/home/peakviker/bybit-mcp/scripts/risk_dashboard.ts`
  - unified operator view across metrics, alerts, delivery state and latest formatted alert
  - latest risk snapshot + alert summary + hourly rollups in one JSON payload

## Quick sanity checks for a new session

### 1. Service is alive
```bash
systemctl --user status grid-risk-watcher.service --no-pager | head -15
```
Expected:
- `Active: active (running)`

### 2. Timer-based cycles still happen
```bash
tail -n 20 /home/peakviker/bybit-mcp/runtime/grid-risk-watcher.jsonl
```
Expected:
- repeated `risk cycle completed`
- `reason":"timer-20s"`

### 3. Delivery cron is still installed
```bash
hermes cron list
```
Expected:
- `bybit-grid-risk-delivery`
- schedule `every 1m`
- deliver `origin`

### 4. Alert fan-out gate works
```bash
cd /home/peakviker/bybit-mcp
npx tsx scripts/emit_new_alerts.ts WARN
```
Expected:
- `NO_NEW_ALERTS` if nothing new
- or JSON payload if new alerts exist

### 5. Operator statistics work
```bash
cd /home/peakviker/bybit-mcp
npx tsx scripts/alert_stats.ts
npx tsx scripts/risk_metrics_stats.ts
```
Expected:
- JSON summary for alert history
- JSON summary for full risk metrics history
- useful trend data even when new alerts are sparse

## Known constraints

### 1. Authoritative bot state is still `fgridbot/detail`

Generic endpoints remain incomplete for this bot:
- `positions`
- `openOrders`
- `strategyOrders`
may stay empty even when the bot is clearly active.

### 2. Browser/internal history route is not yet the base of the system

The watcher does not depend on hidden UI routes.
That track remains optional/future.

### 3. Current thresholds are intentionally conservative

This means the system may stay quiet for a long time if the bot remains within acceptable bounds.
This is expected.

## Best next actions in a future session

### If you want better alerts
- tune thresholds in `src/risk_rules.ts`
- add cooldown/hysteresis
- add more rule types

### If you want richer risk context
- extend snapshot with more bot/account fields
- compute more derived metrics
- add long-window rolling analytics

### If you want better operator visibility
- evolve toward a single dashboard script that combines alert history + full risk metrics history
- keep `alert_stats.ts` for alert-centric view
- keep `risk_metrics_stats.ts` for full-history metrics view

## Tested workflow notes

Controlled redelivery test was verified successfully.

Safe procedure:
- pause cron `bybit-grid-risk-delivery`
- rewind `runtime/alert-delivery-state.json` just below the target alert ts
- run `npx tsx scripts/emit_new_alerts.ts WARN`
- verify JSON replay of the expected alert
- restore `alert-delivery-state.json`
- resume cron
- verify `emit_new_alerts.ts WARN` returns `NO_NEW_ALERTS` again

This matters because active 1-minute cron otherwise races with manual redelivery tests.

Delivery troubleshooting rule:
- for `bybit-grid-risk-delivery`, prefer local runtime/log validation first
- do not send live Telegram diagnostic/test messages unless the user explicitly asks for a live delivery test

### If you want full historical bot lineage
- continue the deferred UI/internal route investigation
- but do not block the watcher on it

## One-line summary

At session start, the first thing to do is:
- confirm the service is running,
- confirm timer-20s cycles continue,
- then inspect `runtime/` files before touching any code.
