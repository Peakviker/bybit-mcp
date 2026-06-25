# Phase 10 Research: Alert Intelligence

Date: 2026-06-25
Scope: documentation/plan only, no alert-engine code changed

## Goal

Improve alert trust so the operator receives:
- fewer duplicate or low-signal messages
- explicit severity transitions
- clear rationale tied to actual metrics and thresholds
- enough state to explain why something was sent or suppressed

## Sources

URLs:
- `https://github.com/bybit-exchange/trading-mcp/tree/main`
- `https://raw.githubusercontent.com/bybit-exchange/trading-mcp/main/README.md`
- `https://bybit-exchange.github.io/docs/v5/intro`
- `https://bybit-exchange.github.io/docs/v5/guide`

Local inspected files:
- `/home/peakviker/bybit-mcp/src/risk_rules.ts`
- `/home/peakviker/bybit-mcp/src/format_alert.ts`
- `/home/peakviker/bybit-mcp/src/delivery_state.ts`
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts`
- `/home/peakviker/bybit-mcp/src/alert_delivery.ts`
- `/home/peakviker/bybit-mcp/docs/project-evolution-2026-06-25.md`

Upstream reference:
- upstream `trading-mcp` does not contain a watcher-grade alert policy layer; this phase is primarily local design work, not upstream borrowing.

## Current state

### Rule engine

`/home/peakviker/bybit-mcp/src/risk_rules.ts` currently:
- emits alerts immediately when thresholds are crossed
- has no memory of prior severity state
- has no cooldowns
- has no hysteresis
- has no suppression explanation
- treats info/warn/critical as one-shot stateless outputs

### Formatter

`/home/peakviker/bybit-mcp/src/format_alert.ts` currently:
- prints one alert with current metric values and delta values
- does not include transition context (`warn -> critical`, `critical -> recovery`)
- does not explain why an alert was suppressed because there is no suppression model yet

### Delivery state

`/home/peakviker/bybit-mcp/src/delivery_state.ts` currently stores only:
- `lastDeliveredTs`

This is too weak for richer delivery logic.

## Proposed future files

Create:
- `/home/peakviker/bybit-mcp/src/alert_policy.ts`
- `/home/peakviker/bybit-mcp/src/alert_state.ts`
- `/home/peakviker/bybit-mcp/src/alert_digest.ts`
- `/home/peakviker/bybit-mcp/runtime/alert-engine-state.json`

Modify:
- `/home/peakviker/bybit-mcp/src/risk_rules.ts`
- `/home/peakviker/bybit-mcp/src/format_alert.ts`
- `/home/peakviker/bybit-mcp/src/delivery_state.ts`
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts`

Optional later:
- `/home/peakviker/bybit-mcp/scripts/explain_latest_alert.ts`

## New concepts to introduce

### 1. Alert policy

Each alert code should have explicit policy metadata:
- cooldown window
- hysteresis reset condition
- digest eligibility
- escalation path
- recovery message requirement

Proposed shape:

```ts
export type AlertPolicy = {
  code: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  cooldownMs: number;
  recoveryCooldownMs?: number;
  hysteresisClearBelow?: number;
  hysteresisClearAbove?: number;
  digestEligible: boolean;
  emitRecovery: boolean;
};
```

### 2. Alert state ledger

Proposed file:
- `/home/peakviker/bybit-mcp/runtime/alert-engine-state.json`

Suggested structure:

```json
{
  "version": 1,
  "codes": {
    "reserve_ratio_warn": {
      "lastSeenTs": 0,
      "lastEmittedTs": 0,
      "lastSuppressedTs": 0,
      "lastSeverity": "WARN",
      "active": true,
      "activeSinceTs": 0,
      "lastMetricValue": 0.91,
      "lastTransition": "healthy_to_warn"
    }
  }
}
```

### 3. Transition model

Desired transitions:
- `healthy -> info`
- `healthy -> warn`
- `warn -> critical`
- `critical -> warn`
- `warn -> healthy`
- `critical -> healthy`

Not every cycle should emit a message.

Suggested rule:
- emit on new activation
- emit on escalation
- emit on recovery
- suppress repeated unchanged states inside cooldown

## Policy proposals by current local alert code

| Alert code | Current trigger source | Proposed cooldown | Proposed hysteresis / recovery rule | Emit digest? | Notes |
|---|---|---:|---|---|---|
| `reserve_ratio_warn` | `metrics.reserveRatio >= 0.85` | 30 min | clear only when reserve ratio drops below 0.80 | Yes | avoid repetitive high-reserve chatter |
| `reserve_ratio_critical` | `metrics.reserveRatio >= 0.95` | 10 min | downgrade only when reserve ratio drops below 0.92 | No | escalation should be visible quickly |
| `liq_buffer_warn` | `metrics.liqBufferPct <= 0.08` | 15 min | clear only when buffer rises above 0.10 | Yes | makes thin-buffer warnings less noisy |
| `liq_buffer_critical` | `metrics.liqBufferPct <= 0.05` | 5 min | downgrade only when buffer rises above 0.06 | No | keep critical path fast |
| `directional_drag_warn` | delta worsened below warn threshold | 20 min | clear when delta stabilizes above warn threshold for 2 cycles | Yes | transient moves should not spam |
| `directional_drag_critical` | delta worsened below critical threshold | 5 min | downgrade when delta rises above critical threshold for 2 cycles | No | sharp deterioration deserves visibility |
| `equity_drop_warn` | delta equity <= warn threshold | 20 min | clear after 2 non-negative cycles or above softened boundary | Yes | avoids repetitive drawdown messages |
| `equity_drop_critical` | delta equity <= critical threshold | 5 min | downgrade after 2 cycles above critical boundary | No | critical equity drops should stay visible |
| `long_inventory_near_lower_band` | inventory up near lower band | 30 min | clear when distance to lower band exceeds 6% or position shrinks | Yes | good digest candidate |
| `grid_arbitrage_increment` | arbitrage count increased | 60 min | no active state needed | Yes | should almost always be summarized, not spammed |

## Formatter improvements

Future formatter output should include:
- transition type
- threshold evidence
- current metric value and threshold value
- suppression state when shown in diagnostics

Example future message:

```text
[CRITICAL][MAINNET] BTCUSDT grid bot 624873434886723147
transition: warn -> critical
reason: reserve ratio crossed critical threshold
metric: reserve ratio = 96.2%
threshold: critical >= 95.0%
previous emitted: 12m ago
code: reserve_ratio_critical
```

This is much stronger than only showing the current value without explicit rationale.

## Digest mode

Digest candidates:
- info-level arbitrage increments
- repeated warn-level non-escalating events
- multiple low-severity changes in one cycle

Possible future output files:
- `/home/peakviker/bybit-mcp/runtime/risk-alert-digests.log`

Suggested rule:
- digest minor alerts over a 15-minute window
- do not digest critical alerts
- do not digest first activation of a warn state

## Delivery state expansion

`/home/peakviker/bybit-mcp/src/delivery_state.ts` should eventually store more than `lastDeliveredTs`.

Suggested future shape:

```json
{
  "lastDeliveredTs": 0,
  "lastDeliveredCodes": ["reserve_ratio_warn"],
  "lastDigestTs": 0,
  "lastTransitionTs": 0,
  "lastRecoveryTs": 0
}
```

Richer state enables:
- duplicate suppression with explanation
- digest scheduling
- recovery message tracking

## Validation scenarios for a future implementation

Scenario 1: reserve ratio oscillates around 0.85
- expected: not every cycle emits
- only first activation and meaningful recovery/escalation should emit

Scenario 2: reserve ratio rises from 0.86 to 0.97
- expected: initial warn, then explicit warn -> critical transition

Scenario 3: critical liq buffer recovers slightly but remains risky
- expected: downgrade only after hysteresis boundary is crossed, not instantly

Scenario 4: arbitrage count increments repeatedly during a healthy period
- expected: digest output, not a stream of one-line info alerts

## Risks

1. Too much state can make debugging harder.
   - Mitigation: keep one explicit JSON state file for the alert engine.
2. Over-aggressive cooldowns can hide meaningful deterioration.
   - Mitigation: never suppress escalation from warn to critical.
3. Formatter changes can get ahead of actual policy logic.
   - Mitigation: implement state/policy first, formatter second.

## Recommendation

Recommendation: make Phase 10 stateful and transition-aware, not just “better formatted”.

Best first move:
- introduce `/home/peakviker/bybit-mcp/runtime/alert-engine-state.json` plus per-code cooldown/hysteresis policy for the existing alert codes before inventing new alert types.

Reason:
- the current weakness is not lack of alert types; it is lack of memory and suppression discipline.
- better state will improve signal quality immediately without expanding the surface area of the rule engine.