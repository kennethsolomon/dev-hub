import { NextRequest, NextResponse } from 'next/server';
import { runPreflightChecks } from '@/lib/preflight/checks';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const results = await runPreflightChecks(id);
  return NextResponse.json(results);
}
