import { runtimePath } from '../src/paths.js';
import { fmtTs, fmtHour, readJsonlSingle, sparkline, summarize } from '../src/runtime_stats.js';

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

const METRICS_PATH = runtimePath('risk-metrics.jsonl');
const SPARK_BLOCKS = '▁▂▃▄▅▆▇█';

function main(): void {
  const rows = readJsonlSingle<RiskMetrics>(METRICS_PATH).sort((a, b) => a.ts - b.ts);
  if (rows.length === 0) {
    process.stdout.write(JSON.stringify({ ok: true, totalRows: 0, message: 'No risk metrics yet' }, null, 2) + '\n');
    return;
  }

  const latest = rows[rows.length - 1];
  const last12 = rows.slice(-12);

  const byHour = new Map<string, RiskMetrics[]>();
  for (const row of rows) {
    const hour = fmtHour(row.ts);
    const bucket = byHour.get(hour) ?? [];
    bucket.push(row);
    byHour.set(hour, bucket);
  }

  const hourly = Array.from(byHour.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([hour, bucket]) => {
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
    });

  const equitySeries = rows.map((r) => r.equity);
  const reserveSeries = rows.map((r) => r.reserveRatio);
  const liqSeries = rows.map((r) => r.liqBufferPct);
  const dragSeries = rows.map((r) => r.directionalDrag);
  const lowerBandDistSeries = rows.map((r) => r.distanceToLowerBandPct);
  const posSeries = rows.map((r) => r.positionSize);

  const report = {
    ok: true,
    source: METRICS_PATH,
    totalRows: rows.length,
    firstTsUtc: fmtTs(rows[0].ts),
    lastTsUtc: fmtTs(latest.ts),
    latest: {
      tsUtc: fmtTs(latest.ts),
      symbol: latest.symbol,
      side: latest.side,
      equity: latest.equity,
      reserveRatio: latest.reserveRatio,
      liqBufferPct: latest.liqBufferPct,
      directionalDrag: latest.directionalDrag,
      distanceToLowerBandPct: latest.distanceToLowerBandPct,
      distanceToUpperBandPct: latest.distanceToUpperBandPct,
      positionSize: latest.positionSize,
      markPrice: latest.markPrice,
      liquidationPrice: latest.liquidationPrice,
      arbitrageNum: latest.arbitrageNum,
    },
    ranges: {
      equity: summarize(equitySeries),
      reserveRatio: summarize(reserveSeries),
      liqBufferPct: summarize(liqSeries),
      directionalDrag: summarize(dragSeries),
      distanceToLowerBandPct: summarize(lowerBandDistSeries),
      positionSize: summarize(posSeries),
    },
    sparklinesLast12: {
      equity: sparkline(last12.map((r) => r.equity)),
      reserveRatio: sparkline(last12.map((r) => r.reserveRatio)),
      liqBufferPct: sparkline(last12.map((r) => r.liqBufferPct)),
      directionalDrag: sparkline(last12.map((r) => r.directionalDrag)),
      distanceToLowerBandPct: sparkline(last12.map((r) => r.distanceToLowerBandPct)),
      positionSize: sparkline(last12.map((r) => r.positionSize)),
    },
    hourly,
  };

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main();
