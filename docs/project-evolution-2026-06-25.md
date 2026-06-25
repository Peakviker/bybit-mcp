# Bybit MCP / Grid Risk Watcher — Project Evolution

Date: 2026-06-25
Project root: `/home/peakviker/bybit-mcp`
Status: watcher and delivery path are live; this document captures next-step evolution toward a more complete and more production-ready system.

## 1. Current state

What already works:
- official Bybit V5 MCP server in local project form
- direct signed bot-layer access for `fgridbot/detail`
- real-time-ish grid risk watcher with 20-second timer baseline
- append-only runtime persistence in `runtime/`
- rule engine, formatter, stateful alert fan-out
- user service `grid-risk-watcher.service`
- Hermes cron delivery `bybit-grid-risk-delivery`

Recent safe maintenance already completed:
- runtime/env absolute paths centralized in `src/paths.ts`
- active-orders snapshot no longer hardcodes `BTCUSDT`; symbol is derived from bot detail
- stale Hermes cron and stale memory entries cleaned up
- handoff skill and project handoff docs are in place

## 2. Source material reviewed

### Official Bybit / trading-mcp sources

1. Bybit trading-mcp GitHub repository
   - URL: `https://github.com/bybit-exchange/trading-mcp/tree/main`
   - observed live remote tag/commit path includes tag `2.1.11`
   - local inspection clone used during review: `/tmp/trading-mcp`

2. NPM package page for official server
   - URL: `https://www.npmjs.com/package/bybit-official-trading-server/v/2.1.11?activeTab=code`
   - direct HTTP fetch returned `403 Forbidden` from this environment
   - package metadata was instead confirmed via cloned repo `package.json`

3. Upstream README
   - raw URL: `https://raw.githubusercontent.com/bybit-exchange/trading-mcp/main/README.md`

4. Official Bybit V5 docs already referenced in project
   - `https://bybit-exchange.github.io/docs/v5/intro`
   - `https://bybit-exchange.github.io/docs/v5/guide`

### Upstream observations that matter

From `trading-mcp` upstream review:
- upstream package `bybit-official-trading-server` is `2.1.11`
- upstream advertises much broader surface than this local project: README says 206+ tools, table later says 258 total tools
- upstream supports both HMAC and RSA signing
- upstream has a dedicated auth utility layer and runtime env resolution at call time
- upstream has explicit REST timeout handling via `AbortController`
- upstream has a rate limiter utility in `src/utils/rate-limiter.ts`
- upstream has snapshot-style WebSocket tools for MCP request/response compatibility
- upstream has dedicated WS trade request support (`/v5/trade`) in `src/client/ws-client.ts`
- upstream organizes tools by categories (`market`, `trade`, `position`, `asset`, `bot`, `strategy`, `subscription`, `websocket`, `wstrade`, etc.)

## 3. Gap analysis: current project vs upstream ideas

### 3.1 What this project already does better for the current user need

This local project is more focused on one operational goal:
- monitor a running Futures Grid Bot continuously
- derive risk metrics over time
- deliver only meaningful state changes

That watcher-oriented stateful pipeline is more specialized than upstream generic MCP coverage.

### 3.2 What upstream does better and could inspire next steps

Upstream brings production patterns worth borrowing:
- centralized auth/signing abstraction
- timeout-wrapped HTTP calls
- rate limiting
- richer WS encapsulation
- broader endpoint/category coverage
- RSA signing support
- more explicit separation of client/tool/util layers

## 4. Best evolution directions

Ordered by expected value.

### A. Harden the watcher into a production runtime component

Goal:
- move from “working watcher” to “observable, diagnosable, self-explaining watcher”

Concrete ideas:
1. Add watcher health state file
   - e.g. `runtime/grid-risk-health.json`
   - fields: `lastSuccessTs`, `lastFailureTs`, `consecutiveFailures`, `lastError`, `lastSnapshotTs`
2. Emit degraded-state alerts when cycles keep failing but process still lives
3. Add startup self-check script
   - verifies env, service, cron, runtime write access, latest successful snapshot age
4. Add bounded runtime retention/rotation policy for JSONL files
5. Add metrics summary script for operators
   - e.g. latest cycle age, alerts in last 24h, last successful delivery

Why this matters:
- right now the service can be “alive” while logic quietly fails repeatedly

### B. Extract a proper client/core layer from the watcher scripts

Goal:
- turn the current working code into a reusable local library

Concrete ideas:
1. unify Bybit REST signing and request execution behind one client abstraction
2. add timeouts and structured HTTP error classification
3. add retry policy for transient failures
4. isolate bot-specific endpoints from generic account endpoints
5. normalize raw Bybit payloads into typed domain objects before rules/metrics

Inspiration:
- upstream `src/client/rest-client.ts`
- upstream `src/utils/auth.ts`
- upstream runtime env read-at-call-time pattern

### C. Add a dedicated subscription/snapshot control plane

Goal:
- make live data ingestion more structured and reusable than the current watcher-only approach

Concrete ideas:
1. introduce an internal subscription module that mirrors upstream MCP snapshot semantics
2. split public/private/trade WS wrappers cleanly
3. support capture modes:
   - one-shot snapshot
   - short burst capture
   - continuous daemon mode
4. store raw WS payloads with correlation metadata
5. record auth/subscription acknowledgements separately from business events

Inspiration:
- upstream `src/client/ws-client.ts`
- upstream `src/tools/subscription/*`
- upstream `src/tools/websocket/*`

### D. Expand bot-layer understanding beyond `fgridbot/detail`

Goal:
- recover as much bot lineage/context as possible without making watcher depend on fragile UI scraping

Concrete ideas:
1. map all bot-related official endpoints from upstream `bot` category
2. compare local bot coverage with upstream bot tools
3. identify which official endpoints are usable for:
   - configuration history
   - child order lineage
   - bot lifecycle transitions
   - parameter limits/validation
4. only then decide whether browser/internal route work is still worth it

Inspiration:
- upstream README bot category counts and strategy/bot separation

### E. Improve alert quality toward “operator trust”

Goal:
- fewer noisy alerts, more explainable alerts

Concrete ideas:
1. cooldown and hysteresis per alert code
2. alert grouping by severity + cause family
3. state transition alerts (`healthy -> warn`, `warn -> critical`, `critical -> recovery`)
4. richer formatted payloads with before/after deltas
5. per-rule rationale text that references exact metric thresholds
6. optional digest mode summarizing several minor changes into one operator message

### F. Add project-level operator UX

Goal:
- make this usable by future sessions or other agents without re-learning

Concrete ideas:
1. `scripts/status_grid_risk_watcher.ts`
2. `scripts/explain_latest_alert.ts`
3. `scripts/check_runtime_health.ts`
4. one Markdown operator runbook for incident handling
5. one markdown/schema spec for runtime JSONL formats

## 5. “Ideal state” vision

An ideal end-state for this project would look like:

1. MCP server layer
   - clear category structure
   - typed request/response adapters
   - both HMAC and RSA auth
   - timeout + retry + rate-limit protections

2. Watcher runtime layer
   - service-managed daemon
   - heartbeat + health file
   - structured failures
   - robust snapshot + WS ingestion

3. Risk intelligence layer
   - normalized bot state model
   - richer metrics
   - long-window analytics
   - anomaly detection
   - rule confidence and explainability

4. Delivery layer
   - idempotent fan-out
   - dedupe
   - cooldown/hysteresis
   - recovery alerts
   - human-readable summaries

5. Operator layer
   - one-command health checks
   - self-contained handoff docs
   - evolution docs
   - scripts that answer “what changed?”, “why is it quiet?”, “what is broken?”

## 6. Suggested phased roadmap

### Phase 8 — Runtime hardening
- watcher health file
- consecutive failure tracking
- operator status script
- runtime file retention policy

### Phase 9 — Client abstraction cleanup
- dedicated REST helper with timeout/retry/error taxonomy
- signing abstraction cleanup
- unified env/runtime config handling

### Phase 10 — Alert intelligence
- cooldown/hysteresis
- transition-aware alerts
- richer formatter payloads
- summary/digest mode

### Phase 11 — Broader bot coverage
- compare with upstream bot/strategy categories
- add useful official endpoints that improve lineage and introspection

### Phase 12 — Research-driven idealization
- selectively borrow production patterns from upstream `trading-mcp`
- decide whether to keep local server independent, partially sync upstream, or rebase around upstream architecture

## 7. Strategic options

### Option 1 — Stay focused and local-first
Use this project as a compact, specialized watcher stack with only the MCP coverage needed for this bot-risk workflow.

Best when:
- operational watcher quality matters more than broad API completeness

### Option 2 — Hybridize with upstream patterns
Keep local project purpose, but selectively import:
- auth utilities
- timeout handling
- rate limiting
- WS wrappers
- category decomposition

Best when:
- you want better production discipline without losing watcher specialization

### Option 3 — Full convergence toward upstream-style architecture
Restructure the project into a broader Bybit integration platform with watcher as one subsystem.

Best when:
- this repo is expected to become the main long-lived Bybit operations surface

## 8. My current recommendation

Best next move is **Option 2**.

Reason:
- current project already solves the real immediate problem
- upstream contains useful production patterns
- full convergence now would slow down watcher-specific progress
- selective borrowing gives the best value/risk ratio

## 9. Immediate next implementation candidates

If continuing development soon, highest-value next tasks are:

1. Add watcher health file + consecutive failure tracking
2. Add operator status/check script
3. Add cooldown/hysteresis to alert engine
4. Add timeout/retry wrapper around local REST calls
5. Compare local bot coverage against upstream `bot` and `strategy` categories

## 10. Inspiration list

Useful inspiration sources for future sessions:
- Upstream Bybit MCP README: `https://raw.githubusercontent.com/bybit-exchange/trading-mcp/main/README.md`
- Upstream repo: `https://github.com/bybit-exchange/trading-mcp/tree/main`
- Upstream REST client pattern: `/tmp/trading-mcp/src/client/rest-client.ts`
- Upstream WS client pattern: `/tmp/trading-mcp/src/client/ws-client.ts`
- Official Bybit V5 docs: `https://bybit-exchange.github.io/docs/v5/intro`
- Official Bybit auth/integration guide: `https://bybit-exchange.github.io/docs/v5/guide`

## 11. One-line summary

The project is already a good specialized watcher; the path to “ideal” is not random feature growth, but selective adoption of upstream production patterns plus stronger watcher observability, alert intelligence, and operator UX.
