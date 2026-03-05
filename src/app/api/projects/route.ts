import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { importProject } from '@/lib/discovery/scanner';
import { v4 as uuid } from 'uuid';

export async function GET() {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM services WHERE project_id = p.id) as service_count,
      (SELECT assigned_port FROM services WHERE project_id = p.id AND is_primary = 1 LIMIT 1) as primary_port
    FROM projects p
    ORDER BY p.name
  `).all();
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === 'import') {
    try {
      const result = importProject(body.path, body.type);
      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // Manual add
  const db = getDb();
  const id = uuid();
  const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  db.prepare(`
    INSERT INTO projects (id, name, slug, path, type) VALUES (?, ?, ?, ?, ?)
  `).run(id, body.name, slug, body.path, body.type || 'unknown');

  return NextResponse.json({ id, slug });
}
