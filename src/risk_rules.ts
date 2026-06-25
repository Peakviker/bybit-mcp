import type { RiskDelta } from './risk_delta.js';
import type { RiskMetrics } from './risk_metrics.js';

export type RiskSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export type RiskAlert = {
  ts: number;
  botId: string;
  severity: RiskSeverity;
  code: string;
  message: string;
  metrics: RiskMetrics;
  delta: RiskDelta;
};

const WARN_RESERVE_RATIO = 0.85;
const CRITICAL_RESERVE_RATIO = 0.95;
const WARN_LIQ_BUFFER_PCT = 0.08;
const CRITICAL_LIQ_BUFFER_PCT = 0.05;
const NEAR_LOWER_BAND_PCT = 0.04;
const WARN_DIRECTIONAL_DRAG_DELTA = -2;
const CRITICAL_DIRECTIONAL_DRAG_DELTA = -5;
const WARN_EQUITY_DELTA = -5;
const CRITICAL_EQUITY_DELTA = -10;

function makeAlert(
  severity: RiskSeverity,
  code: string,
  message: string,
  metrics: RiskMetrics,
  delta: RiskDelta,
): RiskAlert {
  return {
    ts: Date.now(),
    botId: metrics.botId,
    severity,
    code,
    message,
    metrics,
    delta,
  };
}

export function evaluateRiskRules(metrics: RiskMetrics, delta: RiskDelta): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  if (metrics.reserveRatio != null) {
    if (metrics.reserveRatio >= CRITICAL_RESERVE_RATIO) {
      alerts.push(makeAlert('CRITICAL', 'reserve_ratio_critical', 'Reserve ratio is critically high', metrics, delta));
    } else if (metrics.reserveRatio >= WARN_RESERVE_RATIO) {
      alerts.push(makeAlert('WARN', 'reserve_ratio_warn', 'Reserve ratio is high', metrics, delta));
    }
  }

  if (metrics.liqBufferPct != null) {
    if (metrics.liqBufferPct <= CRITICAL_LIQ_BUFFER_PCT) {
      alerts.push(makeAlert('CRITICAL', 'liq_buffer_critical', 'Liquidation buffer is critically thin', metrics, delta));
    } else if (metrics.liqBufferPct <= WARN_LIQ_BUFFER_PCT) {
      alerts.push(makeAlert('WARN', 'liq_buffer_warn', 'Liquidation buffer is getting thin', metrics, delta));
    }
  }

  if (delta.kind === 'delta') {
    if (delta.deltaDirectionalDrag != null) {
      if (delta.deltaDirectionalDrag <= CRITICAL_DIRECTIONAL_DRAG_DELTA) {
        alerts.push(makeAlert('CRITICAL', 'directional_drag_critical', 'Directional drag worsened sharply', metrics, delta));
      } else if (delta.deltaDirectionalDrag <= WARN_DIRECTIONAL_DRAG_DELTA) {
        alerts.push(makeAlert('WARN', 'directional_drag_warn', 'Directional drag worsened', metrics, delta));
      }
    }

    if (delta.deltaEquity != null) {
      if (delta.deltaEquity <= CRITICAL_EQUITY_DELTA) {
        alerts.push(makeAlert('CRITICAL', 'equity_drop_critical', 'Equity dropped sharply', metrics, delta));
      } else if (delta.deltaEquity <= WARN_EQUITY_DELTA) {
        alerts.push(makeAlert('WARN', 'equity_drop_warn', 'Equity dropped', metrics, delta));
      }
    }

    if (
      delta.deltaPositionSize != null &&
      delta.deltaPositionSize > 0 &&
      metrics.distanceToLowerBandPct != null &&
      metrics.distanceToLowerBandPct <= NEAR_LOWER_BAND_PCT &&
      metrics.side?.includes('LONG')
    ) {
      alerts.push(
        makeAlert(
          'WARN',
          'long_inventory_near_lower_band',
          'Long inventory increased while price is near the lower active band',
          metrics,
          delta,
        ),
      );
    }

    if (delta.deltaArbitrageNum != null && delta.deltaArbitrageNum > 0) {
      alerts.push(makeAlert('INFO', 'grid_arbitrage_increment', 'Grid arbitrage count increased', metrics, delta));
    }
  }

  return alerts;
}
