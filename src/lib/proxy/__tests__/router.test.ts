import { describe, it, expect, vi } from 'vitest';

// Mock DB
const mockSettings = new Map([
  ['base_domain', 'localhost'],
  ['subdomain_routing', 'true'],
  ['portless_mode', 'false'],
  ['proxy_port', '4400'],
]);

vi.mock('../../db', () => ({
  getDb: () => ({
    prepare: (sql: string) => ({
      get: (...args: any[]) => {
        if (sql.includes('settings')) {
          const key = args[0] || sql.match(/'([^']+)'/)?.[1];
          const value = mockSettings.get(key);
          return value ? { value } : null;
        }
        if (sql.includes('projects')) {
          if (args[0] === 'myapp') return { id: 'proj-1' };
          return null;
        }
        if (sql.includes('services') && sql.includes('is_primary')) {
          return { id: 'svc-1', assigned_port: 3001 };
        }
        return null;
      },
      all: () => {
        return [
          { id: 'proj-1', name: 'My App', slug: 'myapp', service_id: 'svc-1', assigned_port: 3001 },
        ];
      },
    }),
  }),
}));

vi.mock('../../process/manager', () => ({
  getProcessManager: () => ({
    isRunning: (id: string) => id === 'svc-1',
    getRunning: (id: string) => id === 'svc-1' ? { assignedPort: 3001 } : undefined,
  }),
}));

describe('Subdomain Router', () => {
  it('should resolve subdomain to project port', async () => {
    const { resolveSubdomain } = await import('../router');
    const target = resolveSubdomain('myapp.localhost');
    expect(target).toEqual({ host: '127.0.0.1', port: 3001 });
  });

  it('should return null for unknown subdomain', async () => {
    const { resolveSubdomain } = await import('../router');
    const target = resolveSubdomain('unknown.localhost');
    expect(target).toBeNull();
  });

  it('should return null for devhub subdomain (serves UI)', async () => {
    const { resolveSubdomain } = await import('../router');
    const target = resolveSubdomain('devhub.localhost');
    expect(target).toBeNull();
  });

  it('should generate routing table with URLs', async () => {
    const { getRoutingTable } = await import('../router');
    const table = getRoutingTable();
    expect(table.length).toBeGreaterThan(0);
    expect(table[0].slug).toBe('myapp');
    expect(table[0].url).toBe('http://localhost:3001');
  });

  it('should generate Caddyfile', async () => {
    const { generateCaddyfile } = await import('../router');
    const caddyfile = generateCaddyfile();
    expect(caddyfile).toContain('*.localhost');
    expect(caddyfile).toContain('reverse_proxy');
    expect(caddyfile).toContain('4400');
  });
});
