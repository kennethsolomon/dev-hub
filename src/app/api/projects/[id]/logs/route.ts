import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth/session';
import fs from 'fs';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  // Batch deletes to stay under SQLite's 999 variable limit
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500);
    db.prepare(`DELETE FROM runs WHERE id IN (${batch.map(() => '?').join(',')})`).run(...batch);
  }

  return NextResponse.json({ deleted: ids.length });
}
