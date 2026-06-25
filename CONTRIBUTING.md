# Contributing

## Development flow

1. Work in a feature branch.
2. Keep runtime artifacts out of git.
3. Run local checks before commit:
   ```bash
   npm run check
   npm run build
   ```
4. Document operational or architectural changes in `docs/`.
5. If a change affects Hermes integration, update `README.md` and any relevant handoff docs.

## Project rules

- Do not commit secrets, local `.env`, `runtime/`, `node_modules/`, or `.hermes/`.
- Treat `docs/new-session-handoff-2026-06-25.md` and `docs/grid-risk-watcher-end-to-end-guide.md` as operator-facing truth until replaced.
- Prefer small commits grouped by concern: runtime, MCP surface, docs, infra.
- When bot-layer behavior changes, verify against official Bybit docs before merging.

## Suggested branch naming

- `feat/...`
- `fix/...`
- `refactor/...`
- `docs/...`
- `ops/...`

## Pull request checklist

- [ ] `npm run check` passes
- [ ] `npm run build` passes
- [ ] no secrets or runtime artifacts added
- [ ] docs updated if behavior changed
- [ ] README updated if setup or usage changed
