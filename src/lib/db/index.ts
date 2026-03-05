import Database from 'better-sqlite3';
import path from 'path';
import { MIGRATIONS } from './schema';

const DB_PATH = path.join(process.cwd(), 'data', 'devhub.db');

// Use globalThis to survive Next.js HMR in dev mode
const globalForDb = globalThis as unknown as { __devhub_db?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb.__devhub_db) return globalForDb.__devhub_db;

  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
  globalForDb.__devhub_db = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);

  const applied = new Set(
    db.prepare('SELECT version FROM _migrations').all().map((r: any) => r.version)
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.up);
      db.prepare('INSERT INTO _migrations (version) VALUES (?)').run(m.version);
    })();
  }
}

// ── Typed helpers ──

export interface Project {
  id: string;
  name: string;
  slug: string;
  path: string;
  type: string;
  config_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  project_id: string;
  name: string;
  type: string;
  command: string;
  cwd: string | null;
  env_json: string;
  desired_port: number | null;
  assigned_port: number | null;
  is_primary: number;
  depends_on_json: string;
  readiness_json: string | null;
  restart_policy: string;
  stop_signal: string;
  stop_timeout: number;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  service_id: string;
  status: string;
  pid: number | null;
  assigned_port: number | null;
  started_at: string | null;
  stopped_at: string | null;
  exit_code: number | null;
  log_path: string | null;
  created_at: string;
}

export interface Stack {
  id: string;
  name: string;
  created_at: string;
}

export interface StackItem {
  stack_id: string;
  project_id: string;
  sort_order: number;
}

export interface UpgradeNote {
  id: string;
  project_id: string;
  created_at: string;
  tool: string;
  summary: string;
  details_json: string | null;
}

export interface EnvDefinition {
  id: string;
  project_id: string;
  service_id: string | null;
  key: string;
  description: string | null;
  required: number;
  default_value: string | null;
  is_secret: number;
}

export interface EnvOverride {
  id: string;
  project_id: string;
  service_id: string | null;
  key: string;
  value: string;
  source: string;
}
