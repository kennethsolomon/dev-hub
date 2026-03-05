import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getProcessManager } from '@/lib/process/manager';

export async function GET(req: NextRequest) {
  return proxyRequest(req);
}

export async function POST(req: NextRequest) {
  return proxyRequest(req);
}

export async function PUT(req: NextRequest) {
  return proxyRequest(req);
}

export async function DELETE(req: NextRequest) {
  return proxyRequest(req);
}

async function proxyRequest(req: NextRequest): Promise<NextResponse> {
  const subdomain = req.nextUrl.searchParams.get('subdomain');
  const targetPath = req.nextUrl.searchParams.get('path') || '/';

  if (!subdomain) {
    return NextResponse.json({ error: 'No subdomain' }, { status: 400 });
  }

  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE slug = ?').get(subdomain) as any;
  if (!project) {
    return NextResponse.json({ error: `Project "${subdomain}" not found` }, { status: 404 });
  }

  const service = db.prepare(
    'SELECT id, assigned_port FROM services WHERE project_id = ? AND is_primary = 1 LIMIT 1'
  ).get(project.id) as any;

  if (!service?.assigned_port) {
    return NextResponse.json({ error: `No primary service with assigned port for "${subdomain}"` }, { status: 502 });
  }

  const pm = getProcessManager();
  if (!pm.isRunning(service.id)) {
    return NextResponse.json({ error: `Service for "${subdomain}" is not running` }, { status: 502 });
  }

  // Proxy the request
  const targetUrl = `http://127.0.0.1:${service.assigned_port}${targetPath}`;

  try {
    const headers = new Headers(req.headers);
    headers.delete('host');

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      redirect: 'manual',
    });

    const responseHeaders = new Headers(response.headers);
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return NextResponse.json({ error: `Failed to reach service at port ${service.assigned_port}` }, { status: 502 });
  }
}
