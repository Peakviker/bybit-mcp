# Ideal Operator UX Research

Date: 2026-06-25
Project: `/home/peakviker/bybit-mcp`
Scope: documentation only

## Goal

Define the operator experience this repo should converge toward. The watcher should not require opening multiple JSONL files manually for routine questions.

## Local evidence

Current project already has useful runtime artifacts:
- watcher event log: `/home/peakviker/bybit-mcp/runtime/grid-risk-watcher.jsonl`
- snapshots: `/home/peakviker/bybit-mcp/runtime/grid-snapshots.jsonl`
- metrics: `/home/peakviker/bybit-mcp/runtime/risk-metrics.jsonl`
- deltas: `/home/peakviker/bybit-mcp/runtime/risk-deltas.jsonl`
- alerts: `/home/peakviker/bybit-mcp/runtime/risk-alerts.jsonl`
- formatted alerts: `/home/peakviker/bybit-mcp/runtime/risk-alerts-formatted.log`
- delivery state: `/home/peakviker/bybit-mcp/runtime/alert-delivery-state.json`

Current docs already propose operator scripts:
- `/home/peakviker/bybit-mcp/docs/project-evolution-2026-06-25.md:171-181` proposes status, explain-latest-alert, health-check, incident runbook, and runtime schema docs.
- `/home/peakviker/bybit-mcp/docs/research/phase8-runtime-hardening.md` recommends status and health files before wider expansion.

## Operator questions to optimize for

The ideal UX should answer these without manual grep/tail work:

1. Is the watcher alive?
2. Is the watcher healthy or just running?
3. When was the last successful snapshot?
4. Why has it been quiet?
5. Was an alert suppressed, delivered, or not generated?
6. What is the latest bot state?
7. What changed since the previous cycle?
8. Which Bybit source is authoritative for this answer?
9. Is this a watcher issue, delivery issue, Bybit API issue, or normal no-alert state?
10. What should I do next?

## Recommended command surface

Future operator scripts should be small and read-only by default.

Recommended commands:

- `status_grid_risk_watcher`
  - summarizes service/process liveness, latest health file, latest cycle age, latest snapshot age, latest alert/delivery state.

- `explain_latest_alert`
  - shows latest alert with source metric, threshold, transition, previous emission, and delivery result.

- `why_quiet_grid_risk_watcher`
  - distinguishes healthy quiet from broken quiet.
  - checks health, latest metric state, delivery checkpoint, and thresholds.

- `show_latest_grid_snapshot`
  - prints compact bot detail summary without raw payload noise.

- `check_bybit_endpoint_coverage`
  - prints which local tool maps to which Bybit endpoint and whether it is read/write.

- `prune_runtime_logs --dry-run`
  - reports retention impact before deleting anything.

## UX principles

1. Prefer one-screen summaries.
2. Always show freshness timestamps.
3. Separate `healthy quiet` from `stale quiet`.
4. Separate detection, alert policy, and delivery.
5. Mark environment (`MAINNET` / `TESTNET`) in every operator-facing output.
6. Make write/danger operations visually distinct.
7. Include source references in diagnostic output when possible.
8. Avoid dumping raw Bybit payloads unless asked.

## Recommended status output shape

Example target shape:

```text
[MAINNET] grid risk watcher
service: active
mode: healthy
last successful cycle: 18s ago
last snapshot: 18s ago
last ws event: 4m ago
consecutive failures: 0
latest bot status: running
latest severity: none
last delivered alert: 2h 14m ago
quiet reason: metrics below configured thresholds
next action: none
```

## Alert explanation target

Example target shape:

```text
[WARN][MAINNET] reserve_ratio_warn
transition: healthy -> warn
metric: reserve ratio 88.1%
threshold: warn >= 85.0%, clear < 80.0%
first seen: 2026-06-25T10:00:00Z
emitted: yes
channel: Hermes cron origin
next repeat: suppressed until cooldown expires unless severity escalates
```

## Source citation UX

For operator trust, diagnostic commands should name their source layer:

- bot-layer truth: `/v5/fgridbot/detail`
- generic account context: wallet, positions, open orders
- strategy namespace context: `/v5/strategy/list`, `/v5/strategy/order-list`
- watcher-derived: metrics, deltas, alert state
- delivery-derived: delivery state and formatted alert log

This prevents the recurring pitfall where empty generic account endpoints are mistaken for no bot risk.

## Recommendation

After health files are added, build the operator UX around read-only scripts before adding more endpoint coverage.

Priority:
1. `status_grid_risk_watcher`
2. `why_quiet_grid_risk_watcher`
3. `explain_latest_alert`
4. runtime JSON schema doc
5. endpoint coverage doc

The operator should not need to know internal file names for routine status checks.