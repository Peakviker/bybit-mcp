import type { RiskAlert } from './risk_rules.js';

function formatNumber(value: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return value.toFixed(digits);
}

function formatPct(value: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatSigned(value: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return 'n/a';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}`;
}

export function formatRiskAlert(alert: RiskAlert): string {
  const metrics = alert.metrics;
  const delta = alert.delta;

  const lines = [
    `[${alert.severity}][MAINNET] ${metrics.symbol ?? 'UNKNOWN'} grid bot ${alert.botId}`,
    `${alert.message}`,
    `code: ${alert.code}`,
    `position: ${formatNumber(metrics.positionSize, 3)} BTC`,
    `equity: ${formatNumber(metrics.equity)}`,
    `reserve ratio: ${formatPct(metrics.reserveRatio)}`,
    `grid profit: ${formatNumber(metrics.gridProfit)}`,
    `net pnl: ${formatNumber(metrics.netPnl)}`,
    `directional drag: ${formatNumber(metrics.directionalDrag)}`,
    `liq buffer: ${formatPct(metrics.liqBufferPct)}`,
    `distance to lower band: ${formatPct(metrics.distanceToLowerBandPct)}`,
  ];

  if (delta.kind === 'delta') {
    lines.push(`delta equity: ${formatSigned(delta.deltaEquity)}`);
    lines.push(`delta directional drag: ${formatSigned(delta.deltaDirectionalDrag)}`);
    lines.push(`delta position size: ${formatSigned(delta.deltaPositionSize, 3)}`);
    lines.push(`delta reserve ratio: ${formatPct(delta.deltaReserveRatio)}`);
    lines.push(`delta arbitrage num: ${formatSigned(delta.deltaArbitrageNum, 0)}`);
  } else {
    lines.push('delta: baseline');
  }

  return lines.join('\n');
}
