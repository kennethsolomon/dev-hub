import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../../db', () => ({
  getDb: vi.fn(),
}));

import { execSync } from 'child_process';

describe('checkNodeUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should parse npm outdated JSON output', async () => {
    vi.mocked(execSync).mockReturnValue(JSON.stringify({
      lodash: { current: '4.17.0', wanted: '4.17.21', latest: '4.17.21' },
      react: { current: '17.0.2', wanted: '17.0.2', latest: '18.2.0' },
    }));

    const { checkNodeUpdates } = await import('../advisor');
    const report = await checkNodeUpdates('/project');

    expect(report.tool).toBe('npm');
    expect(report.packages).toHaveLength(2);

    const lodash = report.packages.find(p => p.name === 'lodash')!;
    expect(lodash.isMajor).toBe(false);
    expect(lodash.latest).toBe('4.17.21');

    const react = report.packages.find(p => p.name === 'react')!;
    expect(react.isMajor).toBe(true);
    expect(react.current).toBe('17.0.2');
  });

  it('should return empty packages on empty output', async () => {
    vi.mocked(execSync).mockReturnValue('');

    const { checkNodeUpdates } = await import('../advisor');
    const report = await checkNodeUpdates('/project');

    expect(report.packages).toHaveLength(0);
  });

  it('should return empty packages on error', async () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('fail'); });

    const { checkNodeUpdates } = await import('../advisor');
    const report = await checkNodeUpdates('/project');

    expect(report.packages).toHaveLength(0);
  });
});

describe('checkComposerUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should parse composer outdated JSON output', async () => {
    vi.mocked(execSync).mockReturnValue(JSON.stringify({
      installed: [
        { name: 'laravel/framework', version: 'v10.0.0', latest: 'v11.0.0', 'latest-status': 'semver-safe-update' },
        { name: 'guzzlehttp/guzzle', version: '7.5.0', latest: '7.8.0', 'latest-status': 'semver-safe-update' },
      ],
    }));

    const { checkComposerUpdates } = await import('../advisor');
    const report = await checkComposerUpdates('/project');

    expect(report.tool).toBe('composer');
    expect(report.packages).toHaveLength(2);

    const laravel = report.packages.find(p => p.name === 'laravel/framework')!;
    expect(laravel.isMajor).toBe(true);

    const guzzle = report.packages.find(p => p.name === 'guzzlehttp/guzzle')!;
    expect(guzzle.isMajor).toBe(false);
  });

  it('should handle versioned prefix stripping for major detection', async () => {
    vi.mocked(execSync).mockReturnValue(JSON.stringify({
      installed: [{ name: 'pkg', version: 'v2.0.0', latest: 'v3.0.0' }],
    }));

    const { checkComposerUpdates } = await import('../advisor');
    const report = await checkComposerUpdates('/project');

    expect(report.packages[0].isMajor).toBe(true);
  });
});
