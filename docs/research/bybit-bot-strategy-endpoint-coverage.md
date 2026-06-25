# Bybit Bot and Strategy Endpoint Coverage Research

Date: 2026-06-25
Project: `/home/peakviker/bybit-mcp`
Scope: documentation only

## Goal

Map what the local project already covers versus the official upstream `trading-mcp` bot/strategy surface, then recommend the minimum useful endpoint expansion for grid-risk operations.

## Sources checked

Reachable:
- `https://github.com/bybit-exchange/trading-mcp/tree/main`
- local upstream clone `/tmp/trading-mcp`, commit `10935f2`, tag `2.1.11`
- `https://bybit-exchange.github.io/docs/v5/strategy/strategy-list` — HTTP 200, title `Get Strategy List`
- `https://bybit-exchange.github.io/docs/v5/strategy/order-list` — HTTP 200, title `Get Strategy Order List`

Unreachable / not found from this environment:
- `https://bybit-exchange.github.io/docs/v5/pilot-feature/fgridbot/detail` — HTTP 404, title `Page Not Found`
- npm source browsing for `bybit-official-trading-server` was already recorded as HTTP 403 in prior research docs.

## Local coverage

Local registered strategy tools:
- `/home/peakviker/bybit-mcp/src/index.ts:396-420` registers `bybit_strategy_list`.
- `/home/peakviker/bybit-mcp/src/index.ts:422-438` registers `bybit_strategy_order_list`.

Local grid-bot tools:
- local code contains futures grid detail, validation, close, and analysis wrappers around bot-layer endpoints.
- `/home/peakviker/bybit-mcp/src/index.ts:128-140` shows the local `/v5/fgridbot/detail` path and bot detail normalization.

Local watcher usage:
- `/home/peakviker/bybit-mcp/src/grid_snapshot.ts` uses bot detail plus wallet, positions, open orders, and strategy order list.
- This is the correct current priority because generic account surfaces can be empty while the bot remains active.

## Upstream bot coverage

Upstream bot tool index lists 18 bot tools:
- `/tmp/trading-mcp/src/tools/bot/index.ts:21-40`

Coverage families:
- futures grid bot: create, close, detail, validate
- spot grid bot: create, close, detail, validate
- futures martingale bot: create, close, detail, limits
- combo bot: create, close, detail, limits
- DCA bot: create, close

Important upstream futures grid files:
- `/tmp/trading-mcp/src/tools/bot/getFGridDetail.ts:5-13` maps `getFGridDetail` to `POST /v5/fgridbot/detail`.
- `/tmp/trading-mcp/src/tools/bot/validateFGridInput.ts:5-30` maps validation to `POST /v5/fgridbot/validate`.
- `/tmp/trading-mcp/src/tools/bot/closeFGridBot.ts:5-13` maps close to `POST /v5/fgridbot/close`.

Useful description from upstream `getFGridDetail`:
- It says detail includes configuration, current status, PnL metrics, position info, margin balances, and timestamps.
- It explicitly advises preferring this endpoint for questions about a specific bot performance.

## Upstream strategy coverage

Upstream strategy category has 6 tools according to README:
- `/tmp/trading-mcp/README.md:359` — TWAP, Chase Limit, Iceberg strategy orders; create, list, sub-order list, stop.

Key files:
- `/tmp/trading-mcp/src/tools/strategy/queryStrategyList.ts:5-21`
- `/tmp/trading-mcp/src/tools/strategy/queryStrategyOrderList.ts:5-21`

Official docs:
- `/v5/strategy/list` exists in the official documentation page fetched from `https://bybit-exchange.github.io/docs/v5/strategy/strategy-list`.
- `/v5/strategy/order-list` exists in the official documentation page fetched from `https://bybit-exchange.github.io/docs/v5/strategy/order-list`.

Upstream status notes:
- strategy statuses described by upstream: `2` running, `3/4` terminated, `5` paused, `6` untriggered.
- strategy order statuses described by upstream: `1` created, `2` partially filled, `3` filled, `4` cancelled, `5` rejected.
- `strategyId` is required for child order list.

## Coverage recommendation

Do not mirror all 258 upstream tools.

For this watcher-first repo, useful endpoint coverage should be ranked:

1. Keep `/v5/fgridbot/detail` as authoritative bot-layer truth.
   - Already present.
   - Highest value.

2. Keep `/v5/fgridbot/validate` documented as parameter-boundary discovery.
   - Useful before any future create/amend workflow.
   - Also useful for operator explanations of valid grid ranges.

3. Keep `/v5/fgridbot/close` isolated behind strict confirmation.
   - Useful for emergency operator action.
   - Dangerous enough to keep outside routine watcher flow.

4. Improve local strategy list/order list typing and docs.
   - These endpoints are officially documented and reachable.
   - They help diagnose child-order lineage for TWAP/Iceberg/Chase strategies, but may not explain grid-bot child orders if grid bots do not surface as strategy namespace objects.

5. Defer broad bot families.
   - Spot grid, DCA, martingale, combo are out of scope unless the operator starts using those products.

## Important uncertainty

The official fgridbot detail docs page URL attempted here returned 404, while upstream `trading-mcp` has a working generated wrapper for `/v5/fgridbot/detail`. Treat the endpoint as project-proven and upstream-supported, but not independently documented by that attempted public URL.

## Recommendation

For the next documentation/coding phase, create a small endpoint coverage table in the repo README or a dedicated runtime schema doc:

- endpoint
- local tool name
- auth/write risk
- watcher usage
- source evidence
- operator use case

This will prevent future sessions from confusing generic strategy endpoints with bot-layer grid truth.
