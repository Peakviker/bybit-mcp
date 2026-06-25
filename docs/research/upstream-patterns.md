# Upstream Patterns Worth Borrowing from trading-mcp

Date: 2026-06-25
Local project: `/home/peakviker/bybit-mcp`
Upstream repo: `https://github.com/bybit-exchange/trading-mcp/tree/main`

## Purpose

This document extracts implementation patterns from upstream `trading-mcp` that are useful for the local watcher-first project. The goal is not to mirror upstream wholesale; it is to identify reusable production discipline.

## Source inventory

URLs checked from this environment:
- `https://github.com/bybit-exchange/trading-mcp/tree/main` — reachable, HTTP 200
- `https://raw.githubusercontent.com/bybit-exchange/trading-mcp/main/README.md` — reachable, HTTP 200
- `https://www.npmjs.com/package/bybit-official-trading-server/v/2.1.11?activeTab=code` — source browsing unreachable here, HTTP 403
- `https://bybit-exchange.github.io/docs/v5/intro` — reachable, HTTP 200
- `https://bybit-exchange.github.io/docs/v5/guide` — reachable, HTTP 200

Local inspected files:
- `/home/peakviker/bybit-mcp/src/index.ts`
- `/home/peakviker/bybit-mcp/src/bybit_client.ts`
- `/home/peakviker/bybit-mcp/src/env.ts`
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts`
- `/home/peakviker/bybit-mcp/src/grid_snapshot.ts`
- `/home/peakviker/bybit-mcp/src/persist.ts`
- `/home/peakviker/bybit-mcp/src/risk_rules.ts`
- `/home/peakviker/bybit-mcp/src/format_alert.ts`
- `/home/peakviker/bybit-mcp/src/delivery_state.ts`

Upstream inspected files:
- `/tmp/trading-mcp/src/utils/auth.ts`
- `/tmp/trading-mcp/src/client/rest-client.ts`
- `/tmp/trading-mcp/src/client/ws-client.ts`
- `/tmp/trading-mcp/src/client/subscription-manager.ts`
- `/tmp/trading-mcp/src/utils/rate-limiter.ts`
- `/tmp/trading-mcp/src/server.ts`
- `/tmp/trading-mcp/README.md`
- `/tmp/trading-mcp/package.json`

## Pattern 1: auth/signing is isolated in one utility module

Upstream behavior:
- `resolveSignConfig()` chooses RSA vs HMAC at runtime in `/tmp/trading-mcp/src/utils/auth.ts:14-45`
- `buildAuthHeaders()` builds the standard Bybit auth header set in one place in `/tmp/trading-mcp/src/utils/auth.ts:65-86`
- RSA precedence warning is explicit when both mechanisms are present in `/tmp/trading-mcp/src/utils/auth.ts:21-35`
- `X-BAPI-SIGN-TYPE: 2` is automatically set for RSA in `/tmp/trading-mcp/src/utils/auth.ts:82-84`

Local gap:
- `/home/peakviker/bybit-mcp/src/index.ts` and `/home/peakviker/bybit-mcp/src/bybit_client.ts` both hand-roll signing and runtime config access
- `/home/peakviker/bybit-mcp/src/env.ts` already centralizes some runtime loading, but the actual auth flow is still duplicated

Borrow decision:
- Copy soon

Why it matters here:
- this repo already has two signing paths (REST helper and bot-layer helper)
- duplication increases the chance that one path gets fixed while the other silently diverges

## Pattern 2: HTTP requests have explicit timeout control

Upstream behavior:
- `REQUEST_TIMEOUT_MS = 10_000` in `/tmp/trading-mcp/src/client/rest-client.ts:5-8`
- `AbortController` is used for GET/POST requests in `/tmp/trading-mcp/src/client/rest-client.ts:9-13,42-46,57-61,68-77,91-95`
- `handleResponse()` normalizes HTTP failures and Bybit retCode failures in one place in `/tmp/trading-mcp/src/client/rest-client.ts:24-34`

Local gap:
- `/home/peakviker/bybit-mcp/src/bybit_client.ts` uses raw `fetch()` with no abort timeout
- `src/index.ts` bot POST logic also uses raw `fetch()` without timeout

Borrow decision:
- Copy soon

Why it matters here:
- watcher work should fail fast and report clearly instead of hanging
- timeout discipline is especially important for bot detail/snapshot calls that the runtime depends on

## Pattern 3: rate limiting is endpoint-aware and centralized

Upstream behavior:
- token bucket limiter lives in `/tmp/trading-mcp/src/utils/rate-limiter.ts:1-63`
- endpoint-specific rates are configured in a single map in `/tmp/trading-mcp/src/utils/rate-limiter.ts:16-21`
- request paths acquire a token before each REST call in `/tmp/trading-mcp/src/client/rest-client.ts:37-38,49-53,64-65,80-84`

Local gap:
- no rate limiter is present in the inspected local HTTP path
- the local watcher loops on a fixed timer and trusts the underlying API

Borrow decision:
- Copy soon

Why it matters here:
- a single operator workflow can still hit bursts: watcher cycles, manual tools, and diagnostics may overlap
- endpoint-aware limiting is more maintainable than ad hoc `sleep`s

## Pattern 4: WebSocket snapshot tooling is first-class

Upstream behavior:
- `WsClient.snapshot()` in `/tmp/trading-mcp/src/client/ws-client.ts:60-165` opens a socket, optionally authenticates, subscribes, collects messages, then closes
- auth ACK is awaited before subscribing on private channels in `/tmp/trading-mcp/src/client/ws-client.ts:101-147`
- trade requests are handled in a dedicated `/v5/trade` flow in `/tmp/trading-mcp/src/client/ws-client.ts:167-255`

Local gap:
- local watcher uses the SDK websocket directly in `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts:31-41,121-153`
- there is no reusable snapshot abstraction for other tools or scripts

Borrow decision:
- Adapt later

Why not immediately copy:
- the current repo is not trying to expose a full snapshot API yet
- the watcher’s immediate problem is runtime resilience, not new websocket surface area

## Pattern 5: persistent subscriptions manage reconnection and idle expiry

Upstream behavior:
- `SubscriptionManager` in `/tmp/trading-mcp/src/client/subscription-manager.ts:62-247` keeps subscriptions alive across reconnects
- idle subscriptions expire after 5 minutes without reads in `/tmp/trading-mcp/src/client/subscription-manager.ts:29-31,122-132`
- reconnect attempts are bounded and exponential in `/tmp/trading-mcp/src/client/subscription-manager.ts:228-243`
- auth is separated from message collection in `/tmp/trading-mcp/src/client/subscription-manager.ts:134-226`

Local gap:
- no comparable reusable subscription manager exists locally
- the watcher has a single long-lived process but no managed subscription lifecycle abstraction

Borrow decision:
- Adapt later

Why it matters here:
- if this repo later grows subscriptions or richer streaming diagnostics, the manager pattern is the right foundation
- it is less urgent than runtime hardening because the current watcher already has one service path working

## Pattern 6: env variables are read at call time, not import time

Upstream behavior:
- `/tmp/trading-mcp/src/client/rest-client.ts:15-22` explicitly documents call-time env reads
- `/tmp/trading-mcp/src/client/ws-client.ts:55-58` does the same for websocket credentials
- this makes tests and late init less brittle

Local gap:
- `/home/peakviker/bybit-mcp/src/env.ts` supports runtime loading, but other local files still read `process.env` directly
- `/home/peakviker/bybit-mcp/src/index.ts` uses direct env access in helper functions and write guards

Borrow decision:
- Copy soon

Why it matters here:
- call-time env access simplifies CLI use and testing
- it also reduces hidden coupling during future refactors

## Pattern 7: clear module separation by responsibility

Upstream behavior:
- `auth.ts` handles signing
- `rest-client.ts` handles HTTP execution
- `ws-client.ts` handles socket lifecycle
- `rate-limiter.ts` handles throttling
- `subscription-manager.ts` handles persistence of socket subscriptions
- `server.ts` handles server boot and auth mode display

Local gap:
- local code has some separation already, but `src/index.ts` still contains too much orchestration logic and repeated guards

Borrow decision:
- Copy soon

Why it matters here:
- this is the easiest way to reduce regression risk while keeping the watcher specialized

## Pattern 8: public documentation clearly maps capabilities to categories

Upstream behavior:
- README groups the API surface into categories with auth status and tool counts in `/tmp/trading-mcp/README.md:344-375`
- explicit category descriptions help decide what to add and what to ignore

Local gap:
- local README lists current tools, but not a structured capability map

Borrow decision:
- Adapt later

Why it matters here:
- useful for later operator onboarding and for deciding whether a future sync with upstream is worth it

## What to ignore for now

These upstream strengths are real, but low priority for this repo right now:
- broad RFQ / copy-trading / P2P / card / alpha / earn breadth
- full `/v5/trade` websocket write surface
- generic subscription APIs beyond the watcher’s immediate needs

Reason: they do not improve the current grid-risk operator loop as directly as runtime hardening or alert intelligence.

## Recommendation

Recommended adoption order:
1. auth/signing utility extraction
2. REST timeout + error normalization
3. endpoint-aware rate limiting
4. call-time env cleanup
5. only then websocket snapshot or subscription abstractions if the repo expands beyond the watcher

Short version: borrow the plumbing now, not the whole upstream product surface.