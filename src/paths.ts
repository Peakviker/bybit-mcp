import * as path from 'node:path';

export const PROJECT_ROOT = '/home/peakviker/bybit-mcp';
export const RUNTIME_DIR = path.join(PROJECT_ROOT, 'runtime');
export const BYBIT_ENV_PATH = '/home/peakviker/bybit-official-mcp/.env';

export function runtimePath(fileName: string): string {
  return path.join(RUNTIME_DIR, fileName);
}