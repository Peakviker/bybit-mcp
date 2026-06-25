# Upstream Trading-MCP Patterns for Local Watcher UX

Date: 2026-06-25
Project: `/home/peakviker/bybit-mcp`
Scope: documentation only

## Goal

Identify upstream `trading-mcp` patterns worth borrowing without turning this repo into a broad exchange wrapper clone.

## Sources checked

Reachable:
- `https://github.com/bybit-exchange/trading-mcp/tree/main`
- local clone `/tmp/trading-mcp`, commit `10935f2`, tag `2.1.11`
- `https://modelcontextprotocol.io/specification/2025-06-18/server/tools` — HTTP 200, title `Tools - Model Context Protocol`

Prior source limitations still apply:
- npm source browsing for `bybit-official-trading-server` returned HTTP 403 in this environment.

## Relevant upstream evidence

Upstream README capability table:
- `/tmp/trading-mcp/README.md:344-375` lists 258 total tools.
- `/tmp/trading-mcp/README.md:356` lists 18 bot tools.
- `/tmp/trading-mcp/README.md:359` lists 6 strategy tools.
- `/tmp/trading-mcp/README.md:372` lists 26 websocket snapshot tools.
- `/tmp/trading-mcp/README.md:373` lists 6 websocket trade tools.

Transport discipline:
- `/tmp/trading-mcp/src/client/rest-client.ts:7-13` adds `AbortController` timeout helpers.
- `/tmp/trading-mcp/src/client/rest-client.ts:24-34` normalizes HTTP and Bybit retCode failures.
- `/tmp/trading-mcp/src/client/rest-client.ts:37-95` routes GET/POST/auth calls through one client.

Auth discipline:
- `/tmp/trading-mcp/src/utils/auth.ts:14-45` selects HMAC vs RSA.
- `/tmp/trading-mcp/src/utils/auth.ts:65-86` builds Bybit auth headers in one place.

Rate limiting:
- `/tmp/trading-mcp/src/utils/rate-limiter.ts:1-4` documents a token bucket rate limiter.
- `/tmp/trading-mcp/src/utils/rate-limiter.ts:16-21` has endpoint-specific overrides.
- `/tmp/trading-mcp/src/utils/rate-limiter.ts:42-59` waits for tokens before calls.

Subscription lifecycle:
- `/tmp/trading-mcp/src/client/subscription-manager.ts:62-132` manages start/read/stop/list and idle expiry.
- `/tmp/trading-mcp/src/client/subscription-manager.ts:228-244` bounds reconnects and uses exponential backoff.
- `/tmp/trading-mcp/src/tools/subscription/startSubscription.ts:5-37` exposes start semantics that return an id.
- `/tmp/trading-mcp/src/tools/subscription/readMessages.ts:4-27` exposes buffered reads.

## What to borrow soon

1. One REST transport wrapper
   - timeout
   - retCode normalization
   - consistent auth path
   - endpoint-aware rate limiting

2. One auth/signing module
   - HMAC now
   - optional RSA later
   - no duplicated bot POST signing

3. One websocket lifecycle abstraction, later
   - only after health architecture is in place
   - use bounded reconnect and explicit states
   - preserve the existing timer baseline as the authoritative fallback

4. MCP-style metadata discipline
   - tool names and descriptions should explain operator use cases and risk level
   - write tools should remain visibly separate from read-only tools

## What not to borrow now

Do not copy broad category coverage just because upstream has it:
- RFQ
- P2P
- card
- earn
- alpha/on-chain
- copy trading
- broad bot families not used by the operator

This repo is strongest as a watcher-first operational project, not as a full clone of upstream `trading-mcp`.

## MCP UX implication

The MCP tools spec page confirms the general user model: servers expose callable tools with schemas and results. For this repo, that means tool UX should be explicit and safe:

- read-only tools should be easy to call
- write tools should require obvious confirmation gates
- tool descriptions should tell the operator when to use the tool and when not to
- tools that depend on bot-layer truth should say so directly

## Recommendation

Borrow upstream engineering discipline, not upstream breadth.

Best future sequence:
1. watcher health files and status UX
2. shared REST/auth/rate-limit client
3. richer alert state
4. endpoint coverage table
5. only then selective websocket/subscription tooling
