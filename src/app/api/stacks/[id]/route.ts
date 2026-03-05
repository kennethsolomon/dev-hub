import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getProcessManager } from '@/lib/process/manager';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  if (body.name) {
    db.prepare('UPDATE stacks SET name = ? WHERE id = ?').run(body.name, id);
  }

  if (body.project_ids) {
    db.prepare('DELETE FROM stack_items WHERE stack_id = ?').run(id);
    const stmt = db.prepare('INSERT INTO stack_items (stack_id, project_id, sort_order) VALUES (?, ?, ?)');
    body.project_ids.forEach((pid: string, i: number) => stmt.run(id, pid, i));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM stacks WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
