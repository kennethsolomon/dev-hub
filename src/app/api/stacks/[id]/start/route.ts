import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getProcessManager } from '@/lib/process/manager';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const items = db.prepare(
    'SELECT project_id FROM stack_items WHERE stack_id = ? ORDER BY sort_order'
  ).all(id) as Array<{ project_id: string }>;

  const pm = getProcessManager();
  const results = [];

  for (const item of items) {
    try {
      const r = await pm.startProject(item.project_id);
      results.push({ projectId: item.project_id, services: r });
    } catch (err: any) {
      results.push({ projectId: item.project_id, error: err.message });
    }
  }

  return NextResponse.json(results);
}
