import { readDeliveryHealth } from '../src/delivery_health.js';
import { readGridRiskHealth } from '../src/runtime_health.js';
import { readDeliveryState } from '../src/delivery_state.js';

function fmtTs(ts: number | null): string {
  if (ts == null) return '—';
  return new Date(ts).toISOString().replace('T', ' ').replace('.000Z', 'Z');
}

function fmtAge(ts: number | null): string {
  if (ts == null) return '—';
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m ago`;
}

function main(): void {
  const runtime = readGridRiskHealth();
  const delivery = readDeliveryHealth();
  const deliveryState = readDeliveryState();

  if (!runtime) {
    process.stdout.write('[MAINNET] grid risk watcher\nhealth file: missing\n');
    return;
  }

  const lines = [
    '[MAINNET] grid risk watcher',
    `runtime status: ${runtime.runtimeStatus}`,
    `last cycle start: ${fmtTs(runtime.lastCycleStartedAt)} (${fmtAge(runtime.lastCycleStartedAt)})`,
    `last cycle finish: ${fmtTs(runtime.lastCycleFinishedAt)} (${fmtAge(runtime.lastCycleFinishedAt)})`,
    `last success: ${fmtTs(runtime.lastSuccessTs)} (${fmtAge(runtime.lastSuccessTs)})`,
    `last failure: ${fmtTs(runtime.lastFailureTs)} (${fmtAge(runtime.lastFailureTs)})`,
    `last ws event: ${fmtTs(runtime.lastWsEventTs)} (${fmtAge(runtime.lastWsEventTs)})`,
    `last snapshot: ${fmtTs(runtime.lastSnapshotTs)} (${fmtAge(runtime.lastSnapshotTs)})`,
    `consecutive failures: ${runtime.consecutiveFailures}`,
    `last reason: ${runtime.lastReason ?? '—'}`,
    `last error kind: ${runtime.lastErrorKind ?? '—'}`,
    `last error: ${runtime.lastError ?? '—'}`,
    `last delivered ts: ${fmtTs(deliveryState.lastDeliveredTs)} (${fmtAge(deliveryState.lastDeliveredTs)})`,
    `delivery outcome: ${delivery.lastOutcome ?? '—'}`,
    `delivery pending estimate: ${delivery.pendingAlertCountEstimate}`,
    `delivery last run: ${fmtTs(delivery.lastRunTs)} (${fmtAge(delivery.lastRunTs)})`,
    `delivery last seen alert: ${fmtTs(delivery.lastSeenAlertTs)} (${fmtAge(delivery.lastSeenAlertTs)})`,
  ];

  process.stdout.write(lines.join('\n') + '\n');
}

main();
