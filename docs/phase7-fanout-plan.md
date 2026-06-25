# Phase 7 Fan-out Plan

## Goal

Подготовить минимальный fan-out слой без привязки watcher core к конкретному каналу доставки.

## Approach

- watcher продолжает писать raw alerts в JSONL
- delivery adapter читает только новые alerts
- состояние последней доставки хранится отдельно
- script можно дальше оборачивать в:
  - Telegram sender
  - Hermes send_message
  - cron job
  - webhook bridge

## Files

- `src/delivery_state.ts`
- `scripts/emit_new_alerts.ts`

## Contract

Input:
- `runtime/risk-alerts.jsonl`

State:
- `runtime/alert-delivery-state.json`

Output:
- `NO_NEW_ALERTS` when nothing new
- JSON payload when new alerts exist

## Why this shape

Это keeps fan-out idempotent and channel-agnostic.
Core watcher remains a pure observer/evaluator.
