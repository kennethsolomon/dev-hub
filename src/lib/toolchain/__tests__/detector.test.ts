import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import fs from 'fs';
import { execSync } from 'child_process';

describe('ToolchainDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton so each test gets a fresh detector
    vi.resetModules();
  });

  it('should detect node version from .nvmrc', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p.endsWith('.nvmrc')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('18');
    vi.mocked(execSync).mockReturnValue('v18.17.0\n');

    const { getToolchainDetector } = await import('../detector');
    const detector = getToolchainDetector();
    const info = await detector.detect('/project');

    expect(info.node).toBeDefined();
    expect(info.node!.required).toBe('18');
    expect(info.node!.active).toBe('v18.17.0');
    expect(info.node!.source).toBe('nvmrc');
    expect(info.node!.mismatch).toBe(false);
  });

  it('should detect node version from package.json engines', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p.endsWith('.nvmrc')) return false;
      if (p.endsWith('package.json')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ engines: { node: '20.x' } }));
    vi.mocked(execSync).mockReturnValue('v20.10.0\n');

    const { getToolchainDetector } = await import('../detector');
    const info = await getToolchainDetector().detect('/project');

    expect(info.node!.required).toBe('20.x');
    expect(info.node!.source).toBe('engines');
    expect(info.node!.mismatch).toBe(false);
  });

  it('should detect node version mismatch', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p.endsWith('.nvmrc')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('20');
    vi.mocked(execSync).mockReturnValue('v18.17.0\n');

    const { getToolchainDetector } = await import('../detector');
    const info = await getToolchainDetector().detect('/project');

    expect(info.node!.mismatch).toBe(true);
  });

  it('should detect PHP from composer.json with Herd', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p.endsWith('composer.json')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ require: { php: '^8.2' } }));
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      if (cmd === 'which php') return '/Applications/Herd/bin/php\n';
      if (cmd === 'php --version') return 'PHP 8.2.15 (cli)\nother info';
      return '';
    });

    const { getToolchainDetector } = await import('../detector');
    const info = await getToolchainDetector().detect('/project');

    expect(info.php).toBeDefined();
    expect(info.php!.required).toBe('^8.2');
    expect(info.php!.active).toBe('PHP 8.2.15 (cli)');
    expect(info.php!.source).toBe('herd');
  });

  it('should return empty info when no toolchain files exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(execSync).mockImplementation(() => { throw new Error('not found'); });

    const { getToolchainDetector } = await import('../detector');
    const info = await getToolchainDetector().detect('/project');

    expect(info.node).toBeUndefined();
    expect(info.php).toBeUndefined();
  });

  it('should handle node active without required version', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      if (cmd === 'node --version') return 'v20.10.0\n';
      throw new Error('not found');
    });

    const { getToolchainDetector } = await import('../detector');
    const info = await getToolchainDetector().detect('/project');

    expect(info.node!.required).toBeNull();
    expect(info.node!.active).toBe('v20.10.0');
    expect(info.node!.mismatch).toBe(false);
  });
});
