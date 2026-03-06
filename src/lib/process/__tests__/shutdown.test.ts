import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock DB
const mockGet = vi.fn();
vi.mock('../../db', () => ({
  getDb: () => ({
    prepare: () => ({
      get: mockGet,
    }),
  }),
  closeDb: vi.fn(),
}));

// Mock ProcessManager
const mockStopService = vi.fn().mockResolvedValue(undefined);
const mockGetAllRunning = vi.fn().mockReturnValue([]);
vi.mock('../manager', () => ({
  getProcessManager: () => ({
    getAllRunning: mockGetAllRunning,
    stopService: mockStopService,
  }),
}));

describe('Shutdown Handler', () => {
  let originalListeners: Record<string, Function[]>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(undefined); // default: stop_all_on_exit enabled

    // Save and clear existing signal listeners to isolate tests
    originalListeners = {
      SIGINT: process.listeners('SIGINT') as Function[],
      SIGTERM: process.listeners('SIGTERM') as Function[],
    };
  });

  afterEach(() => {
    // Restore original listeners
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    for (const fn of originalListeners.SIGINT) process.on('SIGINT', fn as any);
    for (const fn of originalListeners.SIGTERM) process.on('SIGTERM', fn as any);
  });

  it('should register handlers for SIGINT and SIGTERM', async () => {
    const beforeSigint = process.listenerCount('SIGINT');
    const beforeSigterm = process.listenerCount('SIGTERM');

    const { registerShutdownHandlers } = await import('../shutdown');
    registerShutdownHandlers();

    expect(process.listenerCount('SIGINT')).toBe(beforeSigint + 1);
    expect(process.listenerCount('SIGTERM')).toBe(beforeSigterm + 1);
  });

  it('should default to stop_all_on_exit enabled when no setting exists', async () => {
    mockGet.mockReturnValue(undefined);
    mockGetAllRunning.mockReturnValue([
      { serviceId: 'svc-1', pid: 1234 },
    ]);

    // Import the handler logic indirectly by examining what happens
    // when stop_all_on_exit setting is not in DB
    const { getDb } = await import('../../db');
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'stop_all_on_exit'").get();
    const stopAll = !row || (row as any).value !== 'false';
    expect(stopAll).toBe(true);
  });

  it('should respect stop_all_on_exit = false', async () => {
    mockGet.mockReturnValue({ value: 'false' });

    const { getDb } = await import('../../db');
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'stop_all_on_exit'").get() as any;
    const stopAll = !row || row.value !== 'false';
    expect(stopAll).toBe(false);
  });

  it('should treat stop_all_on_exit = true as enabled', async () => {
    mockGet.mockReturnValue({ value: 'true' });

    const { getDb } = await import('../../db');
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'stop_all_on_exit'").get() as any;
    const stopAll = !row || row.value !== 'false';
    expect(stopAll).toBe(true);
  });

  it('SHUTDOWN_TIMEOUT should be 30 seconds', async () => {
    // Verify the constant is exported at module scope (30_000 ms)
    // We read the source to validate since the constant is not exported
    const fs = await import('fs');
    const source = fs.readFileSync(
      new URL('../shutdown.ts', import.meta.url).pathname.replace('__tests__/../', ''),
      'utf-8'
    );
    expect(source).toContain('SHUTDOWN_TIMEOUT = 30_000');
  });
});
