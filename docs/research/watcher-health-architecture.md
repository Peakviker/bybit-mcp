# Watcher Health Architecture Research

Date: 2026-06-25
Project: `/home/peakviker/bybit-mcp`
Scope: documentation only

## Why this note exists

The current watcher already works, but the repo still lacks a first-class health model that tells an operator whether the process is merely alive or actually healthy. The goal of this research is to separate runtime liveness, ingestion freshness, delivery freshness, and error streaks into explicit state.

## Local evidence

Current watcher loop:
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts:17-19` runs a periodic cycle every 20s and also debounces websocket bursts.
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts:54-99` logs cycle completion/failure, but only into the JSONL event stream.
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts:110-147` wires websocket events, reconnects, and errors.

Current delivery state:
- `/home/peakviker/bybit-mcp/src/delivery_state.ts:6-23` stores only `lastDeliveredTs`.

Current evolution proposal already points in this direction:
- `/home/peakviker/bybit-mcp/docs/project-evolution-2026-06-25.md:84-99` proposes a health file, degraded-state alerts, startup self-checks, retention, and operator status scripts.

## Upstream patterns worth borrowing

Upstream `trading-mcp` gives useful production patterns, even though it is not watcher-specific:
- timeout-wrapped REST calls: `/tmp/trading-mcp/src/client/rest-client.ts:7-13,42-46,57-61,68-77,91-95`
- call-time env reads: `/tmp/trading-mcp/src/client/rest-client.ts:15-22`
- endpoint-aware rate limiting: `/tmp/trading-mcp/src/utils/rate-limiter.ts:1-4,16-21,42-59`
- persistent subscription lifecycle with reconnect and idle expiry: `/tmp/trading-mcp/src/client/subscription-manager.ts:29-31,62-132,228-244`

These are not health files directly, but they show the same principle: separate transport, freshness, and lifecycle concerns instead of burying them in one loop.

## Recommended health model

Use separate ledgers instead of a single opaque status blob.

1. Runtime liveness
   - Is the process or service still running?
   - Source: systemd user service and process supervision.

2. Ingestion freshness
   - When did the watcher last successfully build a snapshot?
   - Source: latest successful cycle timestamp.

3. Failure streak
   - How many consecutive cycles have failed?
   - Source: incremented only on failed cycles, reset on success.

4. Delivery freshness
   - When did an alert last successfully leave the watcher?
   - Source: delivery state file.

5. Data freshness by subsystem
   - last websocket event time
   - last timer cycle time
   - last successful bot detail fetch
   - last successful metrics computation

This separation matters because a process can be alive while one subsystem is stale.

## Recommended files

Keep the current runtime JSONL logs, but add a compact status file pair:

- `/home/peakviker/bybit-mcp/runtime/grid-risk-health.json`
- `/home/peakviker/bybit-mcp/runtime/alert-delivery-health.json`

Suggested fields for the watcher health file:
- `lastSuccessTs`
- `lastFailureTs`
- `consecutiveFailures`
- `lastError`
- `lastSnapshotTs`
- `lastCycleReason`
- `lastWsEventTs`
- `lastHealthyTs`
- `mode` (`healthy`, `degraded`, `stalled`)

Suggested thresholds:
- `degraded` after 1-2 consecutive failures
- `stalled` if no successful snapshot for a long enough SLA window
- never use one-off websocket disconnects alone as a hard failure if periodic timer cycles still succeed

## Health architecture recommendation

Best shape for this repo:

- Keep the watcher loop simple.
- Emit health state on every cycle success/failure.
- Make one small status script read health files and summarize them.
- Keep retention/pruning separate from health classification.

That avoids turning the watcher into a mini-orchestrator.

## Operator UX implication

A good operator should be able to answer these in one glance:
- is the process alive?
- is it current?
- is it failing repeatedly?
- are alerts being delivered?
- did the watcher recover after a stall?

## Recommendation

Implement health as separate state files and a small status script before adding any new watcher features.

Priority order:
1. watcher health JSON
2. delivery health JSON
3. `status_grid_risk_watcher` script
4. prune/retention helper
5. only then broader watcher expansion
