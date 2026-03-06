import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('@/lib/process/file-watcher', () => ({
  getFileWatcherManager: vi.fn(),
}));

import { getFileWatcherManager } from '@/lib/process/file-watcher';
import { GET } from '../stream/route';

function makeRequest(aborted = false) {
  const controller = new AbortController();
  if (aborted) controller.abort();
  return { signal: controller.signal } as any;
}

function makeFwEmitter() {
  const emitter = new EventEmitter();
  vi.mocked(getFileWatcherManager).mockReturnValue(emitter as any);
  return emitter;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/build/stream', () => {
  it('returns a text/event-stream response with correct headers', async () => {
    makeFwEmitter();
    const res = await GET(makeRequest());

    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
    expect(res.headers.get('Connection')).toBe('keep-alive');
  });

  it('streams a build-status event as SSE data', async () => {
    const emitter = makeFwEmitter();
    const res = await GET(makeRequest());

    // Emit a build-status event after stream is set up
    emitter.emit('build-status', 'proj-1', 'building', 'worker');

    // Read the first chunk from the stream
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    expect(text).toMatch(/^data: /);
    const payload = JSON.parse(text.replace('data: ', '').trim());
    expect(payload.projectId).toBe('proj-1');
    expect(payload.phase).toBe('building');
    expect(payload.serviceName).toBe('worker');

    reader.cancel();
  });

  it('includes all event fields in streamed payload', async () => {
    const emitter = makeFwEmitter();
    const res = await GET(makeRequest());

    emitter.emit('build-status', 'proj-2', 'complete', undefined, undefined, ['worker', 'api']);

    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    const payload = JSON.parse(text.replace('data: ', '').trim());

    expect(payload.projectId).toBe('proj-2');
    expect(payload.phase).toBe('complete');
    expect(payload.restarted).toEqual(['worker', 'api']);

    reader.cancel();
  });

  it('includes error field when build-status emits an error', async () => {
    const emitter = makeFwEmitter();
    const res = await GET(makeRequest());

    emitter.emit('build-status', 'proj-1', 'error', 'worker', 'compilation failed');

    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    const payload = JSON.parse(text.replace('data: ', '').trim());

    expect(payload.phase).toBe('error');
    expect(payload.error).toBe('compilation failed');

    reader.cancel();
  });

  it('removes build-status listener when request is aborted', async () => {
    const emitter = makeFwEmitter();
    const controller = new AbortController();
    const req = { signal: controller.signal } as any;

    await GET(req);

    expect(emitter.listenerCount('build-status')).toBe(1);

    controller.abort();

    // Allow abort event to propagate
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(emitter.listenerCount('build-status')).toBe(0);
  });
});
