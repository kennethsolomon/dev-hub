import { NextRequest, NextResponse } from 'next/server';
import { getProcessManager } from '@/lib/process/manager';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const pm = getProcessManager();
    const result = await pm.startService(id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[DevHub] Start service error:', errorMessage, err);
    if (errorMessage.includes('Unhandled error')) {
      return NextResponse.json({
        error: 'Failed to start service. Check the server console for details.',
      }, { status: 500 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
