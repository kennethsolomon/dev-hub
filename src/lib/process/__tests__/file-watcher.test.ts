import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => {
  const mockWatcher = {
    close: vi.fn(),
    on: vi.fn(),
  };
  return {
    default: {
      existsSync: vi.fn(),
      watch: vi.fn().mockReturnValue(mockWatcher),
    },
    existsSync: vi.fn(),
    watch: vi.fn().mockReturnValue(mockWatcher),
  };
});

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/process/manager', () => ({
  getProcessManager: vi.fn(),
}));

vi.mock('@/lib/os/adapter', () => ({
  getOsAdapter: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

import fs from 'fs';
import { exec } from 'child_process';
import { getDb } from '@/lib/db';
import { getProcessManager } from '@/lib/process/manager';
import { getOsAdapter } from '@/lib/os/adapter';
import { getFileWatcherManager } from '@/lib/process/file-watcher';

const baseProject = {
  id: 'proj-1',
  path: '/projects/myapp',
  build_command: null,
  watch_debounce_ms: 100,
  auto_build_enabled: 1,
};

const baseService = {
  id: 'svc-1',
  name: 'worker',
  cwd: null,
  watch_build_command: null,
  restart_on_watch: 1,
};

function mockDb({
  project = baseProject,
  services = [baseService],
}: {
  project?: any;
  services?: any[];
} = {}) {
  vi.mocked(getDb).mockReturnValue({
    prepare: vi.fn((sql: string) => ({
      get: vi.fn(() => (sql.includes('projects') ? project : undefined)),
      all: vi.fn(() => {
        if (sql.includes('services')) return services;
        if (sql.includes('projects')) return project ? [project] : [];
        return [];
      }),
    })),
  } as any);
}

function mockPm(runningIds: string[] = ['svc-1']) {
  vi.mocked(getProcessManager).mockReturnValue({
    isRunning: vi.fn((id: string) => runningIds.includes(id)),
    stopService: vi.fn().mockResolvedValue(undefined),
    startService: vi.fn().mockResolvedValue({ runId: 'run-1', assignedPort: null }),
  } as any);
}

function mockOs() {
  vi.mocked(getOsAdapter).mockReturnValue({
    wrapCommand: vi.fn((cmd: string) => ['/bin/zsh', '-lc', cmd]),
  } as any);
}

function resolveExec() {
  vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
    cb(null, 'build output', '');
    return {} as any;
  });
}

function rejectExec(msg = 'build failed') {
  vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
    cb(new Error(msg), '', msg);
    return {} as any;
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  // Reset the globalThis singleton between each test
  (globalThis as any).__devhub_fw = undefined;

  // Default: project path exists
  vi.mocked(fs.existsSync).mockReturnValue(true);
  // Default fs.watch mock
  const mockWatcher = { close: vi.fn(), on: vi.fn() };
  vi.mocked(fs.watch).mockReturnValue(mockWatcher as any);
});

// ─── getFileWatcherManager ────────────────────────────────────────────────────

describe('getFileWatcherManager', () => {
  it('returns the same instance on repeated calls', () => {
    const a = getFileWatcherManager();
    const b = getFileWatcherManager();
    expect(a).toBe(b);
  });
});

// ─── isWatching ───────────────────────────────────────────────────────────────

describe('isWatching', () => {
  it('returns false for an untracked project', () => {
    const fw = getFileWatcherManager();
    expect(fw.isWatching('proj-1')).toBe(false);
  });

  it('returns true after startWatching', () => {
    mockDb();
    const fw = getFileWatcherManager();
    fw.startWatching('proj-1');
    expect(fw.isWatching('proj-1')).toBe(true);
  });
});

// ─── startWatching ────────────────────────────────────────────────────────────

describe('startWatching', () => {
  it('does nothing if project is not in DB', () => {
    mockDb({ project: null });
    const fw = getFileWatcherManager();
    fw.startWatching('proj-1');
    expect(fs.watch).not.toHaveBeenCalled();
    expect(fw.isWatching('proj-1')).toBe(false);
  });

  it('does nothing if project path does not exist on disk', () => {
    mockDb();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const fw = getFileWatcherManager();
    fw.startWatching('proj-1');
    expect(fs.watch).not.toHaveBeenCalled();
  });

  it('starts a recursive watcher on the project path', () => {
    mockDb();
    const fw = getFileWatcherManager();
    fw.startWatching('proj-1');
    expect(fs.watch).toHaveBeenCalledWith(
      baseProject.path,
      { recursive: true },
      expect.any(Function)
    );
    expect(fw.isWatching('proj-1')).toBe(true);
  });

  it('is idempotent — does not start a second watcher for the same project', () => {
    mockDb();
    const fw = getFileWatcherManager();
    fw.startWatching('proj-1');
    fw.startWatching('proj-1');
    expect(fs.watch).toHaveBeenCalledTimes(1);
  });
});

// ─── stopWatching ─────────────────────────────────────────────────────────────

describe('stopWatching', () => {
  it('does nothing for an untracked project', () => {
    const fw = getFileWatcherManager();
    expect(() => fw.stopWatching('proj-1')).not.toThrow();
  });

  it('closes the watcher and untracks the project', () => {
    mockDb();
    const mockWatcher = { close: vi.fn(), on: vi.fn() };
    vi.mocked(fs.watch).mockReturnValue(mockWatcher as any);

    const fw = getFileWatcherManager();
    fw.startWatching('proj-1');
    expect(fw.isWatching('proj-1')).toBe(true);

    fw.stopWatching('proj-1');
    expect(mockWatcher.close).toHaveBeenCalled();
    expect(fw.isWatching('proj-1')).toBe(false);
  });
});

// ─── stopAll ──────────────────────────────────────────────────────────────────

describe('stopAll', () => {
  it('stops all tracked watchers', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();

    vi.mocked(fs.watch)
      .mockReturnValueOnce({ close: closeA, on: vi.fn() } as any)
      .mockReturnValueOnce({ close: closeB, on: vi.fn() } as any);

    // Two different projects
    vi.mocked(getDb).mockReturnValue({
      prepare: vi.fn(() => ({
        get: vi.fn(() => ({ ...baseProject })),
        all: vi.fn(() => []),
      })),
    } as any);

    const fw = getFileWatcherManager();
    fw.startWatching('proj-1');
    fw.startWatching('proj-2');

    fw.stopAll();

    expect(closeA).toHaveBeenCalled();
    expect(closeB).toHaveBeenCalled();
    expect(fw.isWatching('proj-1')).toBe(false);
    expect(fw.isWatching('proj-2')).toBe(false);
  });
});

// ─── triggerBuildRestart ──────────────────────────────────────────────────────

describe('triggerBuildRestart', () => {
  it('returns empty array if project is not found in DB', async () => {
    mockDb({ project: null });
    const fw = getFileWatcherManager();
    const result = await fw.triggerBuildRestart('proj-1');
    expect(result).toEqual([]);
  });

  it('returns empty array if no services have restart_on_watch', async () => {
    mockDb({ services: [] });
    mockPm([]);
    const fw = getFileWatcherManager();
    const result = await fw.triggerBuildRestart('proj-1');
    expect(result).toEqual([]);
  });

  it('returns empty array if no watch services are currently running', async () => {
    mockDb();
    mockPm([]); // none running
    const fw = getFileWatcherManager();
    const result = await fw.triggerBuildRestart('proj-1');
    expect(result).toEqual([]);
  });

  it('emits change-detected then complete and returns restarted service names', async () => {
    mockDb();
    mockPm(['svc-1']);
    const pm = getProcessManager();
    const fw = getFileWatcherManager();

    const events: string[] = [];
    fw.on('build-status', (_pid: string, phase: string) => events.push(phase));

    const result = await fw.triggerBuildRestart('proj-1');

    expect(events).toContain('change-detected');
    expect(events).toContain('restarting');
    expect(events).toContain('complete');
    expect(pm.stopService).toHaveBeenCalledWith('svc-1');
    expect(pm.startService).toHaveBeenCalledWith('svc-1');
    expect(result).toEqual(['worker']);
  });

  it('runs project-level build_command before restarting', async () => {
    mockDb({ project: { ...baseProject, build_command: 'pnpm build' } });
    mockPm(['svc-1']);
    mockOs();
    resolveExec();

    const fw = getFileWatcherManager();
    const events: string[] = [];
    fw.on('build-status', (_pid: string, phase: string) => events.push(phase));

    await fw.triggerBuildRestart('proj-1');

    expect(exec).toHaveBeenCalled();
    expect(events).toContain('building');
    expect(events).toContain('restarting');
    expect(events).toContain('complete');
  });

  it('prefers service-level watch_build_command over project build_command', async () => {
    mockDb({
      project: { ...baseProject, build_command: 'pnpm build' },
      services: [{ ...baseService, watch_build_command: 'pnpm build:worker' }],
    });
    mockPm(['svc-1']);
    mockOs();
    resolveExec();

    const fw = getFileWatcherManager();
    await fw.triggerBuildRestart('proj-1');

    const [call] = vi.mocked(exec).mock.calls;
    expect(call[0]).toContain('pnpm build:worker');
  });

  it('emits error and skips restart when build command fails', async () => {
    mockDb({ project: { ...baseProject, build_command: 'pnpm build' } });
    mockPm(['svc-1']);
    mockOs();
    rejectExec('compilation error');

    const fw = getFileWatcherManager();
    const events: string[] = [];
    fw.on('build-status', (_pid: string, phase: string) => events.push(phase));

    const result = await fw.triggerBuildRestart('proj-1');
    const pm = getProcessManager();

    expect(events).toContain('error');
    expect(events).not.toContain('restarting');
    expect(pm.stopService).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('emits error but continues when restart fails', async () => {
    mockDb({
      services: [baseService, { ...baseService, id: 'svc-2', name: 'api' }],
    });
    mockPm(['svc-1', 'svc-2']);

    vi.mocked(getProcessManager).mockReturnValue({
      isRunning: vi.fn((id: string) => ['svc-1', 'svc-2'].includes(id)),
      stopService: vi.fn()
        .mockRejectedValueOnce(new Error('stop failed'))
        .mockResolvedValue(undefined),
      startService: vi.fn().mockResolvedValue({ runId: 'r1', assignedPort: null }),
    } as any);

    const fw = getFileWatcherManager();
    const events: string[] = [];
    fw.on('build-status', (_pid: string, phase: string) => events.push(phase));

    const result = await fw.triggerBuildRestart('proj-1');

    expect(events).toContain('error');
    // svc-2 should still succeed
    expect(result).toEqual(['api']);
  });
});

// ─── rehydrate ────────────────────────────────────────────────────────────────

describe('rehydrate', () => {
  it('starts watchers for auto_build_enabled projects that have running services', () => {
    vi.mocked(getDb).mockReturnValue({
      prepare: vi.fn((sql: string) => ({
        all: vi.fn(() => {
          if (sql.includes('auto_build_enabled')) return [baseProject];
          if (sql.includes('services')) return [{ id: 'svc-1' }];
          return [];
        }),
        get: vi.fn(() => baseProject),
      })),
    } as any);
    mockPm(['svc-1']);

    const fw = getFileWatcherManager();
    fw.rehydrate();

    expect(fw.isWatching('proj-1')).toBe(true);
  });

  it('skips projects with no running services', () => {
    vi.mocked(getDb).mockReturnValue({
      prepare: vi.fn((sql: string) => ({
        all: vi.fn(() => {
          if (sql.includes('auto_build_enabled')) return [baseProject];
          if (sql.includes('services')) return [{ id: 'svc-1' }];
          return [];
        }),
        get: vi.fn(() => baseProject),
      })),
    } as any);
    mockPm([]); // nothing running

    const fw = getFileWatcherManager();
    fw.rehydrate();

    expect(fw.isWatching('proj-1')).toBe(false);
  });

  it('does not throw when DB query fails', () => {
    vi.mocked(getDb).mockReturnValue({
      prepare: vi.fn(() => { throw new Error('db error'); }),
    } as any);

    const fw = getFileWatcherManager();
    expect(() => fw.rehydrate()).not.toThrow();
  });
});
