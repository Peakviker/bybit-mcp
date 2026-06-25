import { createBybitRestClient, getFuturesGridDetail } from './bybit_client.js';

export type GridBotSnapshot = {
  ts: number;
  botId: string;
  detail: Record<string, unknown>;
  wallet: unknown;
  positions: unknown[];
  openOrders: unknown[];
  strategyOrders: unknown[];
};

export async function collectGridBotSnapshot(botId: string): Promise<GridBotSnapshot> {
  const client = createBybitRestClient();
  const detail = await getFuturesGridDetail(botId);
  const symbol = typeof detail.symbol === 'string' && detail.symbol.trim() !== '' ? detail.symbol : undefined;

  const [wallet, positions, openOrders, strategyOrders] = await Promise.all([
    client.getWalletBalance({ accountType: 'UNIFIED' } as never),
    client.getPositionInfo({ category: 'linear', settleCoin: 'USDT' } as never),
    client.getActiveOrders({ category: 'linear', symbol, limit: 50 } as never),
    client.getStrategyOrderList({ strategyId: botId, limit: 50 } as never),
  ]);

  return {
    ts: Date.now(),
    botId,
    detail,
    wallet,
    positions: positions?.result?.list ?? [],
    openOrders: openOrders?.result?.list ?? [],
    strategyOrders: strategyOrders?.result?.list ?? [],
  };
}
