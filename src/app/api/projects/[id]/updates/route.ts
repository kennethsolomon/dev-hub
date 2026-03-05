import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkNodeUpdates, checkComposerUpdates, saveUpgradeNote, getUpgradeNotes } from '@/lib/updates/advisor';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const reports = [];

  if (['node', 'expo'].includes(project.type)) {
    reports.push(await checkNodeUpdates(project.path));
  }
  if (project.type === 'laravel') {
    reports.push(await checkComposerUpdates(project.path));
  }

  const notes = getUpgradeNotes(id);
  return NextResponse.json({ reports, notes });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await req.json();
  const noteId = saveUpgradeNote(projectId, body.tool, body.summary, body.details);
  return NextResponse.json({ id: noteId });
}
