import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { parseEnvFiles, isPortVar, isSecretVar } from '@/lib/env/parser';
import { getOsAdapter } from '@/lib/os/adapter';
import { v4 as uuid } from 'uuid';

export interface EnvVariable {
  key: string;
  fileValue: string | null;
  source: string | null;
  override: string | null;
  effective: string;
  isPort: boolean;
  isSecret: boolean;
  portStatus?: 'free' | 'in-use' | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Parse .env files
  const { files, entries } = parseEnvFiles(project.path);

  // Get DB overrides
  const overrides = db.prepare(
    'SELECT key, value FROM env_overrides WHERE project_id = ? AND service_id IS NULL'
  ).all(id) as Array<{ key: string; value: string }>;
  const overrideMap = new Map(overrides.map(o => [o.key, o.value]));

  // Merge: file entries + override-only entries
  const seenKeys = new Set<string>();
  const variables: EnvVariable[] = [];

  // First: all file entries (with possible overrides)
  for (const entry of entries) {
    seenKeys.add(entry.key);
    const override = overrideMap.get(entry.key) ?? null;
    const effective = override ?? entry.value;
    variables.push({
      key: entry.key,
      fileValue: entry.value,
      source: entry.source,
      override,
      effective,
      isPort: isPortVar(entry.key, effective),
      isSecret: isSecretVar(entry.key),
    });
  }

  // Second: override-only entries (not in any .env file)
  for (const [key, value] of overrideMap) {
    if (seenKeys.has(key)) continue;
    variables.push({
      key,
      fileValue: null,
      source: null,
      override: value,
      effective: value,
      isPort: isPortVar(key, value),
      isSecret: isSecretVar(key),
    });
  }

  // Check port status for port vars (parallel)
  const os = getOsAdapter();
  const portChecks = variables
    .map((v) => {
      if (!v.isPort) return null;
      const port = Number(v.effective);
      if (port < 1000 || port > 65535) return null;
      return os.isPortInUse(port).then(inUse => { v.portStatus = inUse ? 'in-use' : 'free'; });
    })
    .filter(Boolean);
  await Promise.all(portChecks);

  // Sort: port vars first, then alphabetical
  variables.sort((a, b) => {
    if (a.isPort !== b.isPort) return a.isPort ? -1 : 1;
    return a.key.localeCompare(b.key);
  });

  return NextResponse.json({ files, variables });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id) as any;
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { key, value, service_id } = body as {
    key: string;
    value: string | null;
    service_id?: string | null;
  };

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }

  const svcId = service_id || null;

  if (value === null || value === undefined) {
    // Delete override
    const deleteStmt = svcId
      ? 'DELETE FROM env_overrides WHERE project_id = ? AND key = ? AND service_id = ?'
      : 'DELETE FROM env_overrides WHERE project_id = ? AND key = ? AND service_id IS NULL';
    db.prepare(deleteStmt).run(...(svcId ? [id, key, svcId] : [id, key]));
    return NextResponse.json({ ok: true, action: 'removed', key });
  }

  // Upsert override
  const selectStmt = svcId
    ? 'SELECT id FROM env_overrides WHERE project_id = ? AND key = ? AND service_id = ?'
    : 'SELECT id FROM env_overrides WHERE project_id = ? AND key = ? AND service_id IS NULL';
  const existing = db.prepare(selectStmt).get(...(svcId ? [id, key, svcId] : [id, key])) as any;

  if (existing) {
    db.prepare('UPDATE env_overrides SET value = ? WHERE id = ?').run(String(value), existing.id);
  } else {
    db.prepare(
      'INSERT INTO env_overrides (id, project_id, service_id, key, value, source) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuid(), id, svcId, key, String(value), 'devhub');
  }

  return NextResponse.json({ ok: true, action: existing ? 'updated' : 'created', key, value });
}
