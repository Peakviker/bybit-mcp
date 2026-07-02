import * as fs from 'node:fs';
import { runtimePath } from './paths.js';

export type DeliveryOutcome = 'noop' | 'delivered' | 'error';

export type GridRiskDeliveryHealth = {
  version: 1;
  lastRunTs: number | null;
  lastDeliveredTs: number | null;
  lastSeenAlertTs: number | null;
  lastOutcome: DeliveryOutcome | null;
  lastError: string | null;
  pendingAlertCountEstimate: number;
};

const DELIVERY_HEALTH_PATH = runtimePath('grid-risk-delivery-health.json');

export function defaultDeliveryHealth(): GridRiskDeliveryHealth {
  return {
    version: 1,
    lastRunTs: null,
    lastDeliveredTs: null,
    lastSeenAlertTs: null,
    lastOutcome: null,
    lastError: null,
    pendingAlertCountEstimate: 0,
  };
}

export function readDeliveryHealth(): GridRiskDeliveryHealth {
  if (!fs.existsSync(DELIVERY_HEALTH_PATH)) {
    return defaultDeliveryHealth();
  }
  try {
    return JSON.parse(fs.readFileSync(DELIVERY_HEALTH_PATH, 'utf8')) as GridRiskDeliveryHealth;
  } catch {
    return defaultDeliveryHealth();
  }
}

export function writeDeliveryHealth(state: GridRiskDeliveryHealth): void {
  const tmp = `${DELIVERY_HEALTH_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmp, DELIVERY_HEALTH_PATH);
}
