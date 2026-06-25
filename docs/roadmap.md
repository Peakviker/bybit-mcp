# Roadmap

## Phase A — Repository hardening

- baseline CI for typecheck and build
- stable contribution and development docs
- separate tracked source from runtime-local state

## Phase B — Runtime architecture

- tighten boundaries between snapshot, metrics, rules, and delivery
- make runtime health surface explicit and testable
- reduce coupling between watcher loop and transport concerns

## Phase C — MCP and API surface

- document each exposed MCP tool with source mapping
- separate safe read operations from guarded write operations
- improve error normalization for Bybit responses

## Phase D — Testing

- add unit tests for pure risk math and rule evaluation
- add fixture-driven tests for alert formatting and delivery state logic
- add smoke validation for MCP server startup

## Phase E — Operations

- formalize deploy/update runbook
- define watcher recovery procedure
- harden cron/service observability and alert replay workflows
