import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { WebsocketClient } from 'bybit-api';
import { getBybitRuntime, loadBybitEnv } from './env.js';
import { collectGridBotSnapshot } from './grid_snapshot.js';
import { appendJsonl, ensureRuntimeDir } from './persist.js';
import { appendFormattedAlerts } from './alert_delivery.js';
import { runtimePath } from './paths.js';
import { computeRiskDelta } from './risk_delta.js';
import { computeRiskMetrics, type RiskMetrics } from './risk_metrics.js';
import { evaluateRiskRules } from './risk_rules.js';

const BOT_ID = '624873434886723147';
const SUBSCRIPTIONS = ['order', 'execution', 'position', 'wallet'] as const;
const WATCHER_LOG = runtimePath('grid-risk-watcher.jsonl');
const DEBOUNCE_MS = 3000;
const PERIODIC_CYCLE_MS = 20_000;

type WatcherStatus = {
  kind: 'status' | 'event' | 'cycle';
  ts: number;
  message: string;
  details?: unknown;
};

ensureRuntimeDir();
loadBybitEnv();
const runtime = getBybitRuntime();

const ws = new WebsocketClient({
  key: runtime.key,
  secret: runtime.secret,
  testnet: runtime.testnet,
  recvWindow: runtime.recvWindow,
  market: 'v5',
  pongTimeout: 1000,
  reconnectTimeout: 1000,
  promiseSubscribeRequests: false,
});
const emitter = ws as unknown as EventEmitter;

let previousMetrics: RiskMetrics | null = null;
let cycleTimer: NodeJS.Timeout | null = null;
let pendingTopics = new Set<string>();
let runningCycle = false;

function log(line: WatcherStatus): void {
  const json = JSON.stringify(line);
  fs.appendFileSync(WATCHER_LOG, json + '\n');
  process.stdout.write(json + '\n');
}

async function runCycle(reason: string): Promise<void> {
  if (runningCycle) return;
  runningCycle = true;
  const topics = Array.from(pendingTopics);
  pendingTopics.clear();

  try {
    const snapshot = await collectGridBotSnapshot(BOT_ID);
    const metrics = computeRiskMetrics(snapshot);
    const delta = computeRiskDelta(metrics, previousMetrics);
    const alerts = evaluateRiskRules(metrics, delta);

    appendJsonl('grid-snapshots.jsonl', snapshot);
    appendJsonl('risk-metrics.jsonl', metrics);
    appendJsonl('risk-deltas.jsonl', delta);
    let formattedPath: string | null = null;
    if (alerts.length > 0) {
      appendJsonl('risk-alerts.jsonl', alerts);
      formattedPath = appendFormattedAlerts(alerts);
    }

    previousMetrics = metrics;

    log({
      kind: 'cycle',
      ts: Date.now(),
      message: 'risk cycle completed',
      details: {
        reason,
        topics,
        alertCount: alerts.length,
        severities: alerts.map((alert) => alert.severity),
        codes: alerts.map((alert) => alert.code),
        formattedPath,
      },
    });
  } catch (error) {
    log({
      kind: 'status',
      ts: Date.now(),
      message: 'risk cycle failed',
      details: String(error instanceof Error ? error.stack ?? error.message : error),
    });
  } finally {
    runningCycle = false;
  }
}

function scheduleCycle(topic: string): void {
  pendingTopics.add(topic);
  if (cycleTimer) clearTimeout(cycleTimer);
  cycleTimer = setTimeout(() => {
    void runCycle('ws-event-burst');
  }, DEBOUNCE_MS);
}

const periodicCycle = setInterval(() => {
  void runCycle('timer-20s');
}, PERIODIC_CYCLE_MS);

log({
  kind: 'status',
  ts: Date.now(),
  message: 'grid risk watcher boot',
  details: { botId: BOT_ID, subscriptions: SUBSCRIPTIONS, debounceMs: DEBOUNCE_MS },
});

emitter.on('open', () => {
  log({ kind: 'status', ts: Date.now(), message: 'private ws opened', details: { wsKey: 'v5Private' } });
  ws.subscribeV5([...SUBSCRIPTIONS], 'private' as any, true);
});

emitter.on('response', (event) => {
  log({ kind: 'status', ts: Date.now(), message: 'ws response', details: event });
});

emitter.on('update', (event: unknown) => {
  const typedEvent = event as { topic?: string };
  const topic = typeof typedEvent.topic === 'string' ? typedEvent.topic.split('.')[0] : 'unknown';
  log({ kind: 'event', ts: Date.now(), message: 'ws update', details: { topic } });
  scheduleCycle(topic);
});

emitter.on('reconnect', (event) => {
  log({ kind: 'status', ts: Date.now(), message: 'ws reconnect', details: event });
});

emitter.on('error', (event: unknown) => {
  log({ kind: 'status', ts: Date.now(), message: 'ws error', details: String(event) });
});

emitter.on('close', (event) => {
  log({ kind: 'status', ts: Date.now(), message: 'ws close', details: event });
});

try {
  ws.subscribeV5([...SUBSCRIPTIONS], 'private' as any, true);
} catch (error) {
  log({ kind: 'status', ts: Date.now(), message: 'initial subscribe failed', details: String(error) });
}

process.on('SIGINT', () => {
  clearInterval(periodicCycle);
  process.exit(0);
});
process.on('SIGTERM', () => {
  clearInterval(periodicCycle);
  process.exit(0);
});
