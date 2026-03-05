import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  // Get all non-running runs for this project's services
  const runs = db.prepare(`
    SELECT r.id, r.log_path FROM runs r
    JOIN services s ON r.service_id = s.id
    WHERE s.project_id = ? AND r.status != 'running'
  `).all(id) as Array<{ id: string; log_path: string | null }>;

  for (const run of runs) {
    if (run.log_path) {
      try { fs.unlinkSync(run.log_path); } catch {}
    }
  }

  const ids = runs.map(r => r.id);
  if (ids.length > 0) {
    db.prepare(`DELETE FROM runs WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  }

  return NextResponse.json({ deleted: ids.length });
}
