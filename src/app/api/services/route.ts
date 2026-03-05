import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const id = uuid();

  db.prepare(`
    INSERT INTO services (id, project_id, name, type, command, cwd, env_json, desired_port, is_primary, depends_on_json, readiness_json, restart_policy, stop_signal, stop_timeout)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.project_id,
    body.name,
    body.type || 'command',
    body.command,
    body.cwd || null,
    JSON.stringify(body.env || {}),
    body.desired_port || null,
    body.is_primary ? 1 : 0,
    JSON.stringify(body.depends_on || []),
    body.readiness ? JSON.stringify(body.readiness) : null,
    body.restart_policy || 'no',
    body.stop_signal || 'SIGINT',
    body.stop_timeout || 10000
  );

  return NextResponse.json({ id });
}
