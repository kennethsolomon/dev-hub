import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const db = getDb();
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any;
  if (!run || !run.log_path) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const tail = req.nextUrl.searchParams.get('tail');
  const search = req.nextUrl.searchParams.get('search');

  try {
    let content = fs.readFileSync(run.log_path, 'utf-8');

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
