import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const allowedKeys = [
    'workspace_roots', 'subdomain_routing', 'portless_mode',
    'base_domain', 'bind_mode', 'proxy_port', 'lan_passcode_required', 'auth_enabled',
    'stop_all_on_exit',
  ];

  for (const [key, value] of Object.entries(body)) {
    if (allowedKeys.includes(key)) {
      stmt.run(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  return NextResponse.json({ ok: true });
}
