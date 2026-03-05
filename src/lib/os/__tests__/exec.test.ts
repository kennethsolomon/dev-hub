import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

import { exec } from 'child_process';
import { execAsync } from '../exec';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('execAsync', () => {
  it('resolves with stdout on success', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, 'hello world', '');
      return {} as any;
    });

    const result = await execAsync('echo hello', { encoding: 'utf-8' });
    expect(result).toBe('hello world');
  });

  it('converts stdout to string', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, Buffer.from('buffer output'), '');
      return {} as any;
    });

    const result = await execAsync('echo buffer', { encoding: 'utf-8' });
    expect(result).toBe('buffer output');
  });

  it('rejects with error on failure', async () => {
    const error = new Error('command failed');
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(error, 'partial out', 'error msg');
      return {} as any;
    });

    await expect(execAsync('bad-cmd', {})).rejects.toThrow('command failed');
  });

  it('attaches stdout and stderr to rejected error', async () => {
    const error = new Error('fail');
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(error, 'out-data', 'err-data');
      return {} as any;
    });

    try {
      await execAsync('bad-cmd', {});
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e.stdout).toBe('out-data');
      expect(e.stderr).toBe('err-data');
    }
  });

  it('passes command and options to exec', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, '', '');
      return {} as any;
    });

    const opts = { cwd: '/tmp', timeout: 5000, encoding: 'utf-8' };
    await execAsync('ls', opts);

    expect(exec).toHaveBeenCalledWith('ls', opts, expect.any(Function));
  });
});
