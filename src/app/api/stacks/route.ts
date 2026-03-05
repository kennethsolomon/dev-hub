import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET() {
  const db = getDb();
  const stacks = db.prepare('SELECT * FROM stacks ORDER BY name').all();
  const items = db.prepare(`
    SELECT si.*, p.name as project_name, p.slug, p.type
    FROM stack_items si
    JOIN projects p ON p.id = si.project_id
    ORDER BY si.sort_order
  `).all();

  return NextResponse.json({ stacks, items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const id = uuid();
  db.prepare('INSERT INTO stacks (id, name) VALUES (?, ?)').run(id, body.name);

  if (body.project_ids?.length) {
    const stmt = db.prepare('INSERT INTO stack_items (stack_id, project_id, sort_order) VALUES (?, ?, ?)');
    body.project_ids.forEach((pid: string, i: number) => stmt.run(id, pid, i));
  }

  return NextResponse.json({ id });
}
