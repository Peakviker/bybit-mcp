import fs from 'node:fs';
import path from 'node:path';
import { RUNTIME_DIR } from './paths.js';

export function ensureRuntimeDir(): void {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

export function appendJsonl(fileName: string, value: unknown): string {
  ensureRuntimeDir();
  const target = path.join(RUNTIME_DIR, fileName);
  fs.appendFileSync(target, JSON.stringify(value) + '\n');
  return target;
}
