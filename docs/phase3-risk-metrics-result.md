# Phase 3 Risk Metrics Result

Date: 2026-06-25
Environment: [MAINNET]
Bot: 624873434886723147

## Files added

- `/home/peakviker/bybit-mcp/src/risk_metrics.ts`
- `/home/peakviker/bybit-mcp/src/risk_delta.ts`
- `/home/peakviker/bybit-mcp/scripts/compute_risk_metrics.ts`

## Runtime artifacts

- `/home/peakviker/bybit-mcp/runtime/risk-metrics.jsonl`
- `/home/peakviker/bybit-mcp/runtime/risk-deltas.jsonl`

## Real execution result

Risk metrics were computed successfully from the real bot snapshot.

## Current computed metrics

- `symbol`: `BTCUSDT`
- `netPnl`: `4.79`
- `gridProfit`: `18.66`
- `directionalDrag`: `-13.87`
- `equity`: `204.79`
- `positionBalance`: `86.54`
- `orderBalance`: `85.48`
- `availableBalance`: `31.46`
- `reserveRatio`: `0.83998`
- `positionSize`: `0.014`
- `entryPrice`: `63849.5`
- `markPrice`: `61605.76`
- `liquidationPrice`: `47708.17`
- `liqBufferPct`: `0.22559`
- `distanceToLowerBandPct`: `0.03669`
- `distanceToUpperBandPct`: `0.07145`
- `activeRangeWidthPct`: `0.10814`
- `activeLowerBand`: `59345.2`
- `activeUpperBand`: `66007.2`
- `leverage`: `10`
- `arbitrageNum`: `121`
- `side`: `FUTURES_POSITION_SIDE_LONG`

## Interpretation

The current snapshot says:
- the grid is profitable on spread capture (`gridProfit > 0`)
- the bot still carries meaningful directional drag (`directionalDrag < 0`)
- reserve usage is already high (`reserveRatio ~ 84%`)
- liquidation buffer is not immediately dangerous (`~22.6%` away)
- the bot remains closer to the lower active band than to the upper band

## Delta status

Current run produced a `baseline` delta only because there is only one snapshot in the local snapshot store for this Phase 3 run.

This is expected and correct.
Once multiple snapshots exist, the same script will emit:
- `deltaNetPnl`
- `deltaGridProfit`
- `deltaDirectionalDrag`
- `deltaReserveRatio`
- `deltaPositionSize`
- `deltaArbitrageNum`
- `deltaEquity`

## Conclusion

Phase 3 is successful.
The next step is Phase 4:
- rule engine
- alert severity classification
- integration with watcher cycle
