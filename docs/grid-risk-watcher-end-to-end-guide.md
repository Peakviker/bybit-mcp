# Bybit Grid Bot Real-Time Risk Watcher — End-to-End Development Guide

Date: 2026-06-25
Project root: `/home/peakviker/bybit-mcp`
Target bot: `624873434886723147`
Environment: `[MAINNET]`

## 1. Purpose of the feature

This feature was built to monitor a running Bybit Futures Grid Bot in near real time and estimate strategy risk continuously.

The original operational goal was not to reconstruct perfect historical bot lineage first, but to answer a more useful runtime question:

- when the bot changes state,
- or even when the market changes while the bot remains open,
- can we recompute risk fast enough to decide whether the strategy remains healthy?

This led to an architecture based on:
- live private WebSocket subscriptions,
- repeated authoritative bot snapshots via `fgridbot/detail`,
- derived risk metrics,
- deltas between successive snapshots,
- rules that decide whether a state transition is worth surfacing.

## 2. High-level architecture

The watcher stack is built from seven layers.

### Layer A — Credentials and runtime environment

Files:
- `src/env.ts`
- `/home/peakviker/bybit-official-mcp/.env`

Responsibility:
- load Bybit key/secret and environment flags
- normalize `BYBIT_TESTNET`, `BYBIT_ENV`, `BYBIT_RECV_WINDOW`
- provide a single source of truth to all scripts

### Layer B — Raw Bybit connectivity

Files:
- `src/bybit_client.ts`
- `src/ws_probe.ts`

Responsibility:
- signed REST requests to bot-layer endpoints
- authenticated private WebSocket subscription
- proof that `v5Private` can subscribe to:
  - `order`
  - `execution`
  - `position`
  - `wallet`

### Layer C — Bot snapshot collection

Files:
- `src/grid_snapshot.ts`
- `scripts/collect_grid_snapshot.ts`

Responsibility:
- build an authoritative runtime snapshot of the bot state
- collect:
  - `fgridbot/detail`
  - wallet snapshot
  - generic positions
  - active orders
  - strategy child orders

### Layer D — Persistence

Files:
- `src/persist.ts`
- runtime JSONL files in `runtime/`

Responsibility:
- store every important state transition as append-only JSONL
- enable later replay/debugging without relying on chat memory

### Layer E — Risk computation

Files:
- `src/risk_metrics.ts`
- `src/risk_delta.ts`
- `scripts/compute_risk_metrics.ts`

Responsibility:
- convert snapshots into normalized metrics
- compare consecutive states and calculate deltas

### Layer F — Rule engine

Files:
- `src/risk_rules.ts`
- `scripts/evaluate_risk.ts`

Responsibility:
- decide whether the current state should emit:
  - `INFO`
  - `WARN`
  - `CRITICAL`

### Layer G — Delivery and runtime orchestration

Files:
- `src/format_alert.ts`
- `src/alert_delivery.ts`
- `src/delivery_state.ts`
- `src/grid_risk_watcher.ts`
- `scripts/show_latest_alert.ts`
- `scripts/emit_new_alerts.ts`
- `scripts/run_grid_risk_watcher.sh`
- `deploy/grid-risk-watcher.service`

Responsibility:
- keep watcher running continuously
- coalesce incoming events
- trigger periodic cycles every 20 seconds
- emit formatted alerts only when needed
- keep delivery idempotent

## 3. Why the architecture pivoted away from browser-first reverse-engineering

At one point, we attempted to prepare a browser-based reverse-engineering path for Bybit UI history extraction.

This path was deprioritized as the foundation because:
- full bot history was not required to start real-time monitoring
- private WS + `fgridbot/detail` already provided operationally useful observability
- browser dependency created infrastructure drag:
  - gstack browse build
  - `bun` installation
  - Playwright Chromium install
  - disk space constraints
- UI/internal endpoint scraping is fragile compared to official WS/REST runtime signals

Result:
- UI reverse-engineering remains a valid forensic/future track
- it is explicitly not a blocker for the watcher stack

## 4. What was discovered about Bybit data surfaces

### 4.1 The good news

The write-capable key/secret pair is valid.

Confirmed working:
- `account/info`
- `wallet-balance`
- `fgridbot/detail`
- private WS connection to `v5Private`
- private WS subscribe response for `order,execution,position,wallet`

### 4.2 The bad news

Even with the correct write-capable key:
- `strategyList(strategyId=botId)` returned empty list
- `strategyOrderList(strategyId=botId)` returned empty list
- generic `order history`, `execution history`, `closed pnl` remained empty for the bot context
- generic `positions`, `openOrders`, `strategyOrders` often remained empty while `fgridbot/detail` clearly showed non-zero bot exposure

### 4.3 Architectural conclusion

`fgridbot/detail` is the authoritative bot-layer runtime state.

The generic account-layer endpoints are insufficient to describe the live grid bot in a way that is useful for full strategy introspection.

Therefore v1 risk monitoring relies primarily on:
- `fgridbot/detail`
- repeated snapshots
- live private WS connectivity

## 5. Development phases that were implemented

## Phase 1 — WebSocket proof

Implemented files:
- `src/ws_probe.ts`
- `docs/ws-topic-observation.md`

Goal:
- prove that private WS auth works
- prove subscription works
- create a durable runtime probe log

Observed result:
- open connection on `v5Private`
- subscribe response `success=true`
- heartbeat stream every 30 seconds

Why it mattered:
- Phase 1 removed the biggest uncertainty: whether event source was viable at all

## Phase 2 — Snapshot collector

Implemented files:
- `src/bybit_client.ts`
- `src/grid_snapshot.ts`
- `src/persist.ts`
- `scripts/collect_grid_snapshot.ts`
- `docs/phase2-snapshot-result.md`

Goal:
- get a single source of bot truth at any point in time

Observed result:
- real snapshots persisted successfully
- bot-layer values came through clearly
- generic order/position strategy surfaces stayed sparse or empty

Why it mattered:
- enabled deterministic risk computation from a single runtime state

## Phase 3 — Metrics and deltas

Implemented files:
- `src/risk_metrics.ts`
- `src/risk_delta.ts`
- `scripts/compute_risk_metrics.ts`
- `docs/phase3-risk-metrics-result.md`

Goal:
- convert raw snapshot into strategy-level risk numbers
- compare consecutive states

Computed fields include:
- `netPnl`
- `gridProfit`
- `directionalDrag`
- `reserveRatio`
- `liqBufferPct`
- `distanceToLowerBandPct`
- `distanceToUpperBandPct`
- `activeRangeWidthPct`
- `positionSize`
- `equity`
- `arbitrageNum`

Why it mattered:
- transformed Bybit payloads into numbers that can drive rules and alerts

## Phase 4 — Rule engine

Implemented files:
- `src/risk_rules.ts`
- `src/grid_risk_watcher.ts`
- `scripts/evaluate_risk.ts`
- `docs/phase4-rule-engine-result.md`

Goal:
- decide when the system should remain quiet
- decide when the system should alert

Implemented rule categories:
- reserve ratio high / critical
- liquidation buffer thin / critical
- directional drag worsening
- equity drop
- long inventory increase near lower band
- arbitrage count increment

Why it mattered:
- transformed metrics into operational signals

## Phase 5 — Human-readable delivery

Implemented files:
- `src/format_alert.ts`
- `src/alert_delivery.ts`
- `scripts/show_latest_alert.ts`
- `docs/phase5-formatter-delivery-result.md`

Goal:
- make alerts readable by a human without inspecting raw JSON

Why it mattered:
- the watcher became actionable, not merely observable

## Phase 6 — Long-lived service runtime

Implemented files:
- `scripts/run_grid_risk_watcher.sh`
- `deploy/grid-risk-watcher.service`
- `docs/phase6-service-runtime-result.md`

Goal:
- move from chat-bound/manual process to a durable user-level service

Why it mattered:
- watcher now survives beyond the current terminal conversation

## Phase 7 — Stateful fan-out adapter

Implemented files:
- `src/delivery_state.ts`
- `scripts/emit_new_alerts.ts`
- `docs/phase7-fanout-result.md`

Goal:
- emit only new alerts
- support future channel integrations without changing watcher core

Why it mattered:
- delivery became idempotent and channel-agnostic

## 6. End-to-end runtime workflow

This is the actual runtime pipeline.

### Step 1 — Service boot

`systemd --user` launches:
- `scripts/run_grid_risk_watcher.sh`
- which launches `src/grid_risk_watcher.ts`

### Step 2 — Private WS connect

The watcher:
- loads env
- creates `WebsocketClient`
- opens `v5Private`
- subscribes to:
  - `order`
  - `execution`
  - `position`
  - `wallet`

### Step 3 — Trigger sources

A risk cycle can start from two triggers:

1. event-driven
- if a private WS update arrives
- event topics are coalesced for a short debounce window
- reason becomes `ws-event-burst`

2. timer-driven
- every 20 seconds
- reason becomes `timer-20s`

This timer-driven path was added deliberately after observing that real private WS connectivity was healthy, but live grid activity did not necessarily produce immediately useful generic topic updates during the observation windows. The timer path guarantees a minimum monitoring cadence even when WS stays quiet.

### Step 4 — Snapshot collection

The watcher collects:
- `fgridbot/detail`
- wallet snapshot
- generic positions
- generic open orders
- strategy order list

Snapshot persists to:
- `runtime/grid-snapshots.jsonl`

### Step 5 — Metric computation

Snapshot becomes normalized metrics.

Metrics persist to:
- `runtime/risk-metrics.jsonl`

### Step 6 — Delta computation

The current metrics are compared with the previous cycle.

Deltas persist to:
- `runtime/risk-deltas.jsonl`

### Step 7 — Rule evaluation

The rule engine decides whether any conditions cross thresholds.

Raw alerts persist to:
- `runtime/risk-alerts.jsonl`

### Step 8 — Human formatting

If alerts exist:
- formatted human-readable text is generated
- appended to:
  - `runtime/risk-alerts-formatted.log`

### Step 9 — Fan-out gate

A separate delivery adapter can read:
- `risk-alerts.jsonl`
- compare against `alert-delivery-state.json`
- emit only new alerts

This allows Telegram/Hermes/webhook integrations later.

## 7. Important mistakes that were made and how they were solved

### Mistake 1 — Wrong key / secret pairing

Symptom:
- all private calls returned `retCode=10004 Error sign`

Root cause:
- the new write-capable key was paired with the old secret

Fix:
- recovered the correct secret from past Hermes session history
- updated `/home/peakviker/bybit-official-mcp/.env`

Lesson:
- distinguish authentication/signature failures from true API-scope limits

### Mistake 2 — Assuming `bybit-official` tool surface was directly exposed here

Symptom:
- direct tool calls kept hitting the local reduced `bybit-mcp` surface

Root cause:
- active tool schema in this session did not expose all official MCP tools directly

Fix:
- validated actual server/tool surface separately
- used local project-level runtime and direct SDK calls where necessary

Lesson:
- do not confuse “server installed” with “tools directly exposed in current tool schema”

### Mistake 3 — Browser-first path before proving event viability

Symptom:
- time lost on browse setup and Playwright runtime under severe disk pressure

Root cause:
- reverse-engineering was being treated as prerequisite instead of optional track

Fix:
- pivoted architecture to WS + snapshot based monitoring first

Lesson:
- prove the cheapest viable runtime signal before investing in UI scraping

### Mistake 4 — `recv_window` vs `recvWindow`

Symptom:
- TypeScript check failed for WS client options

Root cause:
- wrong option name used for `WebsocketClient`

Fix:
- changed to `recvWindow`

Lesson:
- REST and WS config surfaces in SDKs are not always identical

### Mistake 5 — Wrong `subscribeV5` usage for private topics

Symptom:
- TS contract mismatch and wrong category usage assumptions

Root cause:
- private topic subscription shape was not matched correctly

Fix:
- used `subscribeV5([...topics], 'private', true)`

Lesson:
- private WS category handling must follow the SDK contract, not guessed strings

### Mistake 6 — EventEmitter typing friction

Symptom:
- `ws.on(...)` produced TypeScript issues on specific events

Root cause:
- event overload typing from `bybit-api` was narrower than what runtime actually emits

Fix:
- casted to `EventEmitter` for listener registration while keeping payload handling narrow

Lesson:
- runtime-correctness and type-surface neatness sometimes diverge in evented SDKs

### Mistake 7 — `npx` not found under systemd

Symptom:
- service restart loop with `status=127`

Root cause:
- `npx` was not present in service PATH

Fix:
- switched launch script to direct local binary:
  - `node_modules/.bin/tsx`

Lesson:
- service runtime should avoid shell convenience tools when a direct binary path exists

### Mistake 8 — `tsx` shebang could not find `node`

Symptom:
- `/usr/bin/env: 'node': No such file or directory`

Root cause:
- `tsx` uses `#!/usr/bin/env node`
- systemd PATH lacked `~/.local/bin`

Fix:
- added `~/.local/bin` to PATH in script and unit

Lesson:
- systemd PATH is much narrower than interactive shell PATH

### Mistake 9 — Browser build/runtime under disk pressure

Symptom:
- `ENOSPC` during gstack browse setup and Playwright install

Root cause:
- root filesystem nearly full
- browser toolchain is heavy

Fix:
- removed redundant `claude` binaries and Electron runtime where appropriate
- restored Electron later because Hermes Desktop is required by the user
- browser track deprioritized again

Lesson:
- disk pressure is part of architecture choice, not just an operational nuisance

## 8. Important runtime nodes and how each works

### Node: `env.ts`
Loads Bybit credentials and normalizes runtime flags.
Failure mode:
- missing key/secret

### Node: `bybit_client.ts`
Provides REST client and signed bot POST helper.
Failure mode:
- signature mismatches
- wrong environment

### Node: `grid_snapshot.ts`
Builds bot snapshot from bot-layer + generic layer.
Failure mode:
- generic layer sparse, but bot-layer still usable

### Node: `risk_metrics.ts`
Normalizes raw snapshot into actionable numeric state.
Failure mode:
- malformed/missing numeric fields → handled as `null`

### Node: `risk_delta.ts`
Compares current vs previous metrics.
Failure mode:
- first cycle has no prior state → baseline only

### Node: `risk_rules.ts`
Applies threshold logic.
Failure mode:
- no deltas or no breached thresholds → silent by design

### Node: `format_alert.ts`
Turns alert object into human-readable message.
Failure mode:
- no alerts → no formatted output

### Node: `alert_delivery.ts`
Appends formatted alerts to log file.
Failure mode:
- no alerts → no-op

### Node: `delivery_state.ts`
Tracks last delivered alert timestamp.
Failure mode:
- corrupt/missing state file resets to zero safely

### Node: `grid_risk_watcher.ts`
Core orchestrator.
Responsibility:
- subscribe WS
- trigger cycles
- collect snapshot
- compute metrics
- compute deltas
- run rules
- persist outputs

### Node: `emit_new_alerts.ts`
Idempotent fan-out gate.
Responsibility:
- output only alerts newer than delivery state

## 9. Current runtime files and their meaning

- `runtime/ws-probe.jsonl`
  - raw proof that private WS connectivity works
- `runtime/grid-risk-watcher.jsonl`
  - watcher lifecycle and cycle summaries
- `runtime/grid-snapshots.jsonl`
  - bot snapshots over time
- `runtime/risk-metrics.jsonl`
  - normalized risk state over time
- `runtime/risk-deltas.jsonl`
  - state transitions between cycles
- `runtime/risk-alerts.jsonl`
  - raw alerts
- `runtime/risk-alerts-formatted.log`
  - human-readable alerts
- `runtime/alert-delivery-state.json`
  - last delivered alert checkpoint

## 10. What problems may still happen in the future

### Problem A — No meaningful WS trade events arrive

Possible cause:
- grid bot changes are not surfaced via generic private topics

Current mitigation:
- periodic timer-based snapshots every 20 seconds already work

Future plan:
- keep WS as opportunistic trigger source
- treat timer snapshot as the guaranteed floor
- optionally resume UI/internal endpoint investigation if necessary

### Problem B — Alert noise after threshold tuning

Possible cause:
- thresholds too tight
- tiny market fluctuations trigger too many warnings

Future plan:
- introduce hysteresis
- add per-rule cooldowns
- add minimum delta significance thresholds

### Problem C — Duplicate alerts across restarts

Possible cause:
- service restart before delivery state is updated

Current mitigation:
- explicit delivery state file

Future plan:
- add alert identity hash and dedupe window

### Problem D — Snapshot frequency too high for rate limits

Possible cause:
- high WS event burst + timer cycle overlap

Current mitigation:
- debounce in watcher
- fixed 20-second periodic cycle

Future plan:
- adaptive throttling
- topic-aware cooldowns
- shared snapshot cache per time window

### Problem E — Service restart loops after environment drift

Possible cause:
- PATH changes
- node binary moves
- broken `.env`
- `npx` not present in service PATH
- `tsx` shebang cannot find `node`

Current mitigation:
- fixed explicit paths in script and unit
- direct local `tsx` path
- explicit inclusion of `/home/peakviker/.local/bin` in service PATH

Future plan:
- add startup self-check mode
- add health script that verifies env before service launch
- optionally replace `tsx` runtime path with a compiled JS artifact to reduce runtime PATH coupling

### Problem F — Bot-layer schema drift on Bybit side

Possible cause:
- Bybit changes payload field names

Current mitigation:
- metrics tolerate missing values with `null`

Future plan:
- schema validation layer
- field fallback registry
- automated snapshot shape diff checks

## 11. Current workflow status

What is done:
- runtime watcher stack exists end-to-end
- systemd service exists and runs
- timer-based monitoring works every 20 seconds
- metrics/deltas persist
- alert formatting exists
- fan-out gate exists

What is not done yet:
- Telegram/Hermes direct delivery integration
- full UI/internal history reverse-engineering
- threshold tuning based on longer live runs
- rule cooldowns and anti-noise logic

## 12. Recommended next steps

### Short-term
1. Let watcher run for a longer period during real market movement
2. Observe whether true `order/execution/position/wallet` WS events appear
3. Calibrate thresholds from real time-series

### Medium-term
4. Add Telegram or Hermes direct message delivery
5. Add per-rule cooldown/hysteresis
6. Add health-check command for watcher service

### Long-term
7. Optional forensic track: internal/UI history extraction
8. Optional richer analytics: volatility-adjusted thresholds
9. Optional strategy scoring beyond raw risk thresholds
10. Telegram / Hermes direct human delivery using the already-built fan-out adapter

## 15. Current delivery topology

The watcher core and delivery are intentionally decoupled.

### Core runtime
- `grid-risk-watcher.service` keeps the observer/evaluator loop alive continuously
- it writes snapshots, metrics, deltas, and raw alerts into `runtime/`

### Fan-out runtime
- Hermes cron job: `bybit-grid-risk-delivery`
- schedule: `every 1m`
- script: `deliver_new_alerts.sh`
- delivery target: `origin`

### Why this split exists
- watcher service remains a pure runtime component
- delivery remains idempotent and channel-agnostic
- if Telegram/Hermes/webhook fan-out changes later, core watcher code does not need to change

### What happens when no alerts exist
- `emit_new_alerts.ts WARN` prints `NO_NEW_ALERTS`
- delivery cron stays silent
- this is the expected healthy quiet path, not a failure

## 13. Operational commands

Service status:
```bash
systemctl --user status grid-risk-watcher.service --no-pager
```

Restart service:
```bash
systemctl --user restart grid-risk-watcher.service
```

Recent service logs:
```bash
journalctl --user -u grid-risk-watcher.service -n 50 --no-pager
```

Show latest formatted alert:
```bash
cd /home/peakviker/bybit-mcp
npx tsx scripts/show_latest_alert.ts formatted
```

Emit only new WARN+ alerts:
```bash
cd /home/peakviker/bybit-mcp
npx tsx scripts/emit_new_alerts.ts WARN
```

## 14. Final end-to-end summary

This feature now works as a layered monitoring system:
- service boots continuously
- private WS is connected
- timer-driven snapshots run every 20 seconds
- snapshots are normalized into risk metrics
- deltas are computed
- rules are evaluated
- alerts are formatted and made deliverable
- fan-out is idempotent and future-channel-ready

The most important design decision was this:
- do not wait for perfect hidden Bybit history access
- use live WS + authoritative bot snapshot first
- build useful risk monitoring now

That decision made the feature shippable.
