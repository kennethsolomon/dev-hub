import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/process/file-watcher', () => ({
  getFileWatcherManager: vi.fn(),
}));

import { getFileWatcherManager } from '@/lib/process/file-watcher';
import { POST } from '../[id]/build/route';

function makeParams(id = 'proj-1') {
  return { params: Promise.resolve({ id }) };
}

function makeRequest() {
  return {} as any;
}

function mockFw(restarted: string[] = []) {
  vi.mocked(getFileWatcherManager).mockReturnValue({
    triggerBuildRestart: vi.fn().mockResolvedValue(restarted),
  } as any);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('POST /api/projects/[id]/build', () => {
  it('returns ok: true with list of restarted services', async () => {
    mockFw(['worker', 'api']);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.restarted).toEqual(['worker', 'api']);
  });

  it('returns empty restarted array when no services were restarted', async () => {
    mockFw([]);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.restarted).toEqual([]);
  });

  it('calls triggerBuildRestart with the project id from params', async () => {
    mockFw();
    const fw = { triggerBuildRestart: vi.fn().mockResolvedValue([]) };
    vi.mocked(getFileWatcherManager).mockReturnValue(fw as any);

    await POST(makeRequest(), makeParams('my-project-id'));

    expect(fw.triggerBuildRestart).toHaveBeenCalledWith('my-project-id');
  });
});
