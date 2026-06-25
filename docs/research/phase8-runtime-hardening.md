# Phase 8 Research: Runtime Hardening

Date: 2026-06-25
Scope: documentation/plan only, no runtime changes applied

## Goal

Turn the current working watcher into an observable runtime component that can distinguish:
- service alive and healthy
- service alive but logic degraded
- service unable to collect fresh data
- delivery path lagging behind generated alerts

## Sources

URLs:
- `https://github.com/bybit-exchange/trading-mcp/tree/main`
- `https://raw.githubusercontent.com/bybit-exchange/trading-mcp/main/README.md`
- `https://bybit-exchange.github.io/docs/v5/intro`
- `https://bybit-exchange.github.io/docs/v5/guide`

Local inspected files:
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts`
- `/home/peakviker/bybit-mcp/src/persist.ts`
- `/home/peakviker/bybit-mcp/src/grid_snapshot.ts`
- `/home/peakviker/bybit-mcp/src/alert_delivery.ts`
- `/home/peakviker/bybit-mcp/src/delivery_state.ts`
- `/home/peakviker/bybit-mcp/src/paths.ts`
- `/home/peakviker/bybit-mcp/scripts/deliver_new_alerts.sh`
- `/home/peakviker/bybit-mcp/docs/project-evolution-2026-06-25.md`

Upstream reference patterns:
- `/tmp/trading-mcp/src/client/subscription-manager.ts`
- `/tmp/trading-mcp/src/client/rest-client.ts`

## Current runtime weaknesses

Observed in the current local code:
1. `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts` logs cycle success/failure into `runtime/grid-risk-watcher.jsonl`, but there is no machine-friendly health summary file.
2. `/home/peakviker/bybit-mcp/src/persist.ts` only appends JSONL and does not help with health, retention, or atomic state updates.
3. There is no explicit `consecutiveFailures` state.
4. There is no distinction between:
   - websocket connected but snapshot logic failing
   - snapshot succeeding but delivery lagging
   - runtime files growing forever
5. `/home/peakviker/bybit-mcp/scripts/deliver_new_alerts.sh` assumes `emit_new_alerts.ts` is enough for delivery, but there is no separate health evidence for the delivery path.

## Proposed runtime artifacts

### 1. Health ledger file

Proposed file:
- `/home/peakviker/bybit-mcp/runtime/grid-risk-health.json`

Purpose:
- latest compact truth for humans, scripts, and future agents
- single-file source for “is the watcher actually healthy?”

Proposed schema:

```json
{
  "botId": "624873434886723147",
  "service": "grid-risk-watcher.service",
  "version": 1,
  "startedAt": 0,
  "lastCycleStartedAt": 0,
  "lastCycleFinishedAt": 0,
  "lastSuccessTs": 0,
  "lastFailureTs": 0,
  "lastWsEventTs": 0,
  "lastSnapshotTs": 0,
  "lastAlertTs": 0,
  "lastDeliveryCheckTs": 0,
  "consecutiveFailures": 0,
  "consecutiveDeliveryNoops": 0,
  "lastReason": "timer-20s",
  "lastTopics": ["position", "order"],
  "lastError": null,
  "lastErrorKind": null,
  "lastFormattedAlertPath": null,
  "runtimeStatus": "healthy",
  "deliveryStatus": "unknown"
}
```

Suggested enums:
- `runtimeStatus`: `healthy | warn | degraded | failed`
- `deliveryStatus`: `unknown | healthy | idle | lagging | failed`
- `lastErrorKind`: `auth | timeout | http | bybit_api | parse | persist | ws | unknown`

### 2. Delivery health ledger

Proposed file:
- `/home/peakviker/bybit-mcp/runtime/grid-risk-delivery-health.json`

Purpose:
- separate watcher generation health from downstream alert-delivery health
- avoid mixing runtime collection failures with delivery quiet periods

Suggested minimal schema:

```json
{
  "version": 1,
  "lastRunTs": 0,
  "lastDeliveredTs": 0,
  "lastSeenAlertTs": 0,
  "lastOutcome": "noop",
  "lastError": null,
  "pendingAlertCountEstimate": 0
}
```

## Proposed code/file targets for a future implementation

Create:
- `/home/peakviker/bybit-mcp/src/runtime_health.ts`
- `/home/peakviker/bybit-mcp/src/runtime_retention.ts`
- `/home/peakviker/bybit-mcp/scripts/status_grid_risk_watcher.ts`
- `/home/peakviker/bybit-mcp/scripts/check_runtime_health.ts`
- `/home/peakviker/bybit-mcp/scripts/prune_runtime.ts`

Modify:
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts`
- `/home/peakviker/bybit-mcp/src/persist.ts`
- `/home/peakviker/bybit-mcp/scripts/deliver_new_alerts.sh`

Keep unchanged in Phase 8 unless required:
- `/home/peakviker/bybit-mcp/src/risk_rules.ts`
- `/home/peakviker/bybit-mcp/src/format_alert.ts`

## Runtime semantics to introduce

### Success semantics

On every successful cycle:
- update `lastCycleStartedAt` at cycle entry
- update `lastCycleFinishedAt` at cycle exit
- set `lastSuccessTs`
- reset `consecutiveFailures` to `0`
- set `lastSnapshotTs`
- update `lastTopics`
- if alerts exist, set `lastAlertTs`
- set `runtimeStatus` to `healthy` unless a separate stale-data check says otherwise

### Failure semantics

On every failed cycle:
- set `lastFailureTs`
- increment `consecutiveFailures`
- classify `lastErrorKind`
- preserve prior `lastSuccessTs`
- set `runtimeStatus` by threshold

Suggested thresholds:
- 1 failure: `warn`
- 2-3 consecutive failures: `degraded`
- 4+ consecutive failures: `failed`

### Staleness semantics

Even without explicit errors, mark degraded if:
- `now - lastSuccessTs > 2 * PERIODIC_CYCLE_MS`
- or websocket events continue but snapshots stop updating
- or formatted alerts exist but delivery health remains stale

## Retention and file growth policy

Current append-only files observed:
- `/home/peakviker/bybit-mcp/runtime/grid-risk-watcher.jsonl`
- `/home/peakviker/bybit-mcp/runtime/grid-snapshots.jsonl`
- `/home/peakviker/bybit-mcp/runtime/risk-metrics.jsonl`
- `/home/peakviker/bybit-mcp/runtime/risk-deltas.jsonl`
- `/home/peakviker/bybit-mcp/runtime/risk-alerts.jsonl`
- `/home/peakviker/bybit-mcp/runtime/risk-alerts-formatted.log`
- `/home/peakviker/bybit-mcp/runtime/alert-delivery-state.json`

Suggested retention policy:
- keep raw snapshots/metrics/deltas for 7 days
- keep watcher lifecycle log for 14 days
- keep formatted alerts for 30 days or rotate by size
- keep health JSON files unrotated, overwritten atomically

Suggested rotation strategy:
- Phase 8 should prefer explicit pruning script over in-loop auto-deletion
- prune by line age or file mtime, not by arbitrary line count alone

## Operator commands to standardize later

Suggested future commands:
- `node_modules/.bin/tsx scripts/status_grid_risk_watcher.ts`
- `node_modules/.bin/tsx scripts/check_runtime_health.ts`
- `node_modules/.bin/tsx scripts/prune_runtime.ts --dry-run`

Expected outputs:
- concise health summary for humans
- non-zero exit code only for real degraded/failed states
- file age and latest timestamps shown explicitly

## Acceptance criteria for a future implementation

Phase 8 should be considered complete when all are true:
1. A single JSON health file answers watcher freshness, failure streak, and last error.
2. A second health file answers delivery freshness.
3. A status script can explain the latest state without opening JSONL files manually.
4. A prune script can report and clean stale runtime artifacts.
5. The watcher can be “service alive but degraded” without being invisible.
6. No runtime behavior change is required in the rule engine to gain observability.

## Risks

1. Overloading the watcher loop with too many side responsibilities.
   - Mitigation: keep health updates small and synchronous; put retention into a separate script.
2. Health status flapping on transient failures.
   - Mitigation: use `consecutiveFailures` thresholds, not one-off failures alone.
3. Mixing watcher and delivery state into one file.
   - Mitigation: keep separate ledgers.

## Recommendation

Recommendation: implement Phase 8 before any wider MCP/API expansion.

Most important concrete next step:
- add `/home/peakviker/bybit-mcp/runtime/grid-risk-health.json` plus `/home/peakviker/bybit-mcp/scripts/status_grid_risk_watcher.ts`

Reason:
- the current watcher already produces useful data, but it is still too easy to have a live process with quiet failure modes.
- stronger runtime evidence will improve every later phase, including client refactors and alert intelligence.