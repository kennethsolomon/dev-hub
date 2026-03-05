import { execSync } from 'child_process';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';

export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  isMajor: boolean;
}

export interface UpdateReport {
  tool: 'npm' | 'composer';
  packages: OutdatedPackage[];
  scannedAt: string;
}

export async function checkNodeUpdates(projectPath: string): Promise<UpdateReport> {
  const packages: OutdatedPackage[] = [];
  try {
    const output = execSync('npm outdated --json 2>/dev/null || true', {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 30000,
    });

    if (output.trim()) {
      const data = JSON.parse(output);
      for (const [name, info] of Object.entries(data) as [string, any][]) {
        const current = info.current || '0.0.0';
        const latest = info.latest || current;
        const currentMajor = parseInt(current.split('.')[0], 10);
        const latestMajor = parseInt(latest.split('.')[0], 10);

        packages.push({
          name,
          current,
          wanted: info.wanted || current,
          latest,
          isMajor: latestMajor > currentMajor,
        });
      }
    }
  } catch {}

  return { tool: 'npm', packages, scannedAt: new Date().toISOString() };
}

export async function checkComposerUpdates(projectPath: string): Promise<UpdateReport> {
  const packages: OutdatedPackage[] = [];
  try {
    const output = execSync('composer outdated --format=json --direct 2>/dev/null || true', {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 30000,
    });

    if (output.trim()) {
      const data = JSON.parse(output);
      const installed = data.installed || [];
      for (const pkg of installed) {
        const current = pkg.version || '0.0.0';
        const latest = pkg.latest || current;
        const currentMajor = parseInt(current.replace(/^v/, '').split('.')[0], 10);
        const latestMajor = parseInt(latest.replace(/^v/, '').split('.')[0], 10);

        packages.push({
          name: pkg.name,
          current,
          wanted: pkg['latest-status'] === 'up-to-date' ? current : latest,
          latest,
          isMajor: latestMajor > currentMajor,
        });
      }
    }
  } catch {}

  return { tool: 'composer', packages, scannedAt: new Date().toISOString() };
}

export function saveUpgradeNote(
  projectId: string,
  tool: string,
  summary: string,
  details?: any
): string {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO upgrade_notes (id, project_id, tool, summary, details_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, projectId, tool, summary, details ? JSON.stringify(details) : null);
  return id;
}

export function getUpgradeNotes(projectId: string): any[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM upgrade_notes WHERE project_id = ? ORDER BY created_at DESC'
  ).all(projectId);
}
