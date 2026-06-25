# Alert-State Design Research

Date: 2026-06-25
Project: `/home/peakviker/bybit-mcp`
Scope: documentation only

## Goal

Design the next alert state model so alerts become stateful, explainable, and trusted. The target is not more alert volume; the target is better operator confidence.

## Local evidence

Current alert rules are stateless:
- `/home/peakviker/bybit-mcp/src/risk_rules.ts:44-104` evaluates thresholds and returns alerts immediately.
- Alert object fields are current metrics and delta only: `/home/peakviker/bybit-mcp/src/risk_rules.ts:6-14`.
- Formatter prints the current alert and metric values, but no transition or suppression context: `/home/peakviker/bybit-mcp/src/format_alert.ts:19-48`.
- Delivery state tracks only `lastDeliveredTs`: `/home/peakviker/bybit-mcp/src/delivery_state.ts:6-23`.

Existing research already identifies this gap:
- `/home/peakviker/bybit-mcp/docs/research/phase10-alert-intelligence.md` proposes cooldown, hysteresis, transitions, recovery messages, digests, and an alert-engine state file.

## Design principle

Separate three decisions:

1. Detection
   - What condition is true now?
   - Example: reserve ratio is above warn threshold.

2. State transition
   - Did the condition change meaningfully since the previous cycle?
   - Example: healthy -> warn, warn -> critical, critical -> recovered.

3. Emission policy
   - Should the operator receive a message now?
   - Example: emit first activation and escalation, suppress repeated unchanged warn within cooldown.

Current code combines detection and emission. The future design should split them.

## Recommended state shape

Use one alert-engine state file:

`/home/peakviker/bybit-mcp/runtime/alert-engine-state.json`

Recommended top-level fields:
- `version`
- `lastEvaluatedTs`
- `codes`
- `digest`

Recommended per-code state:
- `active`
- `severity`
- `lastSeenTs`
- `lastEmittedTs`
- `lastSuppressedTs`
- `activeSinceTs`
- `lastMetricValue`
- `lastTransition`
- `suppressionReason`
- `recoveryCandidateSinceTs`

## Transition rules

Emit immediately for:
- first activation (`healthy -> warn`, `healthy -> critical`)
- escalation (`warn -> critical`)
- recovery (`warn -> healthy`, `critical -> healthy`), if enabled for that code

Usually suppress:
- repeated unchanged warn inside cooldown
- info-level repetitive changes that are digest-eligible
- recovery candidates that have not crossed hysteresis boundary long enough

Never suppress:
- a new critical alert caused by escalation
- a new alert code that was previously inactive
- a delivery/health failure that indicates the alert system itself is broken

## Hysteresis recommendation

State should not recover at the same threshold where it triggered.

Examples:
- reserve warn triggers at `>= 0.85`, clears only below `0.80`
- reserve critical triggers at `>= 0.95`, downgrades only below `0.92`
- liq buffer warn triggers at `<= 0.08`, clears only above `0.10`
- liq buffer critical triggers at `<= 0.05`, downgrades only above `0.06`

This reduces flapping around boundaries.

## Digest recommendation

Digest should be allowed only for non-critical, non-escalating alerts.

Good digest candidates:
- `grid_arbitrage_increment`
- repeated warn-level drift that is not getting worse
- multiple minor changes in the same cycle

Bad digest candidates:
- critical liquidation buffer deterioration
- reserve critical escalation
- watcher health degradation

## Formatter implications

Future alert text should include:
- transition
- triggering metric
- threshold
- prior emitted time
- suppression/recovery context when used by diagnostic commands

Operator-facing example shape:

```text
[WARN][MAINNET] BTCUSDT grid bot 624873434886723147
transition: healthy -> warn
reason: reserve ratio crossed warn threshold
metric: reserve ratio = 88.1%
threshold: warn >= 85.0%, clear < 80.0%
code: reserve_ratio_warn
```

## Recommendation

Add alert state after watcher health exists, not before.

Reason:
- stateful alerting depends on trustworthy cycle health.
- without a health ledger, suppressed alerts can become hard to debug.

Recommended implementation order for a future coding phase:
1. add watcher health file
2. add alert-engine state file
3. split detection from emission policy
4. add transition-aware formatter
5. expand delivery state beyond timestamp
