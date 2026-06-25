import fs from 'node:fs';
import path from 'node:path';
import { BYBIT_ENV_PATH } from './paths.js';

export type BybitRuntime = {
  key: string;
  secret: string;
  testnet: boolean;
  recvWindow: number;
};

export function loadBybitEnv(envPath = BYBIT_ENV_PATH): void {
  const resolved = path.resolve(envPath);
  const content = fs.readFileSync(resolved, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export function getBybitRuntime(): BybitRuntime {
  const key = process.env.BYBIT_API_KEY;
  const secret = process.env.BYBIT_API_SECRET;

  if (!key || !secret) {
    throw new Error('Missing BYBIT_API_KEY or BYBIT_API_SECRET in runtime environment');
  }

  return {
    key,
    secret,
    testnet: process.env.BYBIT_ENV === 'testnet' || process.env.BYBIT_TESTNET === '1' || process.env.BYBIT_TESTNET === 'true',
    recvWindow: Number(process.env.BYBIT_RECV_WINDOW ?? '5000'),
  };
}
