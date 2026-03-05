import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    copyFileSync: vi.fn(),
    realpathSync: vi.fn(),
    rmSync: vi.fn(),
  },
  existsSync: vi.fn(),
  copyFileSync: vi.fn(),
  realpathSync: vi.fn(),
  rmSync: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/os/exec', () => ({
  execAsync: vi.fn(),
}));

vi.mock('@/lib/os/adapter', () => ({
  getOsAdapter: vi.fn(),
}));

vi.mock('@/lib/process/manager', () => ({
  getProcessManager: vi.fn(),
}));

import fs from 'fs';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth/session';
import { execAsync } from '@/lib/os/exec';
import { getOsAdapter } from '@/lib/os/adapter';
import { getProcessManager } from '@/lib/process/manager';
import { POST } from '../[id]/quickfix/route';

const project = { id: 'p1', path: '/projects/myapp', type: 'node' };

function mockDb(proj: any = project) {
  vi.mocked(getDb).mockReturnValue({
    prepare: vi.fn((): { get: () => any } => ({
      get: () => proj,
    })),
  } as any);
}

function makeRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
  } as any;
}

function makeParams(id = 'p1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(true as any);
  mockDb();
});

describe('POST /api/projects/[id]/quickfix', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(false as any);
    const res = await POST(makeRequest({ action: 'copy-env' }), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown project', async () => {
    mockDb(null);
    const res = await POST(makeRequest({ action: 'copy-env' }), makeParams());
    expect(res.status).toBe(404);
  });

  it('returns 400 for unknown action', async () => {
    const res = await POST(makeRequest({ action: 'nope' }), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Unknown action');
  });

  describe('copy-env', () => {
    it('copies .env.example to .env when valid', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: any) => {
        if (String(p).endsWith('.env.example')) return true;
        if (String(p).endsWith('.env')) return false;
        return false;
      });

      const res = await POST(makeRequest({ action: 'copy-env' }), makeParams());
      expect(res.status).toBe(200);
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('returns 400 if .env already exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const res = await POST(makeRequest({ action: 'copy-env' }), makeParams());
      expect(res.status).toBe(400);
    });
  });

  describe('install-deps', () => {
    it('runs npm install for node projects', async () => {
      vi.mocked(execAsync).mockResolvedValue('ok');
      const res = await POST(makeRequest({ action: 'install-deps' }), makeParams());
      expect(res.status).toBe(200);
      expect(execAsync).toHaveBeenCalledWith(
        expect.stringContaining('npm install'),
        expect.objectContaining({ cwd: project.path })
      );
    });

    it('runs composer install for laravel projects', async () => {
      mockDb({ ...project, type: 'laravel' });
      vi.mocked(execAsync).mockResolvedValue('ok');
      const res = await POST(makeRequest({ action: 'install-deps' }), makeParams());
      expect(res.status).toBe(200);
      expect(execAsync).toHaveBeenCalledWith(
        expect.stringContaining('composer install'),
        expect.any(Object)
      );
    });

    it('returns 500 on exec failure', async () => {
      vi.mocked(execAsync).mockRejectedValue(new Error('install failed'));
      const res = await POST(makeRequest({ action: 'install-deps' }), makeParams());
      expect(res.status).toBe(500);
    });
  });

  describe('rebuild-native-modules', () => {
    it('runs npm rebuild', async () => {
      vi.mocked(execAsync).mockResolvedValue('ok');
      const res = await POST(makeRequest({ action: 'rebuild-native-modules' }), makeParams());
      expect(res.status).toBe(200);
      expect(execAsync).toHaveBeenCalledWith(
        expect.stringContaining('npm rebuild'),
        expect.objectContaining({ cwd: project.path })
      );
    });
  });

  describe('reinstall-node-modules', () => {
    it('deletes node_modules and reinstalls when path is safe', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.realpathSync).mockImplementation((p: any) => String(p));
      vi.mocked(execAsync).mockResolvedValue('ok');

      const res = await POST(makeRequest({ action: 'reinstall-node-modules' }), makeParams());
      expect(res.status).toBe(200);
      expect(fs.rmSync).toHaveBeenCalled();
      expect(execAsync).toHaveBeenCalledWith(
        expect.stringContaining('npm install'),
        expect.any(Object)
      );
    });

    it('rejects when node_modules resolves outside project', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.realpathSync).mockImplementation((p: any) => {
        if (String(p).includes('node_modules')) return '/etc/evil';
        return String(p);
      });

      const res = await POST(makeRequest({ action: 'reinstall-node-modules' }), makeParams());
      expect(res.status).toBe(400);
      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it('skips delete if node_modules does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(execAsync).mockResolvedValue('ok');

      const res = await POST(makeRequest({ action: 'reinstall-node-modules' }), makeParams());
      expect(res.status).toBe(200);
      expect(fs.rmSync).not.toHaveBeenCalled();
    });
  });

  describe('kill-port', () => {
    it('returns 400 for invalid port', async () => {
      const res = await POST(makeRequest({ action: 'kill-port', port: 'abc' }), makeParams());
      expect(res.status).toBe(400);
    });

    it('returns 400 for out-of-range port', async () => {
      const res = await POST(makeRequest({ action: 'kill-port', port: 99999 }), makeParams());
      expect(res.status).toBe(400);
    });

    it('returns ok if port is already free', async () => {
      vi.mocked(getOsAdapter).mockReturnValue({
        findProcessOnPort: vi.fn().mockResolvedValue(null),
      } as any);

      const res = await POST(makeRequest({ action: 'kill-port', port: 3000 }), makeParams());
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toContain('already free');
    });

    it('returns 403 for non-managed process', async () => {
      vi.mocked(getOsAdapter).mockReturnValue({
        findProcessOnPort: vi.fn().mockResolvedValue({ pid: 999, name: 'chrome' }),
      } as any);
      vi.mocked(getProcessManager).mockReturnValue({
        getAllRunning: vi.fn().mockReturnValue([{ pid: 111 }]),
      } as any);

      const res = await POST(makeRequest({ action: 'kill-port', port: 3000 }), makeParams());
      expect(res.status).toBe(403);
    });

    it('kills managed process and returns ok', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
      vi.mocked(getOsAdapter).mockReturnValue({
        findProcessOnPort: vi.fn().mockResolvedValue({ pid: 111, name: 'node' }),
      } as any);
      vi.mocked(getProcessManager).mockReturnValue({
        getAllRunning: vi.fn().mockReturnValue([{ pid: 111 }]),
      } as any);

      const res = await POST(makeRequest({ action: 'kill-port', port: 3000 }), makeParams());
      expect(res.status).toBe(200);
      expect(killSpy).toHaveBeenCalledWith(111, 'SIGTERM');
      killSpy.mockRestore();
    });
  });
});
