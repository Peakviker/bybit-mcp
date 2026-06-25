import type { GridBotSnapshot } from './grid_snapshot.js';

export type RiskMetrics = {
  ts: number;
  botId: string;
  symbol: string | null;
  netPnl: number | null;
  gridProfit: number | null;
  directionalDrag: number | null;
  equity: number | null;
  positionBalance: number | null;
  orderBalance: number | null;
  availableBalance: number | null;
  reserveRatio: number | null;
  positionSize: number | null;
  entryPrice: number | null;
  markPrice: number | null;
  liquidationPrice: number | null;
  liqBufferPct: number | null;
  distanceToLowerBandPct: number | null;
  distanceToUpperBandPct: number | null;
  activeRangeWidthPct: number | null;
  lowerBand: number | null;
  upperBand: number | null;
  activeLowerBand: number | null;
  activeUpperBand: number | null;
  leverage: number | null;
  arbitrageNum: number | null;
  side: string | null;
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

export function computeRiskMetrics(snapshot: GridBotSnapshot): RiskMetrics {
  const detail = snapshot.detail;

  const netPnl = toNumber(detail.pnl ?? detail.current_profit);
  const gridProfit = toNumber(detail.grid_profit);
  const equity = toNumber(detail.equity);
  const positionBalance = toNumber(detail.position_balance);
  const orderBalance = toNumber(detail.total_order_balance);
  const availableBalance = toNumber(detail.available_balance);
  const positionSize = toNumber(detail.current_position);
  const entryPrice = toNumber(detail.entry_price);
  const markPrice = toNumber(detail.mark_price ?? detail.last_price);
  const liquidationPrice = toNumber(detail.liquidation_price);
  const lowerBand = toNumber(detail.min_price);
  const upperBand = toNumber(detail.max_price);
  const activeLowerBand = toNumber(detail.curr_min_price ?? detail.min_price);
  const activeUpperBand = toNumber(detail.curr_max_price ?? detail.max_price);
  const leverage = toNumber(detail.leverage);
  const arbitrageNum = toNumber(detail.arbitrage_num);
  const directionalDrag = netPnl != null && gridProfit != null ? netPnl - gridProfit : null;
  const reserveBase =
    positionBalance != null && orderBalance != null
      ? positionBalance + orderBalance
      : null;
  const reserveRatio = ratio(reserveBase, equity);
  const liqBufferPct =
    markPrice != null && markPrice !== 0 && liquidationPrice != null
      ? Math.abs(markPrice - liquidationPrice) / markPrice
      : null;
  const distanceToLowerBandPct =
    markPrice != null && markPrice !== 0 && activeLowerBand != null
      ? (markPrice - activeLowerBand) / markPrice
      : null;
  const distanceToUpperBandPct =
    markPrice != null && markPrice !== 0 && activeUpperBand != null
      ? (activeUpperBand - markPrice) / markPrice
      : null;
  const activeRangeWidthPct =
    markPrice != null && markPrice !== 0 && activeLowerBand != null && activeUpperBand != null
      ? (activeUpperBand - activeLowerBand) / markPrice
      : null;

  return {
    ts: snapshot.ts,
    botId: snapshot.botId,
    symbol: typeof detail.symbol === 'string' ? detail.symbol : null,
    netPnl,
    gridProfit,
    directionalDrag,
    equity,
    positionBalance,
    orderBalance,
    availableBalance,
    reserveRatio,
    positionSize,
    entryPrice,
    markPrice,
    liquidationPrice,
    liqBufferPct,
    distanceToLowerBandPct,
    distanceToUpperBandPct,
    activeRangeWidthPct,
    lowerBand,
    upperBand,
    activeLowerBand,
    activeUpperBand,
    leverage,
    arbitrageNum,
    side: typeof detail.futures_pos_side === 'string' ? detail.futures_pos_side : null,
  };
}
