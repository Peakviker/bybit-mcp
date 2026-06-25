import { RestClientV5 } from 'bybit-api';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function createRestClient(): RestClientV5 {
  return new RestClientV5({
    key: process.env.BYBIT_API_KEY,
    secret: process.env.BYBIT_API_SECRET,
    testnet: parseBoolean(process.env.BYBIT_TESTNET, false),
    recv_window: Number(process.env.BYBIT_RECV_WINDOW ?? '5000'),
  });
}

function requirePrivateAuth(): void {
  if (!process.env.BYBIT_API_KEY || !process.env.BYBIT_API_SECRET) {
    throw new Error('Private Bybit tool requires BYBIT_API_KEY and BYBIT_API_SECRET');
  }
}

function requireMainnetConfirmation(): void {
  if (process.env.BYBIT_ENV !== 'testnet' && process.env.BYBIT_WRITE_CONFIRMED !== '1') {
    throw new Error('Mainnet write operation requires BYBIT_WRITE_CONFIRMED=1 in the runtime environment');
  }
}

function toText(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return 0;
}

async function signedBotPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  requirePrivateAuth();
  const apiKey = process.env.BYBIT_API_KEY as string;
  const apiSecret = process.env.BYBIT_API_SECRET as string;
  const recvWindow = String(process.env.BYBIT_RECV_WINDOW ?? '5000');
  const baseUrl = process.env.BYBIT_ENV === 'testnet' ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
  const jsonBody = JSON.stringify(body, null, 0);
  const timestamp = String(Date.now());
  const payload = timestamp + apiKey + recvWindow + jsonBody;
  const crypto = await import('node:crypto');
  const signature = crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
  const response = await fetch(baseUrl + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BAPI-API-KEY': apiKey,
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

async function getTradeStats(client: RestClientV5, category: string, limit: number): Promise<unknown> {
  const wallet = await client.getWalletBalance({ accountType: 'UNIFIED' } as never);
  const positions = await client.getPositionInfo({ category, settleCoin: 'USDT' } as never);
  const closed = await client.getClosedPnL({ category, limit } as never);
  const orders = await client.getHistoricOrders({ category, limit } as never);
  const executions = await client.getExecutionList({ category, limit } as never);

  const walletRow = wallet?.result?.list?.[0] ?? null;
  const positionRows = positions?.result?.list ?? [];
  const closedRows = closed?.result?.list ?? [];
  const orderRows = orders?.result?.list ?? [];
  const executionRows = executions?.result?.list ?? [];

  const openPositions = positionRows.filter((p) => toNumber((p as { size?: unknown }).size) !== 0);
  const pnls = closedRows.map((row) => toNumber((row as { closedPnl?: unknown }).closedPnl));
  const fees = closedRows.map((row) => toNumber((row as { cumExecFee?: unknown }).cumExecFee));
  const wins = pnls.filter((x) => x > 0).length;
  const losses = pnls.filter((x) => x < 0).length;

  const symbolCounts = new Map<string, number>();
  for (const row of executionRows) {
    const symbol = String((row as unknown as { symbol?: unknown }).symbol ?? '?');
    symbolCounts.set(symbol, (symbolCounts.get(symbol) ?? 0) + 1);
  }

  return {
    env: process.env.BYBIT_ENV === 'testnet' ? 'TESTNET' : 'MAINNET',
    category,
    wallet: walletRow,
    counts: {
      openPositions: openPositions.length,
      closedPnlRows: closedRows.length,
      orderRows: orderRows.length,
      executionRows: executionRows.length,
    },
    stats: {
      totalClosedPnl: pnls.reduce((a, b) => a + b, 0),
      totalFees: fees.reduce((a, b) => a + b, 0),
      winRate: pnls.length ? wins / pnls.length : null,
      wins,
      losses,
      avgClosedPnl: pnls.length ? pnls.reduce((a, b) => a + b, 0) / pnls.length : null,
      avgFee: fees.length ? fees.reduce((a, b) => a + b, 0) / fees.length : null,
    },
    topSymbols: Array.from(symbolCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbol, count]) => ({ symbol, count })),
    samples: {
      openPositions: openPositions.slice(0, 5),
      closedPnl: closedRows.slice(0, 5),
      orders: orderRows.slice(0, 5),
      executions: executionRows.slice(0, 5),
    },
  };
}

async function getFuturesGridDetail(botId: string): Promise<Record<string, unknown>> {
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

async function getFuturesGridAnalysis(botId: string): Promise<unknown> {
  const detail = await getFuturesGridDetail(botId);
  const totalInvestment = toNumber(detail.total_investment);
  const pnl = toNumber(detail.pnl);
  const pnlPer = toNumber(detail.pnl_per || detail.current_per);
  const realisedPnl = toNumber(detail.realised_pnl);
  const unrealisedPnl = toNumber(detail.unrealised_pnl);
  const gridProfit = toNumber(detail.grid_profit);
  const fundingFee = toNumber(detail.funding_fee);
  const arbitrageNum = toNumber(detail.arbitrage_num);
  const currentPosition = toNumber(detail.current_position);
  const entryPrice = toNumber(detail.entry_price);
  const markPrice = toNumber(detail.mark_price || detail.last_price);
  const priceDelta = entryPrice && markPrice ? markPrice - entryPrice : 0;
  const directionalDrag = pnl - gridProfit;

  return {
    env: process.env.BYBIT_ENV === 'testnet' ? 'TESTNET' : 'MAINNET',
    botId,
    summary: {
      symbol: detail.symbol,
      status: detail.status,
      gridMode: detail.grid_mode,
      gridType: detail.grid_type,
      leverage: detail.leverage,
      side: detail.futures_pos_side,
      totalInvestment,
      equity: toNumber(detail.equity),
      currentPosition,
      entryPrice,
      markPrice,
      liquidationPrice: toNumber(detail.liquidation_price),
      rangeMin: toNumber(detail.min_price),
      rangeMax: toNumber(detail.max_price),
      currentRangeMin: toNumber(detail.curr_min_price),
      currentRangeMax: toNumber(detail.curr_max_price),
      cellNumber: toNumber(detail.cell_number),
      arbitrageNum,
    },
    performance: {
      pnl,
      pnlPer,
      realisedPnl,
      unrealisedPnl,
      gridProfit,
      fundingFee,
      directionalDrag,
      gridVsNetDifference: gridProfit - pnl,
      priceDelta,
    },
    interpretation: {
      gridWorking: gridProfit > 0,
      netProfitable: pnl > 0,
      hasDirectionalDrag: directionalDrag < 0,
      carryingLongExposure: String(detail.futures_pos_side ?? '').includes('LONG') && currentPosition > 0,
    },
    rawDetail: detail,
  };
}

function addTool(
  server: McpServer,
  name: string,
  description: string,
  schema: Record<string, unknown>,
  handler: (input: Record<string, unknown>) => Promise<unknown>
): void {
  server.tool(name, description, schema, async (input) => toText(await handler(input as Record<string, unknown>)));
}

async function main(): Promise<void> {
  const server = new McpServer({ name: 'bybit-mcp', version: '0.1.0' });

  server.tool('bybit_server_time', 'Get Bybit server time', {}, async () => {
    const client = createRestClient();
    return toText(await client.getServerTime());
  });

  addTool(
    server,
    'bybit_instruments_info',
    'Get Bybit instrument metadata for a category and optional symbol',
    {
      category: z.enum(['spot', 'linear', 'inverse', 'option']),
      symbol: z.string().optional(),
      status: z.string().optional(),
      baseCoin: z.string().optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    },
    async ({ category, symbol, status, baseCoin, limit }) => {
      const client = createRestClient();
      const params: Record<string, unknown> = { category };
      if (symbol) params.symbol = symbol;
      if (status) params.status = status;
      if (baseCoin) params.baseCoin = baseCoin;
      if (limit) params.limit = limit;
      return client.getInstrumentsInfo(params as never);
    }
  );

  addTool(
    server,
    'bybit_kline',
    'Get Bybit kline/candle data',
    {
      category: z.enum(['spot', 'linear', 'inverse']),
      symbol: z.string(),
      interval: z.string(),
      start: z.number().int().optional(),
      end: z.number().int().optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    },
    async ({ category, symbol, interval, start, end, limit }) => {
      const client = createRestClient();
      const params: Record<string, unknown> = { category, symbol, interval };
      if (start) params.start = start;
      if (end) params.end = end;
      if (limit) params.limit = limit;
      return client.getKline(params as never);
    }
  );

  addTool(
    server,
    'bybit_wallet_balance',
    'Get wallet balance for unified account',
    {
      accountType: z.string().default('UNIFIED'),
      coin: z.string().optional(),
    },
    async ({ accountType, coin }) => {
      requirePrivateAuth();
      const client = createRestClient();
      const params: Record<string, unknown> = { accountType };
      if (coin) params.coin = coin;
      return client.getWalletBalance(params as never);
    }
  );

  addTool(
    server,
    'bybit_positions',
    'Get open positions from Bybit V5',
    {
      category: z.enum(['linear', 'inverse', 'option']).optional(),
      symbol: z.string().optional(),
      settleCoin: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
    async ({ category, symbol, settleCoin, limit }) => {
      requirePrivateAuth();
      const client = createRestClient();
      const params: Record<string, unknown> = {};
      if (category) params.category = category;
      if (symbol) params.symbol = symbol;
      if (settleCoin) params.settleCoin = settleCoin;
      if (limit) params.limit = limit;
      return client.getPositionInfo(params as never);
    }
  );

  addTool(
    server,
    'bybit_closed_pnl',
    'Get closed PnL history from Bybit V5',
    {
      category: z.enum(['linear', 'inverse', 'option']),
      symbol: z.string().optional(),
      settleCoin: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
    async ({ category, symbol, settleCoin, limit }) => {
      requirePrivateAuth();
      const client = createRestClient();
      const params: Record<string, unknown> = { category };
      if (symbol) params.symbol = symbol;
      if (settleCoin) params.settleCoin = settleCoin;
      if (limit) params.limit = limit;
      return client.getClosedPnL(params as never);
    }
  );

  addTool(
    server,
    'bybit_order_history',
    'Get historical orders from Bybit V5 private API',
    {
      category: z.enum(['spot', 'linear', 'inverse', 'option']),
      symbol: z.string().optional(),
      baseCoin: z.string().optional(),
      settleCoin: z.string().optional(),
      orderStatus: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async ({ category, symbol, baseCoin, settleCoin, orderStatus, limit }) => {
      requirePrivateAuth();
      const client = createRestClient();
      const params: Record<string, unknown> = { category };
      if (symbol) params.symbol = symbol;
      if (baseCoin) params.baseCoin = baseCoin;
      if (settleCoin) params.settleCoin = settleCoin;
      if (orderStatus) params.orderStatus = orderStatus;
      if (limit) params.limit = limit;
      return client.getHistoricOrders(params as never);
    }
  );

  addTool(
    server,
    'bybit_active_orders',
    'Get active/open orders from Bybit V5 private API',
    {
      category: z.enum(['spot', 'linear', 'inverse', 'option']),
      symbol: z.string().optional(),
      baseCoin: z.string().optional(),
      settleCoin: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async ({ category, symbol, baseCoin, settleCoin, limit }) => {
      requirePrivateAuth();
      const client = createRestClient();
      const params: Record<string, unknown> = { category };
      if (symbol) params.symbol = symbol;
      if (baseCoin) params.baseCoin = baseCoin;
      if (settleCoin) params.settleCoin = settleCoin;
      if (limit) params.limit = limit;
      return client.getActiveOrders(params as never);
    }
  );

  addTool(
    server,
    'bybit_execution_history',
    'Get execution/trade history from Bybit V5 private API',
    {
      category: z.enum(['spot', 'linear', 'inverse', 'option']),
      symbol: z.string().optional(),
      baseCoin: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ category, symbol, baseCoin, limit }) => {
      requirePrivateAuth();
      const client = createRestClient();
      const params: Record<string, unknown> = { category };
      if (symbol) params.symbol = symbol;
      if (baseCoin) params.baseCoin = baseCoin;
      if (limit) params.limit = limit;
      return client.getExecutionList(params as never);
    }
  );

  addTool(
    server,
    'bybit_strategy_list',
    'Get Bybit strategy list from V5 strategy namespace',
    {
      category: z.string().optional(),
      symbol: z.string().optional(),
      status: z.string().optional(),
      type: z.string().optional(),
      strategyId: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
    async ({ category, symbol, status, type, strategyId, limit }) => {
      requirePrivateAuth();
      const client = createRestClient();
      const params: Record<string, unknown> = {};
      if (category) params.category = category;
      if (symbol) params.symbol = symbol;
      if (status) params.status = status;
      if (type) params.type = type;
      if (strategyId) params.strategyId = strategyId;
      if (limit) params.limit = limit;
      return client.getStrategyList(params as never);
    }
  );

  addTool(
    server,
    'bybit_strategy_order_list',
    'Get Bybit strategy order list from V5 strategy namespace',
    {
      strategyId: z.string().optional(),
      symbol: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
    async ({ strategyId, symbol, status, limit }) => {
      requirePrivateAuth();
      const client = createRestClient();
      const params: Record<string, unknown> = {};
      if (strategyId) params.strategyId = strategyId;
      if (symbol) params.symbol = symbol;
      if (status) params.status = status;
      if (limit) params.limit = limit;
      return client.getStrategyOrderList(params as never);
    }
  );

  addTool(
    server,
    'bybit_trade_stats',
    'Aggregate wallet, positions, closed pnl, orders and executions into trading stats',
    {
      category: z.enum(['linear', 'inverse', 'option']).default('linear'),
      limit: z.number().int().min(1).max(200).default(100),
    },
    async ({ category, limit }) => {
      requirePrivateAuth();
      const client = createRestClient();
      return getTradeStats(client, String(category ?? 'linear'), Number(limit ?? 100));
    }
  );

  addTool(
    server,
    'bybit_futures_grid_detail',
    'Get Futures Grid Bot detail by bot_id via official Bybit bot endpoint',
    {
      bot_id: z.string(),
    },
    async ({ bot_id }) => {
      return getFuturesGridDetail(String(bot_id));
    }
  );

  addTool(
    server,
    'bybit_futures_grid_analysis',
    'Analyze Futures Grid Bot metrics by bot_id',
    {
      bot_id: z.string(),
    },
    async ({ bot_id }) => {
      return getFuturesGridAnalysis(String(bot_id));
    }
  );

  addTool(
    server,
    'bybit_futures_grid_validate',
    'Validate Futures Grid Bot parameters via official Bybit bot endpoint',
    {
      symbol: z.string(),
      cell_number: z.number().int().min(2),
      min_price: z.string(),
      max_price: z.string(),
      leverage: z.string(),
      grid_type: z.number().int(),
      total_investment: z.string(),
      grid_mode: z.number().int().optional(),
      take_profit_per: z.string().optional(),
      stop_loss_per: z.string().optional(),
      move_up_price: z.string().optional(),
      move_down_price: z.string().optional(),
      trailing_stop_per: z.string().optional(),
    },
    async (input) => {
      return signedBotPost('/v5/fgridbot/validate', input);
    }
  );

  addTool(
    server,
    'bybit_futures_grid_close',
    'Close Futures Grid Bot via official Bybit bot endpoint',
    {
      bot_id: z.string(),
      close_type: z.number().int().optional(),
    },
    async (input) => {
      requireMainnetConfirmation();
      return signedBotPost('/v5/fgridbot/close', input);
    }
  );

  addTool(
    server,
    'bybit_place_order',
    'Place an order on Bybit V5',
    {
      category: z.enum(['spot', 'linear', 'inverse', 'option']),
      symbol: z.string(),
      side: z.enum(['Buy', 'Sell']),
      orderType: z.enum(['Market', 'Limit']),
      qty: z.string(),
      price: z.string().optional(),
      timeInForce: z.enum(['GTC', 'IOC', 'FOK', 'PostOnly', 'RPI']).optional(),
      reduceOnly: z.boolean().optional(),
      marketUnit: z.enum(['baseCoin', 'quoteCoin']).optional(),
    },
    async (input) => {
      requirePrivateAuth();
      requireMainnetConfirmation();
      const client = createRestClient();
      return client.submitOrder(input as never);
    }
  );

  addTool(
    server,
    'bybit_cancel_order',
    'Cancel an order on Bybit V5',
    {
      category: z.enum(['spot', 'linear', 'inverse', 'option']),
      symbol: z.string(),
      orderId: z.string().optional(),
      orderLinkId: z.string().optional(),
    },
    async (input) => {
      requirePrivateAuth();
      requireMainnetConfirmation();
      const client = createRestClient();
      return client.cancelOrder(input as never);
    }
  );

  addTool(
    server,
    'bybit_amend_order',
    'Amend an order on Bybit V5',
    {
      category: z.enum(['spot', 'linear', 'inverse', 'option']),
      symbol: z.string(),
      orderId: z.string().optional(),
      orderLinkId: z.string().optional(),
      qty: z.string().optional(),
      price: z.string().optional(),
    },
    async (input) => {
      requirePrivateAuth();
      requireMainnetConfirmation();
      const client = createRestClient();
      return client.amendOrder(input as never);
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
