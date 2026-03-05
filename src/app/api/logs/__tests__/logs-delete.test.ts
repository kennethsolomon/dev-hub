import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  default: {
    unlinkSync: vi.fn(),
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
  unlinkSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import fs from 'fs';
import { getDb } from '@/lib/db';
import { DELETE as deleteRun } from '../[runId]/route';
import { DELETE as deleteProjectLogs } from '../../projects/[id]/logs/route';

function makeParams<T>(val: T): { params: Promise<T> } {
  return { params: Promise.resolve(val) };
}

function makeRequest(): any {
  return {} as any;
}

describe('DELETE /api/logs/[runId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockDb(run: any) {
    const deleteStmt = { run: vi.fn() };
    const selectStmt = { get: () => run };
    vi.mocked(getDb).mockReturnValue({
      prepare: vi.fn((sql: string) =>
        sql.startsWith('DELETE') ? deleteStmt : selectStmt
      ),
    } as any);
    return { deleteStmt };
  }

  it('returns 404 when run does not exist', async () => {
    mockDb(null);
    const res = await deleteRun(makeRequest(), makeParams({ runId: 'nonexistent' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Run not found');
  });

  it('returns 400 when run is still running', async () => {
    mockDb({ id: 'r1', status: 'running', log_path: '/tmp/r1.log' });
    const res = await deleteRun(makeRequest(), makeParams({ runId: 'r1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/running/i);
  });

  it('deletes run record and removes log file', async () => {
    const { deleteStmt } = mockDb({ id: 'r1', status: 'stopped', log_path: '/tmp/r1.log' });
    const res = await deleteRun(makeRequest(), makeParams({ runId: 'r1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/r1.log');
    expect(deleteStmt.run).toHaveBeenCalledWith('r1');
  });

  it('deletes run record even when log_path is null', async () => {
    const { deleteStmt } = mockDb({ id: 'r2', status: 'exited', log_path: null });
    const res = await deleteRun(makeRequest(), makeParams({ runId: 'r2' }));
    expect(res.status).toBe(200);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
    expect(deleteStmt.run).toHaveBeenCalledWith('r2');
  });

  it('succeeds even if log file is already gone', async () => {
    vi.mocked(fs.unlinkSync).mockImplementation(() => { throw new Error('ENOENT'); });
    mockDb({ id: 'r3', status: 'stopped', log_path: '/tmp/gone.log' });
    const res = await deleteRun(makeRequest(), makeParams({ runId: 'r3' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });
});

describe('DELETE /api/projects/[id]/logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockDb(runs: Array<{ id: string; log_path: string | null }>) {
    const deleteStmt = { run: vi.fn() };
    const selectStmt = { all: () => runs };
    vi.mocked(getDb).mockReturnValue({
      prepare: vi.fn((sql: string) =>
        sql.startsWith('DELETE') ? deleteStmt : selectStmt
      ),
    } as any);
    return { deleteStmt };
  }

  it('returns deleted count of 0 when no runs exist', async () => {
    mockDb([]);
    const res = await deleteProjectLogs(makeRequest(), makeParams({ id: 'p1' }));
    const body = await res.json();
    expect(body.deleted).toBe(0);
  });

  it('deletes all non-running runs and their log files', async () => {
    const runs = [
      { id: 'r1', log_path: '/tmp/r1.log' },
      { id: 'r2', log_path: '/tmp/r2.log' },
    ];
    const { deleteStmt } = mockDb(runs);
    const res = await deleteProjectLogs(makeRequest(), makeParams({ id: 'p1' }));
    const body = await res.json();
    expect(body.deleted).toBe(2);
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/r1.log');
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/r2.log');
    expect(deleteStmt.run).toHaveBeenCalledWith('r1', 'r2');
  });

  it('skips unlink for runs without log_path', async () => {
    const runs = [
      { id: 'r1', log_path: null },
      { id: 'r2', log_path: '/tmp/r2.log' },
    ];
    mockDb(runs);
    const res = await deleteProjectLogs(makeRequest(), makeParams({ id: 'p1' }));
    const body = await res.json();
    expect(body.deleted).toBe(2);
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/r2.log');
  });

  it('succeeds even if log file removal fails', async () => {
    vi.mocked(fs.unlinkSync).mockImplementation(() => { throw new Error('ENOENT'); });
    mockDb([{ id: 'r1', log_path: '/tmp/gone.log' }]);
    const res = await deleteProjectLogs(makeRequest(), makeParams({ id: 'p1' }));
    const body = await res.json();
    expect(body.deleted).toBe(1);
  });
});
