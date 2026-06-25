import fs from 'node:fs';
import { runtimePath } from '../src/paths.js';

const RAW_PATH = runtimePath('risk-alerts.jsonl');
const FORMATTED_PATH = runtimePath('risk-alerts-formatted.log');

function main(): void {
  const mode = process.argv[2] ?? 'formatted';

  if (mode === 'formatted') {
    if (!fs.existsSync(FORMATTED_PATH)) {
      process.stdout.write('No formatted alerts yet\n');
      return;
    }
    const content = fs.readFileSync(FORMATTED_PATH, 'utf8').trim();
    if (!content) {
      process.stdout.write('No formatted alerts yet\n');
      return;
    }
    const chunks = content.split('\n---\n').filter(Boolean);
    process.stdout.write(chunks[chunks.length - 1] + '\n');
    return;
  }

  if (!fs.existsSync(RAW_PATH)) {
    process.stdout.write('No raw alerts yet\n');
    return;
  }
  const lines = fs.readFileSync(RAW_PATH, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  process.stdout.write(lines[lines.length - 1] + '\n');
}

main();
