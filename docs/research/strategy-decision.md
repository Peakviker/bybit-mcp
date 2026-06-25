# Strategy Decision: how `/home/peakviker/bybit-mcp` should evolve next

Date: 2026-06-25
Decision scope: repo strategy, not runtime implementation

## Goal

Choose one explicit path for the next evolution of the local project based on actual local code and upstream `trading-mcp` research.

## Sources

URLs:
- `https://github.com/bybit-exchange/trading-mcp/tree/main`
- `https://raw.githubusercontent.com/bybit-exchange/trading-mcp/main/README.md`
- `https://bybit-exchange.github.io/docs/v5/intro`
- `https://bybit-exchange.github.io/docs/v5/guide`
- `https://www.npmjs.com/package/bybit-official-trading-server/v/2.1.11?activeTab=code` — unreachable for source browsing from this environment, HTTP 403

Local inspected files:
- `/home/peakviker/bybit-mcp/docs/project-evolution-2026-06-25.md`
- `/home/peakviker/bybit-mcp/docs/research/capability-matrix.md`
- `/home/peakviker/bybit-mcp/docs/research/upstream-patterns.md`
- `/home/peakviker/bybit-mcp/docs/research/phase8-runtime-hardening.md`
- `/home/peakviker/bybit-mcp/docs/research/phase9-client-abstraction.md`
- `/home/peakviker/bybit-mcp/docs/research/phase10-alert-intelligence.md`
- `/home/peakviker/bybit-mcp/src/index.ts`
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts`

Upstream inspected files:
- `/tmp/trading-mcp/README.md`
- `/tmp/trading-mcp/package.json`
- `/tmp/trading-mcp/src/client/rest-client.ts`
- `/tmp/trading-mcp/src/utils/auth.ts`
- `/tmp/trading-mcp/src/utils/rate-limiter.ts`
- `/tmp/trading-mcp/src/client/ws-client.ts`
- `/tmp/trading-mcp/src/client/subscription-manager.ts`

## The three strategic paths

### Option A — Stay local-specialized

Meaning:
- keep the repo as a compact grid-risk watcher plus narrow MCP surface
- do not intentionally absorb broader Bybit product coverage

Benefits:
- low scope creep
- protects operator focus
- fastest route to stronger watcher UX

Costs:
- local infra quality gaps remain unless fixed manually
- duplicated client/auth logic remains a maintenance trap if ignored

### Option B — Hybridize selectively

Meaning:
- keep watcher specialization as the core product
- selectively borrow upstream production patterns:
  - auth abstraction
  - timeout/error wrapper
  - rate limiting
  - possibly websocket snapshot/subscription patterns later
- add new endpoints only when they improve watcher operations or diagnostics

Benefits:
- best value/risk ratio
- preserves what already works
- adopts tested patterns where the local code is weakest

Costs:
- requires discipline to avoid drifting into partial reimplementation of upstream breadth
- some refactor work still needed

### Option C — Converge toward upstream architecture

Meaning:
- turn the repo into a broader Bybit integration platform
- watcher becomes only one subsystem
- local server structure progressively mirrors upstream categories and breadth

Benefits:
- eventual long-term breadth
- easier conceptual mapping to official/upstream categories

Costs:
- highest regression risk
- highest implementation cost
- likely slows improvements that matter now for the actual operator workflow

## Scoring table

Scale: 1 = weak, 5 = strong

| Criterion | Option A: local-specialized | Option B: hybrid selective | Option C: upstream convergence |
|---|---:|---:|---:|
| Preserves current working watcher value | 5 | 5 | 3 |
| Reduces duplication / plumbing risk | 2 | 5 | 4 |
| Implementation effort | 5 | 4 | 1 |
| Regression risk | 4 | 4 | 1 |
| Long-term maintainability | 3 | 5 | 3 |
| Operator value in the next phases | 4 | 5 | 2 |
| Total directional fit | 23 | 28 | 14 |

## Why Option B wins

Based on the current local code:
- `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts` is already the project’s most valuable differentiator.
- `/home/peakviker/bybit-mcp/src/index.ts` and `/home/peakviker/bybit-mcp/src/bybit_client.ts` show the main local weaknesses: duplicated auth/signing and thin transport discipline.
- `/home/peakviker/bybit-mcp/src/risk_rules.ts` and `/home/peakviker/bybit-mcp/src/delivery_state.ts` show that operator trust is limited more by alert statefulness than by missing exchange categories.

Based on the upstream review:
- `trading-mcp` is strong as a pattern library for auth, REST transport, websocket encapsulation, and category decomposition.
- `trading-mcp` is not a replacement for the local watcher runtime because it does not provide the same grid-risk persistence and alert-specific operational layer.

Therefore:
- Option A is too conservative because it leaves obvious infrastructure gains on the table.
- Option C is too broad because it would optimize for capability breadth before watcher reliability and trust.
- Option B directly matches the evidence.

## Recommended phase order

1. Phase 8 — runtime hardening
   - because silent runtime degradation is the most immediate operational risk
2. Phase 9 — client abstraction cleanup
   - because transport/auth duplication is the next biggest structural weakness
3. Phase 10 — alert intelligence
   - because stateful alerts improve operator trust without broadening repo scope
4. After that, selectively add bot/strategy/subscription features only if they improve diagnostics, lineage, or incident handling

## Explicit non-goals for the chosen strategy

Under the recommended path, do not prioritize these unless the repo mission changes:
- P2P, card, copy-trading, earn, alpha/on-chain breadth
- full parity with upstream category counts
- automatic architectural convergence with upstream naming or file layout
- `/v5/trade` websocket writes before watcher runtime and client layers are hardened

## Decision checkpoint for future sessions

Re-open this decision only if one of these becomes true:
1. the repo is no longer watcher-first and needs to be a general Bybit operations platform
2. a major new operator workflow requires several upstream categories together
3. maintaining local abstractions becomes harder than adopting upstream layout directly

Until then, treat the strategy as stable.

## Recommendation

Recommendation: choose Option B — hybrid selective adoption.

Concrete meaning:
- keep `/home/peakviker/bybit-mcp/src/grid_risk_watcher.ts` and the watcher runtime as the product core
- borrow upstream production plumbing from:
  - `/tmp/trading-mcp/src/utils/auth.ts`
  - `/tmp/trading-mcp/src/client/rest-client.ts`
  - `/tmp/trading-mcp/src/utils/rate-limiter.ts`
  - later, if needed, `/tmp/trading-mcp/src/client/ws-client.ts` and `/tmp/trading-mcp/src/client/subscription-manager.ts`
- explicitly defer broad category parity work

Short version: do not rebuild around upstream; harden the local watcher and selectively import upstream engineering discipline.