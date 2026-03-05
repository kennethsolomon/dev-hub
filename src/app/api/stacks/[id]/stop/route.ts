import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getProcessManager } from '@/lib/process/manager';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const items = db.prepare(
    'SELECT project_id FROM stack_items WHERE stack_id = ?'
  ).all(id) as Array<{ project_id: string }>;

  const pm = getProcessManager();
  await Promise.all(items.map(i => pm.stopProject(i.project_id)));

  return NextResponse.json({ ok: true });
}
