import { loadBybitEnv } from '../src/env.js';
import { collectGridBotSnapshot } from '../src/grid_snapshot.js';
import { appendJsonl } from '../src/persist.js';

const botId = process.argv[2] ?? '624873434886723147';

async function main(): Promise<void> {
  loadBybitEnv();
  const snapshot = await collectGridBotSnapshot(botId);
  const path = appendJsonl('grid-snapshots.jsonl', snapshot);
  process.stdout.write(JSON.stringify({ ok: true, botId, path, snapshot }, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\n');
  process.exit(1);
});
