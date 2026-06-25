import fs from 'node:fs';
import { appendJsonl } from '../src/persist.js';
import { formatRiskAlert } from '../src/format_alert.js';
import type { GridBotSnapshot } from '../src/grid_snapshot.js';
import { computeRiskDelta } from '../src/risk_delta.js';
import { computeRiskMetrics } from '../src/risk_metrics.js';
import { evaluateRiskRules } from '../src/risk_rules.js';

const SNAPSHOT_PATH = '/home/peakviker/bybit-mcp/runtime/grid-snapshots.jsonl';

function readJsonl<T>(path: string): T[] {
  if (!fs.existsSync(path)) return [];
  const content = fs.readFileSync(path, 'utf8').trim();
  if (!content) return [];
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function pickSnapshots(all: GridBotSnapshot[], botId?: string): { current: GridBotSnapshot; previous: GridBotSnapshot | null } {
  const filtered = botId ? all.filter((row) => row.botId === botId) : all;
  if (filtered.length === 0) {
    throw new Error('No snapshots available');
  }
  const current = filtered[filtered.length - 1];
  const previous = filtered.length > 1 ? filtered[filtered.length - 2] : null;
  return { current, previous };
}

async function main(): Promise<void> {
  const botId = process.argv[2] || undefined;
  const snapshots = readJsonl<GridBotSnapshot>(SNAPSHOT_PATH);
  const { current, previous } = pickSnapshots(snapshots, botId);

  const currentMetrics = computeRiskMetrics(current);
  const previousMetrics = previous ? computeRiskMetrics(previous) : null;
  const delta = computeRiskDelta(currentMetrics, previousMetrics);
  const alerts = evaluateRiskRules(currentMetrics, delta);

  const metricsPath = appendJsonl('risk-metrics.jsonl', currentMetrics);
  const deltaPath = appendJsonl('risk-deltas.jsonl', delta);
  const alertsPath = alerts.length > 0 ? appendJsonl('risk-alerts.jsonl', alerts) : null;
  const formattedAlerts = alerts.map(formatRiskAlert);
  const formattedPath = formattedAlerts.length > 0
    ? appendJsonl('risk-alerts-formatted.jsonl', formattedAlerts)
    : null;

  process.stdout.write(JSON.stringify({
    ok: true,
    metricsPath,
    deltaPath,
    alertsPath,
    formattedPath,
    currentMetrics,
    previousMetrics,
    delta,
    alerts,
    formattedAlerts,
  }, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\n');
  process.exit(1);
});
