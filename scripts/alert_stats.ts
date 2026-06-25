import { runtimePath } from '../src/paths.js';
import { fmtHour, fmtNum, fmtPct, fmtTs, nearestByTs, readJsonl, summarize } from '../src/runtime_stats.js';

type Severity = 'INFO' | 'WARN' | 'CRITICAL';

type RiskMetrics = {
  ts: number;
  botId: string;
  symbol: string | null;
  equity: number | null;
  reserveRatio: number | null;
  liqBufferPct: number | null;
  directionalDrag: number | null;
  distanceToLowerBandPct: number | null;
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

const ALERTS_PATH = runtimePath('risk-alerts.jsonl');
const METRICS_PATH = runtimePath('risk-metrics.jsonl');

function severityMark(severity: Severity): string {
  if (severity === 'CRITICAL') return '!!!';
  if (severity === 'WARN') return ' ! ';
  return ' i ';
}

function makeBar(total: number): string {
  return total > 0 ? '█'.repeat(total) : '';
}

function main(): void {
  const alerts = readJsonl<RiskAlert>(ALERTS_PATH).sort((a, b) => a.ts - b.ts);
  const metricsRows = readJsonl<RiskMetrics>(METRICS_PATH).sort((a, b) => a.ts - b.ts);

  if (alerts.length === 0) {
    process.stdout.write(JSON.stringify({ ok: true, totalAlerts: 0, message: 'No alerts yet' }, null, 2) + '\n');
    return;
  }

  const severityCounts = { INFO: 0, WARN: 0, CRITICAL: 0 };
  const codeCounts = new Map<string, number>();
  const hourly = new Map<string, { total: number; INFO: number; WARN: number; CRITICAL: number }>();

  for (const alert of alerts) {
    severityCounts[alert.severity] += 1;
    codeCounts.set(alert.code, (codeCounts.get(alert.code) ?? 0) + 1);
    const hour = fmtHour(alert.ts);
    const bucket = hourly.get(hour) ?? { total: 0, INFO: 0, WARN: 0, CRITICAL: 0 };
    bucket.total += 1;
    bucket[alert.severity] += 1;
    hourly.set(hour, bucket);
  }

  const codes = Array.from(codeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count }));

  const timeline = alerts.map((alert) => {
    const metrics = alert.metrics ?? nearestByTs(metricsRows, alert.ts);
    return {
      ts: alert.ts,
      ts_utc: fmtTs(alert.ts),
      severity: alert.severity,
      marker: severityMark(alert.severity),
      code: alert.code,
      message: alert.message,
      symbol: metrics?.symbol ?? '—',
      equity: metrics?.equity ?? null,
      reserveRatio: metrics?.reserveRatio ?? null,
      liqBufferPct: metrics?.liqBufferPct ?? null,
      directionalDrag: metrics?.directionalDrag ?? null,
      distanceToLowerBandPct: metrics?.distanceToLowerBandPct ?? null,
      deltaEquity: alert.delta?.deltaEquity ?? null,
      deltaReserveRatio: alert.delta?.deltaReserveRatio ?? null,
      deltaDirectionalDrag: alert.delta?.deltaDirectionalDrag ?? null,
      deltaPositionSize: alert.delta?.deltaPositionSize ?? null,
    };
  });

  const hourlyRows = Array.from(hourly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hour, row]) => ({
      hour,
      total: row.total,
      INFO: row.INFO,
      WARN: row.WARN,
      CRITICAL: row.CRITICAL,
      bar: makeBar(row.total),
    }));

  const asciiTimeline = timeline.map((row) => {
    return `${row.ts_utc} |${row.marker}| ${row.code} | eq ${fmtNum(row.equity)} | reserve ${fmtPct(row.reserveRatio)} | liq ${fmtPct(row.liqBufferPct)} | drag ${fmtNum(row.directionalDrag)} | dEq ${fmtNum(row.deltaEquity)} | dRes ${fmtPct(row.deltaReserveRatio, 2)} | dDrag ${fmtNum(row.deltaDirectionalDrag)}`;
  });

  process.stdout.write(JSON.stringify({
    ok: true,
    source: {
      alertsPath: ALERTS_PATH,
      metricsPath: METRICS_PATH,
    },
    summary: {
      totalAlerts: alerts.length,
      firstAlertUtc: fmtTs(alerts[0].ts),
      lastAlertUtc: fmtTs(alerts[alerts.length - 1].ts),
      severityCounts,
    },
    codes,
    hourly: hourlyRows,
    timeline,
    asciiTimeline,
  }, null, 2) + '\n');
}

main();
