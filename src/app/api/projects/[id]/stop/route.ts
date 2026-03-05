import { NextRequest, NextResponse } from 'next/server';
import { getProcessManager } from '@/lib/process/manager';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const pm = getProcessManager();
    await pm.stopProject(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
