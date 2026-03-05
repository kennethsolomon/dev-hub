import { NextRequest, NextResponse } from 'next/server';
import { getProcessManager } from '@/lib/process/manager';
import { getDb } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Verify project exists first
    const db = getDb();
    const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(id) as any;
    if (!project) {
      return NextResponse.json({ error: `Project ${id} not found` }, { status: 404 });
    }

    const services = db.prepare('SELECT id, name, command FROM services WHERE project_id = ?').all(id) as any[];
    if (services.length === 0) {
      return NextResponse.json({ error: `No services configured for project "${project.name}"` }, { status: 400 });
    }

    const pm = getProcessManager();
    const results = await pm.startProject(id);
    return NextResponse.json(results);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[DevHub] Start project error:', errorMessage, err);
    // Next.js wraps errors with digest IDs - detect and provide fallback message
    if (errorMessage.includes('Unhandled error')) {
      return NextResponse.json({
        error: 'Failed to start project. Check the server console for details.',
      }, { status: 500 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
