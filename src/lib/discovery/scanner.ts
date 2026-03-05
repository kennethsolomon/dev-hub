import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';

export type ProjectType = 'node' | 'laravel' | 'expo' | 'unknown';

export interface DiscoveredProject {
  name: string;
  path: string;
  type: ProjectType;
  alreadyImported: boolean;
}

export function detectProjectType(dir: string): ProjectType | null {
  try {
    const entries = fs.readdirSync(dir);

    // Laravel
    if (entries.includes('artisan') && entries.includes('composer.json')) {
      return 'laravel';
    }

    // Expo / React Native
    if (entries.includes('app.json') || entries.includes('app.config.js') || entries.includes('app.config.ts')) {
      const pkgPath = path.join(dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          if (deps['expo'] || deps['react-native']) return 'expo';
        } catch {}
      }
    }

    // Node.js
    if (entries.includes('package.json')) {
      return 'node';
    }

    return null;
  } catch {
    return null;
  }
}

export function scanWorkspaceRoot(rootPath: string, maxDepth = 2): DiscoveredProject[] {
  const db = getDb();
  const existingPaths = new Set(
    (db.prepare('SELECT path FROM projects').all() as Array<{ path: string }>).map(r => r.path)
  );

  const results: DiscoveredProject[] = [];

  function scan(dir: string, depth: number) {
    if (depth > maxDepth) return;

    const type = detectProjectType(dir);
    if (type) {
      results.push({
        name: path.basename(dir),
        path: dir,
        type,
        alreadyImported: existingPaths.has(dir),
      });
      return; // Don't recurse into detected projects
    }

    // Skip common non-project directories
    const skip = new Set(['node_modules', '.git', 'vendor', '.next', 'dist', 'build', '.cache']);
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !skip.has(entry.name) && !entry.name.startsWith('.')) {
          scan(path.join(dir, entry.name), depth + 1);
        }
      }
    } catch {}
  }

  scan(rootPath, 0);
  return results;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function importProject(projectPath: string, type?: ProjectType): { id: string; slug: string } {
  const db = getDb();

  const existing = db.prepare('SELECT id, slug FROM projects WHERE path = ?').get(projectPath) as any;
  if (existing) return { id: existing.id, slug: existing.slug };

  const name = path.basename(projectPath);
  const detectedType = type || detectProjectType(projectPath) || 'unknown';
  let slug = slugify(name);

  // Ensure slug uniqueness
  const existingSlugs = new Set(
    (db.prepare('SELECT slug FROM projects').all() as Array<{ slug: string }>).map(r => r.slug)
  );
  let counter = 1;
  let baseSlug = slug;
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter++}`;
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO projects (id, name, slug, path, type) VALUES (?, ?, ?, ?, ?)
  `).run(id, name, slug, projectPath, detectedType);

  // Try to import devhub.yml if it exists
  const configPath = path.join(projectPath, 'devhub.yml');
  if (fs.existsSync(configPath)) {
    try {
      const yaml = require('js-yaml');
      const config = yaml.load(fs.readFileSync(configPath, 'utf-8'));
      importServicesFromConfig(id, projectPath, config);
    } catch {}
  }

  // Auto-create default service based on project type
  const serviceCount = (db.prepare('SELECT COUNT(*) as c FROM services WHERE project_id = ?').get(id) as any).c;
  if (serviceCount === 0) {
    createDefaultService(id, detectedType);
  }

  return { id, slug };
}

function importServicesFromConfig(projectId: string, projectPath: string, config: any) {
  const db = getDb();
  if (!config.services || !Array.isArray(config.services)) return;

  for (const svc of config.services) {
    const id = uuid();
    db.prepare(`
      INSERT INTO services (id, project_id, name, type, command, cwd, env_json, desired_port, is_primary, depends_on_json, readiness_json, restart_policy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      svc.name || 'default',
      svc.type || 'command',
      svc.command || '',
      svc.cwd || null,
      JSON.stringify(svc.env || {}),
      svc.port || null,
      svc.primary ? 1 : 0,
      JSON.stringify(svc.dependsOn || []),
      svc.readiness ? JSON.stringify(svc.readiness) : null,
      svc.restart || 'no'
    );
  }
}

function createDefaultService(projectId: string, type: ProjectType) {
  const db = getDb();
  const id = uuid();

  const defaults: Record<ProjectType, { command: string; port: number | null }> = {
    node: { command: 'npm run dev', port: 3000 },
    laravel: { command: 'php artisan serve --port=$PORT', port: 8000 },
    expo: { command: 'npx expo start', port: 8081 },
    unknown: { command: '', port: null },
  };

  const d = defaults[type] || defaults.unknown;

  db.prepare(`
    INSERT INTO services (id, project_id, name, type, command, desired_port, is_primary)
    VALUES (?, ?, 'dev', 'command', ?, ?, 1)
  `).run(id, projectId, d.command, d.port);
}
