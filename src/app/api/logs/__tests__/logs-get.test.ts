import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    existsSync: vi.fn(),
  },
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import fs from 'fs';
import { getDb } from '@/lib/db';
import { GET } from '../[runId]/route';

function makeParams(runId: string) {
  return { params: Promise.resolve({ runId }) };
}

function makeRequest(searchParams: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/logs/r1');
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v);
  }
  return { nextUrl: url } as any;
}

function mockDb(run: any) {
  vi.mocked(getDb).mockReturnValue({
    prepare: vi.fn(() => ({ get: () => run })),
  } as any);
}

const logContent = [
  'info: server started on port 3000',
  'warn: deprecated API used',
  'error: connection refused',
  'info: request GET /api/health',
  'info: request POST /api/login',
].join('\n');

describe('GET /api/logs/[runId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when run does not exist', async () => {
    mockDb(null);
    const res = await GET(makeRequest(), makeParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when run has no log_path', async () => {
    mockDb({ id: 'r1', status: 'stopped', log_path: null });
    const res = await GET(makeRequest(), makeParams('r1'));
    expect(res.status).toBe(404);
  });

  it('returns full log content', async () => {
    mockDb({ id: 'r1', status: 'stopped', log_path: '/tmp/r1.log' });
    vi.mocked(fs.readFileSync).mockReturnValue(logContent);

    const res = await GET(makeRequest(), makeParams('r1'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.runId).toBe('r1');
    expect(body.status).toBe('stopped');
    expect(body.content).toBe(logContent);
  });

  it('filters by search term (case-insensitive)', async () => {
    mockDb({ id: 'r1', status: 'stopped', log_path: '/tmp/r1.log' });
    vi.mocked(fs.readFileSync).mockReturnValue(logContent);

    const res = await GET(makeRequest({ search: 'ERROR' }), makeParams('r1'));
    const body = await res.json();
    expect(body.content).toBe('error: connection refused');
  });

  it('returns last N lines with tail param', async () => {
    mockDb({ id: 'r1', status: 'stopped', log_path: '/tmp/r1.log' });
    vi.mocked(fs.readFileSync).mockReturnValue(logContent);

    const res = await GET(makeRequest({ tail: '2' }), makeParams('r1'));
    const body = await res.json();
    const lines = body.content.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('info: request GET /api/health');
    expect(lines[1]).toBe('info: request POST /api/login');
  });

  it('applies search before tail when both provided', async () => {
    mockDb({ id: 'r1', status: 'stopped', log_path: '/tmp/r1.log' });
    vi.mocked(fs.readFileSync).mockReturnValue(logContent);

    // search for "info" gives 3 lines, then tail=1 gives last one
    const res = await GET(makeRequest({ search: 'info', tail: '1' }), makeParams('r1'));
    const body = await res.json();
    expect(body.content).toBe('info: request POST /api/login');
  });

  it('returns 500 when log file cannot be read', async () => {
    mockDb({ id: 'r1', status: 'stopped', log_path: '/tmp/gone.log' });
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('ENOENT'); });

    const res = await GET(makeRequest(), makeParams('r1'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/could not read/i);
  });
});
