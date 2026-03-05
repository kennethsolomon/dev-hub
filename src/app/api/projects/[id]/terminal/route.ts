import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { execSync } from 'child_process';
import fs from 'fs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const command = body.command?.trim();

  if (!command) {
    return NextResponse.json({ error: 'No command provided' }, { status: 400 });
  }

  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  if (!fs.existsSync(project.path)) {
    return NextResponse.json({ error: `Project path does not exist: ${project.path}` }, { status: 400 });
  }

  try {
    const output = execSync(`/bin/zsh -lc ${shellEscape(command)}`, {
      cwd: project.path,
      timeout: 60000,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      env: { ...process.env, TERM: 'dumb' },
    });
    return NextResponse.json({ output, exitCode: 0 });
  } catch (err: any) {
    const output = (err.stdout || '') + (err.stderr || '');
    return NextResponse.json({ output, exitCode: err.status ?? 1 });
  }
}

export function shellEscape(cmd: string): string {
  return "'" + cmd.replace(/'/g, "'\\''") + "'";
}
