import fs from 'node:fs';
import { formatRiskAlert } from './format_alert.js';
import { runtimePath } from './paths.js';
import type { RiskAlert } from './risk_rules.js';

export function appendFormattedAlerts(alerts: RiskAlert[]): string | null {
  if (alerts.length === 0) return null;
  const path = runtimePath('risk-alerts-formatted.log');
  const chunks = alerts.map((alert) => `${formatRiskAlert(alert)}\n---\n`);
  fs.appendFileSync(path, chunks.join(''));
  return path;
}
