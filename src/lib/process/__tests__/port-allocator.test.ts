import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the OS adapter
vi.mock('../../os/adapter', () => ({
  getOsAdapter: () => ({
    isPortInUse: vi.fn(async (port: number) => {
      // Simulate port 3000 being in use
      return port === 3000;
    }),
    findProcessOnPort: vi.fn(async (port: number) => {
      if (port === 3000) return { pid: 1234, name: 'node' };
      return null;
    }),
  }),
}));

// Mock the DB
vi.mock('../../db', () => ({
  getDb: () => ({
    prepare: () => ({
      get: () => null,
      run: vi.fn(),
    }),
  }),
}));

describe('Port Allocator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return desired port when available', async () => {
    const { findFreePort } = await import('../port-allocator');
    const result = await findFreePort(8080);
    expect(result.port).toBe(8080);
    expect(result.wasConflict).toBe(false);
  });

  it('should detect conflict on port 3000 and assign new port', async () => {
    const { findFreePort } = await import('../port-allocator');
    const result = await findFreePort(3000);
    expect(result.wasConflict).toBe(true);
    expect(result.originalPort).toBe(3000);
    expect(result.port).toBeGreaterThanOrEqual(10000);
    expect(result.port).toBeLessThanOrEqual(65000);
  });

  it('should auto-assign port when no desired port given', async () => {
    const { findFreePort } = await import('../port-allocator');
    const result = await findFreePort(null);
    expect(result.port).toBeGreaterThanOrEqual(10000);
    expect(result.wasConflict).toBe(false);
  });
});
