import { NextRequest, NextResponse } from 'next/server';
import { getFileWatcherManager } from '@/lib/process/file-watcher';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const fw = getFileWatcherManager();
  const restarted = await fw.triggerBuildRestart(id);

  return NextResponse.json({ ok: true, restarted });
}
