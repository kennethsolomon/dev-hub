import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  switch (body.action) {
    case 'copy-env': {
      const src = path.join(project.path, '.env.example');
      const dest = path.join(project.path, '.env');
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        return NextResponse.json({ ok: true, message: '.env created from .env.example' });
      }
      return NextResponse.json({ error: '.env already exists or .env.example missing' }, { status: 400 });
    }

    case 'install-deps': {
      try {
        const cmd = project.type === 'laravel' ? 'composer install' : 'npm install';
        execSync(cmd, { cwd: project.path, timeout: 120000, encoding: 'utf-8' });
        return NextResponse.json({ ok: true, message: 'Dependencies installed' });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
