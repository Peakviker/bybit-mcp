# bybit-mcp

Отдельный проект под Bybit API и MCP server.

Что зафиксировано по официальной документации Bybit:
- Базовая документация: https://bybit-exchange.github.io/docs/v5/intro
- Integration/Auth guide: https://bybit-exchange.github.io/docs/v5/guide
- В docs прямо указаны SDK:
  - Official Python SDK: `pybit`
  - Community Node.js SDK: `bybit-api`
- Для bot-layer отдельно подтвержден endpoint Futures Grid detail: `POST /v5/fgridbot/detail`

Почему так:
- Для Hermes/MCP stdio интеграции Node-стек быстрее поднимается и проще тестируется локально.
- `bybit-api` покрывает стандартный V5 REST, а bot-layer добран прямым signed POST по официальной docs.

Что дополнительно зафиксировано по runtime watcher:
- пути runtime/env централизованы в `src/paths.ts`
- watcher и scripts больше не размазывают абсолютные runtime path по нескольким файлам
- snapshot active-orders больше не прибит к `BTCUSDT`; symbol берётся из `fgridbot/detail`
- текущий operational baseline watcher: `grid-risk-watcher.service` + Hermes cron `bybit-grid-risk-delivery`
- есть operator analytics scripts:
  - `scripts/alert_stats.ts`
  - `scripts/risk_metrics_stats.ts`
- controlled redelivery workflow протестирован успешно (pause cron → rewind state → replay → restore → resume)

Текущие MCP tools:
- `bybit_server_time`
- `bybit_instruments_info`
- `bybit_kline`
- `bybit_wallet_balance`
- `bybit_positions`
- `bybit_closed_pnl`
- `bybit_order_history`
- `bybit_active_orders`
- `bybit_execution_history`
- `bybit_strategy_list`
- `bybit_strategy_order_list`
- `bybit_trade_stats`
- `bybit_futures_grid_detail`
- `bybit_futures_grid_analysis`
- `bybit_futures_grid_validate`
- `bybit_futures_grid_close`
- `bybit_place_order`
- `bybit_cancel_order`
- `bybit_amend_order`

Безопасность write-операций:
- приватные write tools требуют `BYBIT_API_KEY` и `BYBIT_API_SECRET`
- mainnet write-операции дополнительно требуют `BYBIT_WRITE_CONFIRMED=1`
- для testnet достаточно `BYBIT_ENV=testnet`

Запуск:
```bash
cd /home/peakviker/bybit-mcp
npm install
npm run build
node dist/index.js
```

Через wrapper:
```bash
/home/peakviker/bybit-mcp/run-mcp.sh
```

Для Hermes как MCP server:
```bash
hermes mcp add bybit-mcp --command /home/peakviker/bybit-mcp/run-mcp.sh
hermes mcp test bybit-mcp
```
