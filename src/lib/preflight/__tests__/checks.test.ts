import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../../db', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../os/adapter', () => ({
  getOsAdapter: vi.fn(),
}));

vi.mock('../../toolchain/detector', () => ({
  getToolchainDetector: vi.fn(),
}));

import fs from 'fs';
import { getDb } from '../../db';
import { getOsAdapter } from '../../os/adapter';
import { getToolchainDetector } from '../../toolchain/detector';

function mockDb(project: any, services: any[] = [], envDefs: any[] = []) {
  vi.mocked(getDb).mockReturnValue({
    prepare: vi.fn((sql: string): { get: () => any; all: () => any[] } => {
      if (sql.includes('FROM projects')) return { get: () => project, all: () => [project].filter(Boolean) };
      if (sql.includes('FROM services')) return { get: () => services[0] ?? null, all: () => services };
      if (sql.includes('FROM env_definitions')) return { get: () => envDefs[0] ?? null, all: () => envDefs };
      return { get: () => null, all: () => [] };
    }),
  } as any);
}

function mockToolchain(info: any = {}) {
  vi.mocked(getToolchainDetector).mockReturnValue({ detect: vi.fn(async () => info) });
}

function mockOs(portMap: Record<number, { inUse: boolean; proc?: any }> = {}) {
  vi.mocked(getOsAdapter).mockReturnValue({
    isPortInUse: vi.fn(async (port: number) => portMap[port]?.inUse ?? false),
    findProcessOnPort: vi.fn(async (port: number) => portMap[port]?.proc ?? null),
  } as any);
}

describe('runPreflightChecks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should fail when project not found', async () => {
    mockDb(undefined);
    mockToolchain();
    mockOs();

    const { runPreflightChecks } = await import('../checks');
    const results = await runPreflightChecks('missing-id');

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('fail');
    expect(results[0].check).toBe('project');
  });

  it('should fail when project path does not exist', async () => {
    mockDb({ id: '1', path: '/nonexistent', type: 'node' });
    mockToolchain();
    mockOs();
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const { runPreflightChecks } = await import('../checks');
    const results = await runPreflightChecks('1');

    expect(results).toHaveLength(1);
    expect(results[0].check).toBe('path');
    expect(results[0].status).toBe('fail');
  });

  it('should detect missing .env with quickfix when .env.example exists', async () => {
    const project = { id: '1', path: '/project', type: 'node' };
    mockDb(project, []);
    mockToolchain();
    mockOs();
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p === '/project') return true;
      if (p.endsWith('.env.example')) return true;
      if (p.endsWith('.env')) return false;
      if (p.endsWith('node_modules')) return true;
      return false;
    });

    const { runPreflightChecks } = await import('../checks');
    const results = await runPreflightChecks('1');

    const envCheck = results.find(r => r.check === 'env');
    expect(envCheck).toBeDefined();
    expect(envCheck!.status).toBe('fail');
    expect(envCheck!.quickFix?.action).toBe('copy-env');
  });

  it('should detect missing node_modules for node projects', async () => {
    const project = { id: '1', path: '/project', type: 'node' };
    mockDb(project, []);
    mockToolchain();
    mockOs();
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p === '/project') return true;
      if (p.endsWith('node_modules')) return false;
      return false;
    });

    const { runPreflightChecks } = await import('../checks');
    const results = await runPreflightChecks('1');

    const depsCheck = results.find(r => r.check === 'deps');
    expect(depsCheck).toBeDefined();
    expect(depsCheck!.status).toBe('fail');
    expect(depsCheck!.quickFix?.action).toBe('install-deps');
  });

  it('should detect missing vendor for laravel projects', async () => {
    const project = { id: '1', path: '/project', type: 'laravel' };
    mockDb(project, []);
    mockToolchain();
    mockOs();
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p === '/project') return true;
      if (p.endsWith('vendor')) return false;
      return false;
    });

    const { runPreflightChecks } = await import('../checks');
    const results = await runPreflightChecks('1');

    const depsCheck = results.find(r => r.check === 'deps');
    expect(depsCheck).toBeDefined();
    expect(depsCheck!.status).toBe('fail');
    expect(depsCheck!.message).toContain('vendor');
  });

  it('should warn on port conflicts', async () => {
    const project = { id: '1', path: '/project', type: 'node' };
    const services = [{ name: 'web', desired_port: 3000 }];
    mockDb(project, services);
    mockToolchain();
    mockOs({ 3000: { inUse: true, proc: { pid: 1234, name: 'node' } } });
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p === '/project') return true;
      if (p.endsWith('node_modules')) return true;
      return false;
    });

    const { runPreflightChecks } = await import('../checks');
    const results = await runPreflightChecks('1');

    const portCheck = results.find(r => r.check === 'port-web');
    expect(portCheck).toBeDefined();
    expect(portCheck!.status).toBe('warn');
    expect(portCheck!.message).toContain('3000');
    expect(portCheck!.message).toContain('node');
  });

  it('should pass when port is available', async () => {
    const project = { id: '1', path: '/project', type: 'node' };
    const services = [{ name: 'web', desired_port: 8080 }];
    mockDb(project, services);
    mockToolchain();
    mockOs({});
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p === '/project') return true;
      if (p.endsWith('node_modules')) return true;
      return false;
    });

    const { runPreflightChecks } = await import('../checks');
    const results = await runPreflightChecks('1');

    const portCheck = results.find(r => r.check === 'port-web');
    expect(portCheck).toBeDefined();
    expect(portCheck!.status).toBe('pass');
  });

  it('should detect missing required env keys', async () => {
    const project = { id: '1', path: '/project', type: 'node' };
    const envDefs = [{ key: 'DB_HOST', required: 1 }, { key: 'API_KEY', required: 1 }];
    mockDb(project, [], envDefs);
    mockToolchain();
    mockOs();
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p === '/project') return true;
      if (p.endsWith('.env')) return true;
      if (p.endsWith('node_modules')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('DB_HOST=localhost\nSECRET=abc\n');

    const { runPreflightChecks } = await import('../checks');
    const results = await runPreflightChecks('1');

    const missingKey = results.find(r => r.check === 'env-key-API_KEY');
    expect(missingKey).toBeDefined();
    expect(missingKey!.status).toBe('fail');

    const presentKey = results.find(r => r.check === 'env-key-DB_HOST');
    expect(presentKey).toBeUndefined(); // DB_HOST is present, so no fail entry
  });
});
