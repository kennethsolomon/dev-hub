import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { scanWorkspaceRoot } from '@/lib/discovery/scanner';

export async function GET() {
  const db = getDb();
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'workspace_roots'").get() as any;
  const roots: string[] = JSON.parse(setting?.value || '[]');

  const allDiscovered = [];
  for (const root of roots) {
    const projects = scanWorkspaceRoot(root);
    allDiscovered.push(...projects);
  }

  return NextResponse.json({ roots, projects: allDiscovered });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === 'scan') {
    const projects = scanWorkspaceRoot(body.path);
    return NextResponse.json({ projects });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
