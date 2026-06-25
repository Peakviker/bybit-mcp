import * as fs from 'node:fs';
import { runtimePath } from '../src/paths.js';
import { fmtHour, fmtTs, nearestByTs, readJsonl, sparkline, summarize } from '../src/runtime_stats.js';

type Severity = 'INFO' | 'WARN' | 'CRITICAL';

type RiskMetrics = {
  ts: number;
  botId: string;
  symbol: string | null;
  netPnl: number | null;
  gridProfit: number | null;
  directionalDrag: number | null;
  equity: number | null;
  reserveRatio: number | null;
  positionSize: number | null;
  markPrice: number | null;
  liquidationPrice: number | null;
  liqBufferPct: number | null;
  distanceToLowerBandPct: number | null;
  distanceToUpperBandPct: number | null;
  activeRangeWidthPct: number | null;
  arbitrageNum: number | null;
  side: string | null;
};

type RiskAlert = {
  ts: number;
  botId: string;
  severity: Severity;
  code: string;
  message: string;
  metrics?: RiskMetrics;
  delta?: {
    deltaEquity?: number | null;
    deltaReserveRatio?: number | null;
    deltaDirectionalDrag?: number | null;
    deltaPositionSize?: number | null;
    deltaArbitrageNum?: number | null;
  };
};

type DeliveryState = {
  lastDeliveredTs: number;
};

const METRICS_PATH = runtimePath('risk-metrics.jsonl');
const ALERTS_PATH = runtimePath('risk-alerts.jsonl');
const DELIVERY_STATE_PATH = runtimePath('alert-delivery-state.json');
const FORMATTED_ALERTS_PATH = runtimePath('risk-alerts-formatted.log');
const SPARK_BLOCKS = '▁▂▃▄▅▆▇█';

function readDeliveryState(): DeliveryState | null {
  if (!fs.existsSync(DELIVERY_STATE_PATH)) return null;
  return JSON.parse(fs.readFileSync(DELIVERY_STATE_PATH, 'utf8')) as DeliveryState;
}

function readLatestFormattedAlert(): string | null {
  if (!fs.existsSync(FORMATTED_ALERTS_PATH)) return null;
  const content = fs.readFileSync(FORMATTED_ALERTS_PATH, 'utf8').trim();
  if (!content) return null;
  const chunks = content.split('\n---\n').filter(Boolean);
  return chunks.length > 0 ? chunks[chunks.length - 1] : null;
}

function main(): void {
  const metrics = readJsonl<RiskMetrics>(METRICS_PATH).sort((a, b) => a.ts - b.ts);
  const alerts = readJsonl<RiskAlert>(ALERTS_PATH).sort((a, b) => a.ts - b.ts);
  const deliveryState = readDeliveryState();
  const latestFormattedAlert = readLatestFormattedAlert();

  if (metrics.length === 0) {
    process.stdout.write(JSON.stringify({ ok: true, message: 'No risk metrics yet' }, null, 2) + '\n');
    return;
  }

  const latestMetrics = metrics[metrics.length - 1];
  const last12Metrics = metrics.slice(-12);
  const last5Alerts = alerts.slice(-5).map((alert) => {
    const metric = alert.metrics ?? nearestByTs(metrics, alert.ts);
    return {
      tsUtc: fmtTs(alert.ts),
      severity: alert.severity,
      code: alert.code,
      message: alert.message,
      equity: metric?.equity ?? null,
      reserveRatio: metric?.reserveRatio ?? null,
      liqBufferPct: metric?.liqBufferPct ?? null,
      directionalDrag: metric?.directionalDrag ?? null,
      deltaEquity: alert.delta?.deltaEquity ?? null,
      deltaReserveRatio: alert.delta?.deltaReserveRatio ?? null,
      deltaDirectionalDrag: alert.delta?.deltaDirectionalDrag ?? null,
    };
  });

  const severityCounts = { INFO: 0, WARN: 0, CRITICAL: 0 };
  const codeCounts = new Map<string, number>();
  for (const alert of alerts) {
    severityCounts[alert.severity] += 1;
    codeCounts.set(alert.code, (codeCounts.get(alert.code) ?? 0) + 1);
  }

  const hourlyAlerts = new Map<string, { total: number; INFO: number; WARN: number; CRITICAL: number }>();
  for (const alert of alerts) {
    const hour = fmtHour(alert.ts);
    const bucket = hourlyAlerts.get(hour) ?? { total: 0, INFO: 0, WARN: 0, CRITICAL: 0 };
    bucket.total += 1;
    bucket[alert.severity] += 1;
    hourlyAlerts.set(hour, bucket);
  }

  const hourlyMetrics = new Map<string, RiskMetrics[]>();
  for (const row of metrics) {
    const hour = fmtHour(row.ts);
    const bucket = hourlyMetrics.get(hour) ?? [];
    bucket.push(row);
    hourlyMetrics.set(hour, bucket);
  }

  const dashboard = {
    ok: true,
    generatedAtUtc: fmtTs(Date.now()),
    source: {
      metricsPath: METRICS_PATH,
      alertsPath: ALERTS_PATH,
      deliveryStatePath: DELIVERY_STATE_PATH,
    },
    latest: {
      metricsTsUtc: fmtTs(latestMetrics.ts),
      symbol: latestMetrics.symbol,
      side: latestMetrics.side,
      equity: latestMetrics.equity,
      reserveRatio: latestMetrics.reserveRatio,
      liqBufferPct: latestMetrics.liqBufferPct,
      directionalDrag: latestMetrics.directionalDrag,
      distanceToLowerBandPct: latestMetrics.distanceToLowerBandPct,
      distanceToUpperBandPct: latestMetrics.distanceToUpperBandPct,
      positionSize: latestMetrics.positionSize,
      markPrice: latestMetrics.markPrice,
      liquidationPrice: latestMetrics.liquidationPrice,
      arbitrageNum: latestMetrics.arbitrageNum,
      latestFormattedAlert,
    },
    alertSummary: {
      totalAlerts: alerts.length,
      firstAlertUtc: alerts.length ? fmtTs(alerts[0].ts) : null,
      lastAlertUtc: alerts.length ? fmtTs(alerts[alerts.length - 1].ts) : null,
      severityCounts,
      topCodes: Array.from(codeCounts.entries()).sort((a, b) => b[1] - a[1]).map(([code, count]) => ({ code, count })),
      last5Alerts,
      deliveryState,
    },
    metricRanges: {
      equity: summarize(metrics.map((r) => r.equity)),
      reserveRatio: summarize(metrics.map((r) => r.reserveRatio)),
      liqBufferPct: summarize(metrics.map((r) => r.liqBufferPct)),
      directionalDrag: summarize(metrics.map((r) => r.directionalDrag)),
      distanceToLowerBandPct: summarize(metrics.map((r) => r.distanceToLowerBandPct)),
      positionSize: summarize(metrics.map((r) => r.positionSize)),
    },
    sparklinesLast12: {
      equity: sparkline(last12Metrics.map((r) => r.equity)),
      reserveRatio: sparkline(last12Metrics.map((r) => r.reserveRatio)),
      liqBufferPct: sparkline(last12Metrics.map((r) => r.liqBufferPct)),
      directionalDrag: sparkline(last12Metrics.map((r) => r.directionalDrag)),
      distanceToLowerBandPct: sparkline(last12Metrics.map((r) => r.distanceToLowerBandPct)),
      positionSize: sparkline(last12Metrics.map((r) => r.positionSize)),
    },
    hourly: {
      alerts: Array.from(hourlyAlerts.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([hour, row]) => ({ hour, ...row })),
      metrics: Array.from(hourlyMetrics.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([hour, bucket]) => {
        const last = bucket[bucket.length - 1];
        return {
          hour,
          samples: bucket.length,
          equity: last.equity,
          reserveRatio: last.reserveRatio,
          liqBufferPct: last.liqBufferPct,
          directionalDrag: last.directionalDrag,
          positionSize: last.positionSize,
        };
      }),
    },
  };

  process.stdout.write(JSON.stringify(dashboard, null, 2) + '\n');
}

main();
