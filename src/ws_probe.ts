import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { WebsocketClient } from 'bybit-api';
import { getBybitRuntime, loadBybitEnv } from './env.js';

type ProbeTopic = 'order' | 'execution' | 'position' | 'wallet';

type ProbeEvent = {
  kind: 'event';
  ts: number;
  topic: ProbeTopic | 'unknown';
  data: unknown;
};

type ProbeHeartbeat = {
  kind: 'heartbeat';
  ts: number;
  connected: boolean;
  reconnects: number;
  subscriptions: ProbeTopic[];
};

type ProbeStatus = {
  kind: 'status';
  ts: number;
  phase: 'starting' | 'open' | 'response' | 'reconnect' | 'close' | 'error';
  message: string;
  details?: unknown;
};

type ProbeLine = ProbeEvent | ProbeHeartbeat | ProbeStatus;

const BOT_ID = '624873434886723147';
const SUBSCRIPTIONS: ProbeTopic[] = ['order', 'execution', 'position', 'wallet'];
const RUNTIME_DIR = '/home/peakviker/bybit-mcp/runtime';
const LOG_PATH = path.join(RUNTIME_DIR, 'ws-probe.jsonl');

fs.mkdirSync(RUNTIME_DIR, { recursive: true });
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

let connected = false;
let reconnects = 0;

function writeLine(line: ProbeLine): void {
  const json = JSON.stringify(line);
  fs.appendFileSync(LOG_PATH, json + '\n');
  process.stdout.write(json + '\n');
}

function status(phase: ProbeStatus['phase'], message: string, details?: unknown): void {
  writeLine({ kind: 'status', ts: Date.now(), phase, message, details });
}

status('starting', 'ws probe boot', {
  botId: BOT_ID,
  testnet: runtime.testnet,
  subscriptions: SUBSCRIPTIONS,
  logPath: LOG_PATH,
});

emitter.on('open', (event) => {
  connected = true;
  const details = event && typeof event === 'object'
    ? { wsKey: (event as { wsKey?: unknown }).wsKey }
    : undefined;
  status('open', 'websocket opened', details);
  try {
    ws.subscribeV5([...SUBSCRIPTIONS], 'private' as any, true);
  } catch (error) {
    status('error', 'subscribeV5 failed', String(error));
  }
});

emitter.on('update', (event: unknown) => {
  const typedEvent = event as { topic?: string };
  const topic = typeof typedEvent?.topic === 'string' ? typedEvent.topic.split('.')[0] : 'unknown';
  writeLine({
    kind: 'event',
    ts: Date.now(),
    topic: (topic === 'order' || topic === 'execution' || topic === 'position' || topic === 'wallet') ? topic : 'unknown',
    data: event,
  });
});

emitter.on('response', (event) => {
  status('response', 'ws response', event);
});

emitter.on('reconnect', (event) => {
  reconnects += 1;
  connected = false;
  status('reconnect', 'ws reconnect', { reconnects, event });
});

emitter.on('close', (event) => {
  connected = false;
  status('close', 'ws close', event);
});

emitter.on('error', (event: unknown) => {
  connected = false;
  status('error', 'ws error', String(event));
});

const heartbeat = setInterval(() => {
  writeLine({
    kind: 'heartbeat',
    ts: Date.now(),
    connected,
    reconnects,
    subscriptions: SUBSCRIPTIONS,
  });
}, 30_000);

const shutdown = (signal: string) => {
  clearInterval(heartbeat);
  status('close', 'probe shutdown', { signal, reconnects });
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  ws.subscribeV5([...SUBSCRIPTIONS], 'private' as any, true);
} catch (error) {
  status('error', 'initial subscribeV5 failed', String(error));
}
