# Capability Matrix: local bybit-mcp vs upstream trading-mcp

Date: 2026-06-25
Project root: `/home/peakviker/bybit-mcp`
Upstream repo: `https://github.com/bybit-exchange/trading-mcp/tree/main`

## Purpose

This document compares the current local project against upstream `trading-mcp` in terms of operator-relevant capability, not raw breadth. The local project already solves a real grid-risk monitoring problem; the question is which upstream capabilities should be adopted next.

## Source inventory

URLs checked from this environment:
- `https://github.com/bybit-exchange/trading-mcp/tree/main` — reachable, HTTP 200
- `https://raw.githubusercontent.com/bybit-exchange/trading-mcp/main/README.md` — reachable, HTTP 200
- `https://www.npmjs.com/package/bybit-official-trading-server/v/2.1.11?activeTab=code` — unreachable for source browsing from this environment, HTTP 403
- `https://bybit-exchange.github.io/docs/v5/intro` — reachable, HTTP 200
- `https://bybit-exchange.github.io/docs/v5/guide` — reachable, HTTP 200

Local inspected files:
- `/home/peakviker/bybit-mcp/README.md`
- `/home/peakviker/bybit-mcp/package.json`
- `/home/peakviker/bybit-mcp/src/index.ts`
- `/home/peakviker/bybit-mcp/src/bybit_client.ts`
- `/home/peakviker/bybit-mcp/src/grid_snapshot.ts`
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts`
- `/home/peakviker/bybit-mcp/src/persist.ts`
- `/home/peakviker/bybit-mcp/src/risk_rules.ts`
- `/home/peakviker/bybit-mcp/src/format_alert.ts`
- `/home/peakviker/bybit-mcp/src/delivery_state.ts`
- `/home/peakviker/bybit-mcp/src/paths.ts`
- `/home/peakviker/bybit-mcp/scripts/deliver_new_alerts.sh`

Upstream inspected files:
- `/tmp/trading-mcp/README.md`
- `/tmp/trading-mcp/package.json`
- `/tmp/trading-mcp/src/client/rest-client.ts`
- `/tmp/trading-mcp/src/client/ws-client.ts`
- `/tmp/trading-mcp/src/client/subscription-manager.ts`
- `/tmp/trading-mcp/src/utils/auth.ts`
- `/tmp/trading-mcp/src/utils/rate-limiter.ts`

## Current local baseline

Observed local scope:
- MCP server with 19 registered tools in `/home/peakviker/bybit-mcp/src/index.ts`
- focused V5 read/write coverage for market/account/order/strategy/grid-bot workflow
- dedicated watcher runtime in `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts`
- append-only runtime persistence via `/home/peakviker/bybit-mcp/src/persist.ts`
- grid snapshot aggregation in `/home/peakviker/bybit-mcp/src/grid_snapshot.ts`
- threshold-based alerting in `/home/peakviker/bybit-mcp/src/risk_rules.ts`
- human-readable formatting in `/home/peakviker/bybit-mcp/src/format_alert.ts`
- delivery checkpoint only by timestamp in `/home/peakviker/bybit-mcp/src/delivery_state.ts`

Observed upstream scope:
- README category table claims 258 tools total in `/tmp/trading-mcp/README.md:344-375`
- README intro still says 206 tools in `/tmp/trading-mcp/README.md:11,32`
- package version is `2.1.11` in `/tmp/trading-mcp/package.json:1-4`
- upstream includes broad REST, WebSocket snapshot, persistent subscriptions, and WS trade operations

## Matrix

| Capability | Local support | Upstream support | Evidence (local) | Evidence (upstream) | Operator value for this repo | Recommended action |
|---|---|---|---|---|---|---|
| Basic market-data MCP tools | Yes, narrow | Yes, broad | `/home/peakviker/bybit-mcp/src/index.ts` registers `bybit_server_time`, `bybit_instruments_info`, `bybit_kline` | `/tmp/trading-mcp/README.md:348` (`market`, 22 tools) | Medium | Keep local subset; no urgent expansion |
| Private account/order/history tools | Yes, narrow | Yes, broad | `/home/peakviker/bybit-mcp/src/index.ts` registers wallet, positions, closed pnl, orders, executions | `/tmp/trading-mcp/README.md:349-353` | High | Expand only when watcher or operator workflow needs a specific endpoint |
| Grid-bot detail + analysis | Yes, watcher-focused | Yes, broad bot family | `/home/peakviker/bybit-mcp/src/index.ts`, `/home/peakviker/bybit-mcp/src/bybit_client.ts` | `/tmp/trading-mcp/README.md:356` (`bot`, 18 tools) | Very high | Preserve local specialization; add only missing bot introspection endpoints |
| Bot-family breadth (combo, martingale, spot grid, DCA) | No | Yes | Local README lists only futures grid endpoints | `/tmp/trading-mcp/README.md:356` | Low for current watcher | Defer |
| Strategy-order breadth (TWAP/iceberg/chase) | Partial | Yes | local has `bybit_strategy_list` and `bybit_strategy_order_list` | `/tmp/trading-mcp/README.md:359` | Low-medium | Defer until needed for higher-level operator tooling |
| WebSocket one-shot snapshot tools exposed via MCP | No | Yes | no local MCP websocket tools in `/home/peakviker/bybit-mcp/src/index.ts` | `/tmp/trading-mcp/README.md:372`, `/tmp/trading-mcp/src/client/ws-client.ts` | Medium | Borrow later as reusable internal module, not as immediate top priority |
| Persistent subscription manager with reconnect and idle expiry | No | Yes | local watcher uses `bybit-api` private socket directly in `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts` | `/tmp/trading-mcp/src/client/subscription-manager.ts` | High | Adapt for watcher observability after runtime hardening |
| WS trade operations (`/v5/trade`) | No | Yes | local write path is REST-only | `/tmp/trading-mcp/README.md:373`, `/tmp/trading-mcp/src/client/ws-client.ts:167-257` | Low | Skip for now |
| HMAC signing support | Yes | Yes | `/home/peakviker/bybit-mcp/src/bybit_client.ts`, `/home/peakviker/bybit-mcp/src/index.ts` | `/tmp/trading-mcp/src/utils/auth.ts` | High | Keep |
| RSA signing support | No | Yes | no local RSA path | `/tmp/trading-mcp/src/utils/auth.ts:4-45`, README RSA setup in `/tmp/trading-mcp/README.md:98-159` | Medium | Plan in client abstraction phase, not before watcher hardening |
| Central auth abstraction | Partial, duplicated | Yes | duplicated signing logic in `/home/peakviker/bybit-mcp/src/index.ts` and `/home/peakviker/bybit-mcp/src/bybit_client.ts` | `/tmp/trading-mcp/src/utils/auth.ts` | Very high | Adopt soon in Phase 9 |
| Runtime env read-at-call-time | Partial | Yes | local runtime helper exists in `/home/peakviker/bybit-mcp/src/env.ts`, but `src/index.ts` also reads process env directly | `/tmp/trading-mcp/src/client/rest-client.ts:15-22` | High | Normalize in Phase 9 |
| REST timeout / abort handling | No | Yes | no abort controller in local client code | `/tmp/trading-mcp/src/client/rest-client.ts:7-13,42-46,57-61,68-77,91-95` | Very high | Adopt soon in Phase 9 |
| Rate limiting | No | Yes | no local rate limiter found in inspected source | `/tmp/trading-mcp/src/utils/rate-limiter.ts` | High | Adopt soon in Phase 9 |
| Structured response error handling | Partial | Yes | local throws raw HTTP or retCode errors in `/home/peakviker/bybit-mcp/src/bybit_client.ts` | `/tmp/trading-mcp/src/client/rest-client.ts:24-34` | High | Adopt in Phase 9 |
| Watcher runtime loop | Yes | No upstream equivalent | `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts` | upstream repo is exchange-generic, not watcher-specific | Very high | Preserve local design as the repo’s core differentiator |
| Runtime persistence for snapshots/metrics/deltas/alerts | Yes | Partial (subscription buffers only) | `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts`, `/home/peakviker/bybit-mcp/src/persist.ts` | upstream snapshot mode returns data but does not implement this watcher ledger | Very high | Keep; harden with health + retention |
| Health file / degraded-state tracking | No | No direct equivalent | no health ledger in local runtime | no direct upstream watcher health model | Very high | Implement first in Phase 8 |
| Alert intelligence: cooldown/hysteresis/transitions | No | No direct equivalent | thresholds only in `/home/peakviker/bybit-mcp/src/risk_rules.ts` | not a focus of upstream | Very high | Implement in Phase 10 |
| Delivery dedupe state richness | Low | N/A | only `lastDeliveredTs` in `/home/peakviker/bybit-mcp/src/delivery_state.ts` | no watcher-specific delivery state upstream | High | Expand in Phase 10 |
| Operator scripts / runbook UX | Low | N/A | only delivery shell wrapper visible in `/home/peakviker/bybit-mcp/scripts/deliver_new_alerts.sh` | upstream is general MCP package, not watcher ops package | High | Add after Phase 8 |
| Multi-account, RFQ, P2P, card, earn, alpha/on-chain breadth | No | Yes | absent locally | `/tmp/trading-mcp/README.md:351,354,360-371` | Low for current mission | Skip unless repo scope changes |

## Main findings

1. The local project is not “behind” in its core mission. It is ahead in one important area: it already has a specialized risk watcher runtime with persistence and alerting.
2. The biggest local weaknesses are not missing exchange endpoints; they are runtime hardening and client-discipline gaps:
   - no timeout/abort layer
   - no rate limiting
   - duplicated signing logic
   - no health ledger
   - simplistic delivery checkpointing
3. Upstream should be treated as a production-pattern source library, not as an architecture that must replace the local watcher.
4. The highest-value overlap is in reusable infrastructure:
   - auth abstraction
   - request execution wrapper
   - rate limiting
   - snapshot/subscription patterns
5. Broad categories like P2P, RFQ, card, alpha, earn, and copy-trading add little operator value for the current grid-risk workflow.

## What should not be over-prioritized

Do not treat the upstream tool-count advantage as the main metric. The README itself has a count inconsistency:
- 206 tools in intro copy
- 258 tools in the category table

This matters because it shows breadth, but not necessarily operator usefulness for this repo.

## Recommendation

Recommendation: keep the local repo specialized and adopt a hybrid path.

Concrete priority order:
1. Phase 8 runtime hardening before any major API-surface expansion.
2. Phase 9 client abstraction cleanup using upstream patterns from `rest-client.ts`, `auth.ts`, and `rate-limiter.ts`.
3. Phase 10 alert intelligence so operators get fewer but more trustworthy alerts.
4. Only after phases 8-10, selectively add upstream bot/strategy/subscription capabilities that directly improve watcher introspection or diagnostics.

Short version: preserve the watcher, borrow the plumbing, ignore low-value breadth.