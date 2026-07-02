import * as fs from 'node:fs';
import path from 'node:path';
import { RUNTIME_DIR } from './paths.js';

export type RuntimeRetentionRule = {
  fileName: string;
  keepDays: number;
  pruneMode: 'mtime';
};

export type RuntimeFileInfo = {
  fileName: string;
  path: string;
  sizeBytes: number;
  mtimeMs: number;
  ageMs: number;
  keepDays: number;
  prune: boolean;
  reason: string;
};

export const RUNTIME_RETENTION_RULES: RuntimeRetentionRule[] = [
  { fileName: 'grid-snapshots.jsonl', keepDays: 7, pruneMode: 'mtime' },
  { fileName: 'risk-metrics.jsonl', keepDays: 7, pruneMode: 'mtime' },
  { fileName: 'risk-deltas.jsonl', keepDays: 7, pruneMode: 'mtime' },
  { fileName: 'grid-risk-watcher.jsonl', keepDays: 14, pruneMode: 'mtime' },
  { fileName: 'risk-alerts.jsonl', keepDays: 30, pruneMode: 'mtime' },
  { fileName: 'risk-alerts-formatted.log', keepDays: 30, pruneMode: 'mtime' },
  { fileName: 'ws-probe.jsonl', keepDays: 14, pruneMode: 'mtime' },
];

export function describeRuntimeRetention(now = Date.now()): RuntimeFileInfo[] {
  return RUNTIME_RETENTION_RULES.map((rule) => {
    const filePath = path.join(RUNTIME_DIR, rule.fileName);
    if (!fs.existsSync(filePath)) {
      return {
        fileName: rule.fileName,
        path: filePath,
        sizeBytes: 0,
        mtimeMs: 0,
        ageMs: 0,
        keepDays: rule.keepDays,
        prune: false,
        reason: 'missing',
      };
    }

    const stat = fs.statSync(filePath);
    const ageMs = Math.max(0, now - stat.mtimeMs);
    const pruneAfterMs = rule.keepDays * 24 * 60 * 60 * 1000;
    const prune = ageMs > pruneAfterMs;

    return {
      fileName: rule.fileName,
      path: filePath,
      sizeBytes: stat.size,
      mtimeMs: stat.mtimeMs,
      ageMs,
      keepDays: rule.keepDays,
      prune,
      reason: prune ? 'older-than-retention' : 'within-retention',
    };
  });
}

export function pruneRuntimeFiles(now = Date.now()): RuntimeFileInfo[] {
  const infos = describeRuntimeRetention(now);
  for (const info of infos) {
    if (info.prune && fs.existsSync(info.path)) {
      fs.unlinkSync(info.path);
    }
  }
  return infos;
}
