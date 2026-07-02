import fs from 'node:fs';
import { readDeliveryHealth, writeDeliveryHealth } from '../src/delivery_health.js';
import { readDeliveryState, writeDeliveryState } from '../src/delivery_state.js';
import { runtimePath } from '../src/paths.js';

const RAW_ALERTS_PATH = runtimePath('risk-alerts.jsonl');

function readJsonl<T>(path: string): T[] {
  if (!fs.existsSync(path)) return [];
  const content = fs.readFileSync(path, 'utf8').trim();
  if (!content) return [];
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const parsed = JSON.parse(line);
      return Array.isArray(parsed) ? parsed : [parsed];
    }) as T[];
}

type AlertRecord = {
  ts: number;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  code: string;
  message: string;
};

function main(): void {
  const minSeverity = (process.argv[2] as AlertRecord['severity'] | undefined) ?? 'WARN';
  const severityRank: Record<AlertRecord['severity'], number> = {
    INFO: 1,
    WARN: 2,
    CRITICAL: 3,
  };

  const runTs = Date.now();
  const state = readDeliveryState();
  const deliveryHealth = readDeliveryHealth();
  const alerts = readJsonl<AlertRecord>(RAW_ALERTS_PATH)
    .filter((alert) => alert.ts > state.lastDeliveredTs)
    .filter((alert) => severityRank[alert.severity] >= severityRank[minSeverity])
    .sort((a, b) => a.ts - b.ts);

  const latestSeenAlertTs = alerts.length > 0 ? alerts[alerts.length - 1].ts : deliveryHealth.lastSeenAlertTs;

  if (alerts.length === 0) {
    writeDeliveryHealth({
      ...deliveryHealth,
      lastRunTs: runTs,
      lastSeenAlertTs: latestSeenAlertTs,
      lastOutcome: 'noop',
      lastError: null,
      pendingAlertCountEstimate: 0,
    });
    process.stdout.write('NO_NEW_ALERTS\n');
    return;
  }

  const latest = alerts[alerts.length - 1];
  process.stdout.write(JSON.stringify({
    ok: true,
    count: alerts.length,
    latest,
  }, null, 2) + '\n');

  writeDeliveryState({ lastDeliveredTs: latest.ts });
  writeDeliveryHealth({
    ...deliveryHealth,
    lastRunTs: runTs,
    lastDeliveredTs: latest.ts,
    lastSeenAlertTs: latest.ts,
    lastOutcome: 'delivered',
    lastError: null,
    pendingAlertCountEstimate: alerts.length,
  });
}

main();
