import type { RiskMetrics } from './risk_metrics.js';

export type RiskDelta = {
  kind: 'baseline' | 'delta';
  currentTs: number;
  previousTs: number | null;
  deltaNetPnl: number | null;
  deltaGridProfit: number | null;
  deltaDirectionalDrag: number | null;
  deltaReserveRatio: number | null;
  deltaPositionSize: number | null;
  deltaArbitrageNum: number | null;
  deltaEquity: number | null;
};

function diff(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return current - previous;
}

export function computeRiskDelta(current: RiskMetrics, previous: RiskMetrics | null): RiskDelta {
  if (!previous) {
    return {
      kind: 'baseline',
      currentTs: current.ts,
      previousTs: null,
      deltaNetPnl: null,
      deltaGridProfit: null,
      deltaDirectionalDrag: null,
      deltaReserveRatio: null,
      deltaPositionSize: null,
      deltaArbitrageNum: null,
      deltaEquity: null,
    };
  }

  return {
    kind: 'delta',
    currentTs: current.ts,
    previousTs: previous.ts,
    deltaNetPnl: diff(current.netPnl, previous.netPnl),
    deltaGridProfit: diff(current.gridProfit, previous.gridProfit),
    deltaDirectionalDrag: diff(current.directionalDrag, previous.directionalDrag),
    deltaReserveRatio: diff(current.reserveRatio, previous.reserveRatio),
    deltaPositionSize: diff(current.positionSize, previous.positionSize),
    deltaArbitrageNum: diff(current.arbitrageNum, previous.arbitrageNum),
    deltaEquity: diff(current.equity, previous.equity),
  };
}
