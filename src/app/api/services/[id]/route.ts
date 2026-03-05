import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getProcessManager } from '@/lib/process/manager';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const allowedFields = ['name', 'command', 'cwd', 'env_json', 'desired_port', 'is_primary', 'depends_on_json', 'readiness_json', 'restart_policy', 'stop_signal', 'stop_timeout'];
  const sets: string[] = [];
  const values: any[] = [];

  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push(typeof body[key] === 'object' ? JSON.stringify(body[key]) : body[key]);
    }
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE services SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM services WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
