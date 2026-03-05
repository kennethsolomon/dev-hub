import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth/session';
import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.env.DEVHUB_ROOT || process.cwd(), 'data', 'logs');

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId } = await params;
  const db = getDb();
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any;
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }
  if (run.status === 'running') {
    return NextResponse.json({ error: 'Cannot delete a running run' }, { status: 400 });
  }

  // Remove log file from disk
  if (run.log_path) {
    try { fs.unlinkSync(run.log_path); } catch {}
  }

  db.prepare('DELETE FROM runs WHERE id = ?').run(runId);
  return NextResponse.json({ deleted: true });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const db = getDb();
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any;
  if (!run || !run.log_path) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const tail = req.nextUrl.searchParams.get('tail');
  const search = req.nextUrl.searchParams.get('search');

  // Ensure log_path is within the expected logs directory
  const realLogPath = path.resolve(run.log_path);
  const realLogsDir = path.resolve(LOGS_DIR);
  if (!realLogPath.startsWith(realLogsDir + path.sep)) {
    return NextResponse.json({ error: 'Invalid log path' }, { status: 400 });
  }

  try {
    let content = fs.readFileSync(realLogPath, 'utf-8');

    if (search) {
      const lines = content.split('\n');
      content = lines.filter(l => l.toLowerCase().includes(search.toLowerCase())).join('\n');
    }

    if (tail) {
      const n = parseInt(tail, 10);
      const lines = content.split('\n');
      content = lines.slice(-n).join('\n');
    }

    return NextResponse.json({ runId, content, status: run.status });
  } catch {
    return NextResponse.json({ error: 'Could not read log file' }, { status: 500 });
  }
}
