# Phase 6 Service Runtime Result

Date: 2026-06-25
Environment: [MAINNET]
Bot: 624873434886723147

## Files added

- `/home/peakviker/bybit-mcp/scripts/run_grid_risk_watcher.sh`
- `/home/peakviker/bybit-mcp/deploy/grid-risk-watcher.service`

## Installed runtime location

- `~/.config/systemd/user/grid-risk-watcher.service`

## What Phase 6 does

Phase 6 moves the watcher from ad-hoc background process mode into a real user-level systemd service.

This gives:
- auto-restart
- stable PID and logs
- persistent runtime outside the current chat turn
- standard lifecycle control via `systemctl --user`

## Real execution result

The service is installed, enabled, and running.

Verified state:
- `systemctl --user enable --now grid-risk-watcher.service`
- `systemctl --user status grid-risk-watcher.service`
- status shows: `Active: active (running)`

## Important service pitfalls discovered and fixed

### Pitfall 1: `npx` not found in systemd PATH

Initial failure:
- service exited with `status=127`
- log showed: `exec: npx: not found`

Fix:
- launch script now calls direct local binary:
  - `/home/peakviker/bybit-mcp/node_modules/.bin/tsx`
- no dependency on `npx` in service context

### Pitfall 2: `tsx` shebang could not find `node`

Initial failure:
- service exited with `status=127`
- log showed: `/usr/bin/env: 'node': No such file or directory`

Cause:
- `tsx` is a script with shebang `#!/usr/bin/env node`
- `node` was present at `/home/peakviker/.local/bin/node`
- but that path was missing from systemd service `PATH`

Fix:
- added `/home/peakviker/.local/bin` to PATH in both:
  - `run_grid_risk_watcher.sh`
  - `grid-risk-watcher.service`

## Runtime commands

Check status:
```bash
systemctl --user status grid-risk-watcher.service --no-pager
```

Restart:
```bash
systemctl --user restart grid-risk-watcher.service
```

Stop:
```bash
systemctl --user stop grid-risk-watcher.service
```

Logs:
```bash
journalctl --user -u grid-risk-watcher.service -n 50 --no-pager
```

## Conclusion

Phase 6 is successful.
The watcher now has a stable long-lived runtime managed by systemd.

The next natural step is Phase 7:
- improve delivery fan-out
- optional Telegram/Hermes message bridge
- optionally tighten rules from observed runtime behavior
