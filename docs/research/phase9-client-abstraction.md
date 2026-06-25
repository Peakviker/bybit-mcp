# Phase 9 Research: Client Abstraction Cleanup

Date: 2026-06-25
Scope: documentation/plan only, no runtime changes applied

## Goal

Refactor local Bybit access into a small set of reusable client modules so that:
- REST requests have one timeout/error/rate-limit policy
- signing is defined once
- bot-layer POST logic is not duplicated
- watcher code can depend on higher-level functions instead of raw `fetch()` and ad hoc env access

## Sources

URLs:
- `https://github.com/bybit-exchange/trading-mcp/tree/main`
- `https://raw.githubusercontent.com/bybit-exchange/trading-mcp/main/README.md`
- `https://bybit-exchange.github.io/docs/v5/intro`
- `https://bybit-exchange.github.io/docs/v5/guide`

Local inspected files:
- `/home/peakviker/bybit-mcp/src/index.ts`
- `/home/peakviker/bybit-mcp/src/bybit_client.ts`
- `/home/peakviker/bybit-mcp/src/env.ts`
- `/home/peakviker/bybit-mcp/src/grid_snapshot.ts`
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts`
- `/home/peakviker/bybit-mcp/package.json`
- `/home/peakviker/bybit-mcp/tsconfig.json`

Upstream reference files:
- `/tmp/trading-mcp/src/utils/auth.ts`
- `/tmp/trading-mcp/src/client/rest-client.ts`
- `/tmp/trading-mcp/src/utils/rate-limiter.ts`
- `/tmp/trading-mcp/src/client/ws-client.ts`
- `/tmp/trading-mcp/src/client/subscription-manager.ts`

## Current local duplication

Observed local patterns:
- `/home/peakviker/bybit-mcp/src/index.ts` contains its own `createRestClient()`, `requirePrivateAuth()`, `requireMainnetConfirmation()`, and `signedBotPost()`.
- `/home/peakviker/bybit-mcp/src/bybit_client.ts` also has `createBybitRestClient()` and another `signedBotPost()`.
- `/home/peakviker/bybit-mcp/src/env.ts` already knows how to load runtime env, but other files still read `process.env` directly.
- `/home/peakviker/bybit-mcp/src/grid_snapshot.ts` directly composes a snapshot from multiple client calls instead of using a reusable orchestration layer.

This creates three maintenance risks:
1. auth changes can diverge across files
2. timeout and error behavior can diverge across files
3. future endpoint coverage can inherit inconsistent patterns

## What upstream does better

Upstream `trading-mcp` has a clearer separation:
- `/tmp/trading-mcp/src/utils/auth.ts` owns signing and auth header creation
- `/tmp/trading-mcp/src/client/rest-client.ts` owns request execution, timeouts, and response handling
- `/tmp/trading-mcp/src/utils/rate-limiter.ts` owns throttling
- `/tmp/trading-mcp/src/client/ws-client.ts` owns websocket snapshots and trade requests
- `/tmp/trading-mcp/src/client/subscription-manager.ts` owns persistent subscriptions and reconnect behavior

That separation is the main pattern to borrow.

## Proposed target module split

### Keep
- `/home/peakviker/bybit-mcp/src/env.ts`
- `/home/peakviker/bybit-mcp/src/paths.ts`
- `/home/peakviker/bybit-mcp/src/grid_snapshot.ts`
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts`

### Create or split into
- `/home/peakviker/bybit-mcp/src/client/signing.ts`
- `/home/peakviker/bybit-mcp/src/client/http.ts`
- `/home/peakviker/bybit-mcp/src/client/bot_http.ts`
- `/home/peakviker/bybit-mcp/src/client/errors.ts`
- `/home/peakviker/bybit-mcp/src/client/rate_limit.ts`
- `/home/peakviker/bybit-mcp/src/client/types.ts`

Possible future naming is flexible, but the responsibility split should stay fixed:
- signing/auth
- transport
- rate limiting
- bot-layer transport
- error taxonomy
- domain wrappers

## Suggested module responsibilities

### `/home/peakviker/bybit-mcp/src/client/signing.ts`
Owns:
- HMAC signing
- optional RSA signing if added later
- runtime selection of signing mode
- auth header creation
- validation of key material

### `/home/peakviker/bybit-mcp/src/client/http.ts`
Owns:
- `fetch()` wrapper
- timeout via `AbortController`
- GET/POST helpers
- response normalization
- retry policy for transient transport errors
- endpoint-aware rate limiting

### `/home/peakviker/bybit-mcp/src/client/bot_http.ts`
Owns:
- `/v5/fgridbot/detail`
- `/v5/fgridbot/validate`
- `/v5/fgridbot/close`
- any other bot-layer signed POST endpoints

### `/home/peakviker/bybit-mcp/src/client/errors.ts`
Owns:
- error classes for Bybit API errors
- transport vs auth vs protocol vs payload classification
- preserved response context for debugging

### `/home/peakviker/bybit-mcp/src/client/types.ts`
Owns:
- normalized local types for snapshot and watcher inputs/outputs
- internal type aliases that stop `as never` from spreading

## Migration order

### Step 1: Extract shared auth helpers

Move duplicated signing logic out of `/home/peakviker/bybit-mcp/src/index.ts` and `/home/peakviker/bybit-mcp/src/bybit_client.ts` into a single module.

Risk level: low

Validation focus:
- bot detail still works
- regular REST tools still work
- no change to user-facing output shape

### Step 2: Add one HTTP transport wrapper

Wrap `fetch()` with:
- timeout
- consistent Bybit error handling
- optional retry policy
- endpoint-aware rate limiting

Risk level: medium

Validation focus:
- read-only tools still work
- write paths still produce the same Bybit responses
- failures become more informative, not less

### Step 3: Convert `/home/peakviker/bybit-mcp/src/bybit_client.ts` to use the wrapper

Replace direct `fetch()` usage and inline signing with the new modules.

Risk level: medium

Validation focus:
- `/v5/fgridbot/detail` continues to return the same data
- any existing bot helper callers stay unchanged

### Step 4: Remove duplicate helpers from `/home/peakviker/bybit-mcp/src/index.ts`

Keep `index.ts` focused on MCP tool registration and workflow composition.

Risk level: medium-high

Validation focus:
- `npm run check` remains clean
- `npm run build` succeeds
- every tool still registers

### Step 5: Normalize watcher snapshot assembly

Make `/home/peakviker/bybit-mcp/src/grid_snapshot.ts` depend on the client abstraction rather than endpoint-specific implementation details.

Risk level: low-medium

Validation focus:
- snapshot shape remains stable
- watcher cycle output remains stable

## Concrete code smells to eliminate

1. `process.env` accessed directly in many places.
2. duplicated `signedBotPost()` logic.
3. multiple places that know the same Bybit base URLs.
4. raw `fetch()` without timeout.
5. `as never` used to bridge type gaps that the abstraction should remove.

## Validation commands

From `/home/peakviker/bybit-mcp`:
- `npm run check`
- `npm run build`

If a small targeted test harness is added later, it should cover:
- auth header generation
- timeout behavior
- Bybit retCode normalization
- bot-layer signing path

## What not to do

- Do not refactor all runtime logic at once.
- Do not fold watcher hardening into this phase.
- Do not add websocket snapshot abstractions until the transport layer is stable.
- Do not pull in upstream breadth just because the abstraction is cleaner.

## Recommendation

Recommendation: do Phase 9 immediately after Phase 8, but keep the refactor incremental.

Best first move:
- extract one shared signing/auth module and one shared HTTP wrapper, then switch `/home/peakviker/bybit-mcp/src/bybit_client.ts` to use them before touching `src/index.ts`.

Reason:
- this gives the biggest reduction in duplication with the smallest blast radius.
- it also creates the foundation needed if the repo later adopts upstream-style rate limiting or websocket snapshots.