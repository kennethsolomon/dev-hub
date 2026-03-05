import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { getOsAdapter } from '@/lib/os/adapter';
import { requireAuth } from '@/lib/auth/session';
import { getProcessManager } from '@/lib/process/manager';
import { execAsync } from '@/lib/os/exec';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  switch (body.action) {
    case 'copy-env': {
      const src = path.join(project.path, '.env.example');
      const dest = path.join(project.path, '.env');
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        return NextResponse.json({ ok: true, message: '.env created from .env.example' });
      }
      return NextResponse.json({ error: '.env already exists or .env.example missing' }, { status: 400 });
    }

    case 'install-deps': {
      try {
        const cmd = project.type === 'laravel' ? 'composer install' : 'npm install';
        await execAsync(cmd, { cwd: project.path, timeout: 120000, encoding: 'utf-8' });
        return NextResponse.json({ ok: true, message: 'Dependencies installed' });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    case 'rebuild-native-modules': {
      try {
        await execAsync('npm rebuild', { cwd: project.path, timeout: 120000, encoding: 'utf-8' });
        return NextResponse.json({ ok: true, message: 'Native modules rebuilt successfully. Restart the service.' });
      } catch (err: any) {
        return NextResponse.json({ error: `npm rebuild failed: ${err.message}` }, { status: 500 });
      }
    }

    case 'reinstall-node-modules': {
      try {
        const nodeModules = path.join(project.path, 'node_modules');
        if (fs.existsSync(nodeModules)) {
          const realNodeModules = fs.realpathSync(nodeModules);
          const realProjectPath = fs.realpathSync(project.path);
          if (!realNodeModules.startsWith(realProjectPath + path.sep)) {
            return NextResponse.json({ error: 'node_modules path is outside project directory' }, { status: 400 });
          }
          fs.rmSync(nodeModules, { recursive: true, force: true });
        }
        await execAsync('npm install', { cwd: project.path, timeout: 300000, encoding: 'utf-8' });
        return NextResponse.json({ ok: true, message: 'node_modules reinstalled successfully. Restart the service.' });
      } catch (err: any) {
        return NextResponse.json({ error: `Reinstall failed: ${err.message}` }, { status: 500 });
      }
    }

    case 'kill-port': {
      const port = parseInt(body.port);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        return NextResponse.json({ error: 'Invalid port number' }, { status: 400 });
      }
      try {
        const os = getOsAdapter();
        const proc = await os.findProcessOnPort(port);
        if (!proc) {
          return NextResponse.json({ ok: true, message: `Port ${port} is already free.` });
        }
        // Only kill processes managed by DevHub
        const pm = getProcessManager();
        const managedPids = pm.getAllRunning().map((sp: any) => sp.pid).filter(Boolean);
        if (!managedPids.includes(proc.pid)) {
          return NextResponse.json(
            { error: `Process ${proc.name} (PID ${proc.pid}) is not managed by DevHub. Kill it manually if needed.` },
            { status: 403 }
          );
        }
        process.kill(proc.pid, 'SIGTERM');
        return NextResponse.json({ ok: true, message: `Killed ${proc.name} (PID ${proc.pid}) on port ${port}. Restart the service.` });
      } catch (err: any) {
        return NextResponse.json({ error: `Failed to kill process on port: ${err.message}` }, { status: 500 });
      }
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
