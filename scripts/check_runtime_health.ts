import { readDeliveryHealth } from '../src/delivery_health.js';
import { readGridRiskHealth } from '../src/runtime_health.js';

const STALE_SUCCESS_MS = 60_000;
const STALE_DELIVERY_RUN_MS = 180_000;

function main(): void {
  const runtime = readGridRiskHealth();
  const delivery = readDeliveryHealth();
  const now = Date.now();

  if (!runtime) {
    process.stdout.write('runtime health file missing\n');
    process.exit(2);
  }

  if (runtime.runtimeStatus === 'failed' || runtime.runtimeStatus === 'degraded') {
    process.stdout.write(`runtime unhealthy: ${runtime.runtimeStatus}\n`);
    process.exit(2);
  }

  if (runtime.lastSuccessTs == null || now - runtime.lastSuccessTs > STALE_SUCCESS_MS) {
    process.stdout.write('runtime stale: no recent successful cycle\n');
    process.exit(2);
  }

  if (delivery.lastRunTs != null && now - delivery.lastRunTs > STALE_DELIVERY_RUN_MS) {
    process.stdout.write('delivery stale: no recent delivery worker run\n');
    process.exit(2);
  }

  process.stdout.write('runtime healthy\n');
}

main();
