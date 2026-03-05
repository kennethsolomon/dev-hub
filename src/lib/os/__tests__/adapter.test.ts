import { describe, it, expect, vi, beforeEach } from 'vitest';
import net from 'net';

// Clear the globalThis singleton before each test
beforeEach(() => {
  const g = globalThis as any;
  delete g.__devhub_os;
});

describe('MacOsAdapter', () => {
  it('should return macos platform', async () => {
    const { getOsAdapter } = await import('../adapter');
    const os = getOsAdapter();
    expect(os.platform).toBe('macos');
  });

  it('should return singleton instance', async () => {
    const { getOsAdapter } = await import('../adapter');
    const a = getOsAdapter();
    const b = getOsAdapter();
    expect(a).toBe(b);
  });

  describe('getShell', () => {
    it('should return SHELL env var when set', async () => {
      const { getOsAdapter } = await import('../adapter');
      const os = getOsAdapter();
      const original = process.env.SHELL;
      process.env.SHELL = '/bin/bash';
      expect(os.getShell()).toBe('/bin/bash');
      process.env.SHELL = original;
    });

    it('should default to /bin/zsh when SHELL is not set', async () => {
      const { getOsAdapter } = await import('../adapter');
      const os = getOsAdapter();
      const original = process.env.SHELL;
      delete process.env.SHELL;
      expect(os.getShell()).toBe('/bin/zsh');
      process.env.SHELL = original;
    });
  });

  describe('wrapCommand', () => {
    it('should wrap command with zsh -lc', async () => {
      const { getOsAdapter } = await import('../adapter');
      const os = getOsAdapter();
      expect(os.wrapCommand('npm run dev')).toEqual(['/bin/zsh', '-lc', 'npm run dev']);
    });
  });

  describe('isPortInUse', () => {
    it('should detect a port that is in use (IPv4)', async () => {
      const { getOsAdapter } = await import('../adapter');
      const os = getOsAdapter();

      // Bind a port on IPv4
      const server = net.createServer();
      const port = await new Promise<number>((resolve) => {
        server.listen(0, '0.0.0.0', () => {
          resolve((server.address() as net.AddressInfo).port);
        });
      });

      try {
        const result = await os.isPortInUse(port);
        expect(result).toBe(true);
      } finally {
        server.close();
      }
    });

    it('should detect a port that is in use (IPv6)', async () => {
      const { getOsAdapter } = await import('../adapter');
      const os = getOsAdapter();

      // Bind a port on IPv6
      const server = net.createServer();
      const port = await new Promise<number>((resolve) => {
        server.listen(0, '::', () => {
          resolve((server.address() as net.AddressInfo).port);
        });
      });

      try {
        const result = await os.isPortInUse(port);
        expect(result).toBe(true);
      } finally {
        server.close();
      }
    });

    it('should return false for a free port', async () => {
      const { getOsAdapter } = await import('../adapter');
      const os = getOsAdapter();

      // Find a free port by binding and immediately closing
      const port = await new Promise<number>((resolve) => {
        const server = net.createServer();
        server.listen(0, () => {
          const p = (server.address() as net.AddressInfo).port;
          server.close(() => resolve(p));
        });
      });

      const result = await os.isPortInUse(port);
      expect(result).toBe(false);
    });
  });

  describe('killProcess', () => {
    it('should not throw when killing a non-existent process', async () => {
      const { getOsAdapter } = await import('../adapter');
      const os = getOsAdapter();
      // PID 999999 almost certainly doesn't exist
      expect(() => os.killProcess(999999)).not.toThrow();
    });
  });

  describe('findProcessOnPort', () => {
    it('should return null for an unused port', async () => {
      const { getOsAdapter } = await import('../adapter');
      const os = getOsAdapter();

      // Find a free port
      const port = await new Promise<number>((resolve) => {
        const server = net.createServer();
        server.listen(0, () => {
          const p = (server.address() as net.AddressInfo).port;
          server.close(() => resolve(p));
        });
      });

      const result = await os.findProcessOnPort(port);
      expect(result).toBeNull();
    });
  });
});
