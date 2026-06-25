# Phase 2 Snapshot Result

Date: 2026-06-25
Environment: [MAINNET]
Bot: 624873434886723147

## Files added

- `/home/peakviker/bybit-mcp/src/bybit_client.ts`
- `/home/peakviker/bybit-mcp/src/grid_snapshot.ts`
- `/home/peakviker/bybit-mcp/src/persist.ts`
- `/home/peakviker/bybit-mcp/scripts/collect_grid_snapshot.ts`

## Runtime artifact

- `/home/peakviker/bybit-mcp/runtime/grid-snapshots.jsonl`

## Real execution result

Snapshot collection succeeded with the current write-capable key/secret pair.

Collected sections:
- `detail`
- `wallet`
- `positions`
- `openOrders`
- `strategyOrders`

## Current observed state

From the real snapshot just collected:
- `status`: `FUTURE_GRID_STATUS_RUNNING`
- `symbol`: `BTCUSDT`
- `grid_mode`: `FUTURE_GRID_MODE_NEUTRAL`
- `cell_number`: `40`
- `leverage`: `10`
- `current_position`: `0.014`
- `arbitrage_num`: `121`
- `pnl`: `4.79`
- `grid_profit`: `18.66`
- `realised_pnl`: `-3.79`
- `unrealised_pnl`: `8.58`
- `position_balance`: `86.54`
- `available_balance`: `31.46`
- `total_order_balance`: `85.48`
- `equity`: `204.79`
- `mark_price`: `61605.76`
- `entry_price`: `63849.5`
- `liquidation_price`: `47708.17`

## Important observation

At the moment of this snapshot:
- `positions` came back empty from generic `linear` position list
- `openOrders` came back empty
- `strategyOrders` came back empty
- but `fgridbot/detail` clearly shows a running bot with non-zero current position and balances

Interpretation:
- Phase 2 confirms again that `fgridbot/detail` is the authoritative bot-layer snapshot
- generic account-layer endpoints are still insufficient to reconstruct the bot's live structure
- this does not block risk monitoring, because risk v1 can be computed from event stream + `fgridbot/detail` snapshot

## Conclusion

Phase 2 is successful.
Next step is Phase 3:
- normalize snapshot into risk metrics
- persist metrics
- compute deltas between snapshots
