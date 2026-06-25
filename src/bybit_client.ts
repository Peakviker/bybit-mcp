import crypto from 'node:crypto';
import { RestClientV5 } from 'bybit-api';
import { getBybitRuntime } from './env.js';

export function createBybitRestClient(): RestClientV5 {
  const runtime = getBybitRuntime();
  return new RestClientV5({
    key: runtime.key,
    secret: runtime.secret,
    testnet: runtime.testnet,
    recv_window: runtime.recvWindow,
  });
}

export async function signedBotPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const runtime = getBybitRuntime();
  const recvWindow = String(runtime.recvWindow);
  const baseUrl = runtime.testnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
  const jsonBody = JSON.stringify(body);
  const timestamp = String(Date.now());
  const payload = timestamp + runtime.key + recvWindow + jsonBody;
  const signature = crypto.createHmac('sha256', runtime.secret).update(payload).digest('hex');

  const response = await fetch(baseUrl + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BAPI-API-KEY': runtime.key,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': recvWindow,
      'X-BAPI-SIGN': signature,
    },
    body: jsonBody,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function getFuturesGridDetail(botId: string): Promise<Record<string, unknown>> {
  const response = (await signedBotPost('/v5/fgridbot/detail', { bot_id: botId })) as {
    retCode?: number;
    retMsg?: string;
    result?: { status_code?: number; debug_msg?: string; detail?: Record<string, unknown> };
  };

  if (response.retCode !== 0) {
    throw new Error(`Bybit bot API error: ${response.retCode} ${response.retMsg}`);
  }
  if ((response.result?.status_code ?? -1) !== 0) {
    throw new Error(`Bybit bot detail error: ${response.result?.status_code} ${response.result?.debug_msg ?? ''}`);
  }

  return response.result?.detail ?? {};
}
