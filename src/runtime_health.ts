import * as fs from 'node:fs';
import { runtimePath } from './paths.js';

export type RuntimeStatus = 'healthy' | 'warn' | 'degraded' | 'failed';
export type ErrorKind = 'auth' | 'timeout' | 'http' | 'bybit_api' | 'parse' | 'persist' | 'ws' | 'unknown';

export type GridRiskHealth = {
  botId: string;
  service: string;
  version: 1;
  startedAt: number;
  lastCycleStartedAt: number | null;
  lastCycleFinishedAt: number | null;
  lastSuccessTs: number | null;
  lastFailureTs: number | null;
  lastWsEventTs: number | null;
  lastSnapshotTs: number | null;
  lastAlertTs: number | null;
  consecutiveFailures: number;
  lastReason: string | null;
  lastTopics: string[];
  lastError: string | null;
  lastErrorKind: ErrorKind | null;
  lastFormattedAlertPath: string | null;
  runtimeStatus: RuntimeStatus;
};

const HEALTH_PATH = runtimePath('grid-risk-health.json');

export function defaultGridRiskHealth(botId: string, service = 'grid-risk-watcher.service'): GridRiskHealth {
  return {
    botId,
    service,
    version: 1,
    startedAt: Date.now(),
    lastCycleStartedAt: null,
    lastCycleFinishedAt: null,
    lastSuccessTs: null,
    lastFailureTs: null,
    lastWsEventTs: null,
    lastSnapshotTs: null,
    lastAlertTs: null,
    consecutiveFailures: 0,
    lastReason: null,
    lastTopics: [],
    lastError: null,
    lastErrorKind: null,
    lastFormattedAlertPath: null,
    runtimeStatus: 'healthy',
  };
}

export function writeGridRiskHealth(state: GridRiskHealth): void {
  const tmp = `${HEALTH_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmp, HEALTH_PATH);
}

export function readGridRiskHealth(): GridRiskHealth | null {
  try {
    if (!fs.existsSync(HEALTH_PATH)) return null;
    return JSON.parse(fs.readFileSync(HEALTH_PATH, 'utf8')) as GridRiskHealth;
  } catch {
    return null;
  }
}

export function getGridRiskHealthPath(): string {
  return HEALTH_PATH;
}

export function classifyRuntimeError(error: unknown): ErrorKind {
  const text = String(error instanceof Error ? error.stack ?? error.message : error).toLowerCase();
  if (text.includes('unauthorized') || text.includes('api key') || text.includes('signature') || text.includes('permission')) return 'auth';
  if (text.includes('timeout') || text.includes('timed out') || text.includes('abort')) return 'timeout';
  if (text.includes('http ')) return 'http';
  if (text.includes('bybit bot api error') || text.includes('bybit bot detail error') || text.includes('retcode')) return 'bybit_api';
  if (text.includes('json') || text.includes('parse')) return 'parse';
  if (text.includes('appendfile') || text.includes('writefile') || text.includes('rename') || text.includes('enoent') || text.includes('eacces')) return 'persist';
  if (text.includes('websocket') || text.includes('ws ')) return 'ws';
  return 'unknown';
}

export function statusFromFailures(consecutiveFailures: number): RuntimeStatus {
  if (consecutiveFailures >= 4) return 'failed';
  if (consecutiveFailures >= 2) return 'degraded';
  if (consecutiveFailures >= 1) return 'warn';
  return 'healthy';
}
