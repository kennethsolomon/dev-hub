import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getFileWatcherManager } from '@/lib/process/file-watcher';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const services = db.prepare('SELECT * FROM services WHERE project_id = ? ORDER BY is_primary DESC, name').all(id);
  const runs = db.prepare(`
    SELECT r.* FROM runs r
    JOIN services s ON s.id = r.service_id
    WHERE s.project_id = ?
    ORDER BY r.created_at DESC
    LIMIT 50
  `).all(id);

  return NextResponse.json({ project, services, runs });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const sets: string[] = [];
  const values: any[] = [];

  for (const key of ['name', 'slug', 'path', 'type', 'config_json', 'auto_build_enabled', 'build_command', 'watch_debounce_ms']) {
    if (body[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  // Start/stop file watcher when auto_build_enabled changes
  if (body.auto_build_enabled !== undefined) {
    const fw = getFileWatcherManager();
    if (body.auto_build_enabled) {
      fw.startWatching(id);
    } else {
      fw.stopWatching(id);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
