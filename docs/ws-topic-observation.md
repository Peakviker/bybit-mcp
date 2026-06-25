# Bybit WS Topic Observation

Date: 2026-06-25
Bot: `624873434886723147`
Environment: `[MAINNET]`
Key mode: private write-capable key, read-only observation only

## Goal

Понять, достаточно ли общих private WS topics Bybit для real-time мониторинга grid-бота без зависимости от UI reverse-engineering.

## Topics under observation

- `order`
- `execution`
- `position`
- `wallet`

## Probe artifacts

- raw JSONL log: `/home/peakviker/bybit-mcp/runtime/ws-probe.jsonl`
- probe script: `/home/peakviker/bybit-mcp/src/ws_probe.ts`

## What we want to learn

1. Приходит ли `order` при перестановке/открытии child orders grid-бота
2. Приходит ли `execution` на fill внутри grid
3. Приходит ли `position` при росте/сокращении inventory
4. Приходит ли `wallet` при изменении reserved balance / equity

## Initial interpretation matrix

- `execution useful?` — subscription confirmed, payload observation pending live trading
- `order useful?` — subscription confirmed, payload observation pending live trading
- `position useful?` — subscription confirmed, payload observation pending live trading
- `wallet useful?` — subscription confirmed, payload observation pending live trading

## Phase 1 result so far

Confirmed with real runtime:
- private WS opens as `v5Private`
- subscribe response for `order,execution,position,wallet` returns `success=true`
- raw proof logged in `/home/peakviker/bybit-mcp/runtime/ws-probe.jsonl`

Observed startup lines:
- `phase=starting`
- `phase=open`, `wsKey=v5Private`
- `phase=response`, `op=subscribe`, `success=true`

Interpretation:
- event source is viable
- the remaining unknown is not connection/auth, but whether live grid activity emits sufficiently rich payloads on these generic private topics

## Success condition for Phase 1

Phase 1 считается успешной, если probe:
- стабильно подключается к private WS
- пишет heartbeat
- пишет live updates хотя бы по одному private topic
- позволяет сопоставить хотя бы один реальный grid event с WS topic family

## Non-goals

- здесь не решается полная историческая лента grid-бота
- здесь не делается UI reverse-engineering
- здесь не отправляются trade/write команды на биржу
