export const MIGRATIONS = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        path TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'node',
        config_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'command',
        command TEXT NOT NULL,
        cwd TEXT,
        env_json TEXT DEFAULT '{}',
        desired_port INTEGER,
        assigned_port INTEGER,
        is_primary INTEGER NOT NULL DEFAULT 0,
        depends_on_json TEXT DEFAULT '[]',
        readiness_json TEXT,
        restart_policy TEXT NOT NULL DEFAULT 'no',
        stop_signal TEXT DEFAULT 'SIGINT',
        stop_timeout INTEGER DEFAULT 10000,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        pid INTEGER,
        assigned_port INTEGER,
        started_at TEXT,
        stopped_at TEXT,
        exit_code INTEGER,
        log_path TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS stacks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS stack_items (
        stack_id TEXT NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (stack_id, project_id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        passcode_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS upgrade_notes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        tool TEXT NOT NULL,
        summary TEXT NOT NULL,
        details_json TEXT
      );

      CREATE TABLE IF NOT EXISTS env_definitions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        description TEXT,
        required INTEGER NOT NULL DEFAULT 1,
        default_value TEXT,
        is_secret INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS env_overrides (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'db'
      );

      -- Default settings
      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('workspace_roots', '[]'),
        ('subdomain_routing', 'true'),
        ('portless_mode', 'false'),
        ('base_domain', 'localhost'),
        ('bind_mode', 'localhost'),
        ('proxy_port', '4400'),
        ('lan_passcode_required', 'true'),
        ('auth_enabled', 'false');
    `,
  },
];
