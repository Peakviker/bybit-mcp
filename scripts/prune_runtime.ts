import { describeRuntimeRetention, pruneRuntimeFiles } from '../src/runtime_retention.js';

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtAge(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

function main(): void {
  const apply = process.argv.includes('--apply');
  const now = Date.now();
  const infos = apply ? pruneRuntimeFiles(now) : describeRuntimeRetention(now);

  const summary = infos.map((info) => ({
    file: info.fileName,
    size: fmtBytes(info.sizeBytes),
    age: info.mtimeMs === 0 ? '—' : fmtAge(info.ageMs),
    keepDays: info.keepDays,
    action: info.prune ? (apply ? 'deleted' : 'would-delete') : 'keep',
    reason: info.reason,
  }));

  const totalBytes = infos.reduce((sum, info) => sum + info.sizeBytes, 0);
  const totalPrunableBytes = infos.filter((info) => info.prune).reduce((sum, info) => sum + info.sizeBytes, 0);

  process.stdout.write(JSON.stringify({
    ok: true,
    mode: apply ? 'apply' : 'dry-run',
    totalFilesTracked: infos.length,
    totalBytes,
    totalPrunableBytes,
    summary,
  }, null, 2) + '\n');
}

main();
