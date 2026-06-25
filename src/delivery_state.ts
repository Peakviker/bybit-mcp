import fs from 'node:fs';
import { runtimePath } from './paths.js';

const STATE_PATH = runtimePath('alert-delivery-state.json');

export type DeliveryState = {
  lastDeliveredTs: number;
};

export function readDeliveryState(): DeliveryState {
  if (!fs.existsSync(STATE_PATH)) {
    return { lastDeliveredTs: 0 };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as DeliveryState;
  } catch {
    return { lastDeliveredTs: 0 };
  }
}

export function writeDeliveryState(state: DeliveryState): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}
