import { NextResponse } from 'next/server';
import { generateCaddyfile } from '@/lib/proxy/router';

export async function GET() {
  const caddyfile = generateCaddyfile();
  return new NextResponse(caddyfile, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
