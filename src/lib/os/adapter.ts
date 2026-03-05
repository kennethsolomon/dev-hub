// OS adapter layer - macOS first, extensible for cross-platform

export interface OsAdapter {
  platform: 'macos' | 'linux' | 'windows';
  getShell(): string;
  wrapCommand(cmd: string): string[];
  isPortInUse(port: number): Promise<boolean>;
  findProcessOnPort(port: number): Promise<{ pid: number; name: string } | null>;
  killProcess(pid: number, signal?: NodeJS.Signals): void;
}

class MacOsAdapter implements OsAdapter {
  platform = 'macos' as const;

  getShell(): string {
    return process.env.SHELL || '/bin/zsh';
  }

  wrapCommand(cmd: string): string[] {
    return ['/bin/zsh', '-lc', cmd];
  }

  async isPortInUse(port: number): Promise<boolean> {
    const net = require('net');

    // Check both IPv4 and IPv6 — Next.js and many servers bind to :: (IPv6)
    // which won't conflict with a 127.0.0.1 (IPv4-only) test bind
    const checkHost = (host: string): Promise<boolean> =>
      new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') resolve(true);
          else resolve(false);
        });
        server.once('listening', () => {
          server.close();
          resolve(false);
        });
        server.listen(port, host);
      });

    // If either interface reports the port in use, it's in use
    const [ipv4, ipv6] = await Promise.all([
      checkHost('0.0.0.0'),
      checkHost('::'),
    ]);
    return ipv4 || ipv6;
  }

  async findProcessOnPort(port: number): Promise<{ pid: number; name: string } | null> {
    const { execSync } = require('child_process');
    try {
      const output = execSync(`lsof -i :${port} -t`, { encoding: 'utf-8' }).trim();
      if (!output) return null;
      const pid = parseInt(output.split('\n')[0], 10);
      const name = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf-8' }).trim();
      return { pid, name };
    } catch {
      return null;
    }
  }

  killProcess(pid: number, signal: NodeJS.Signals = 'SIGINT'): void {
    try {
      process.kill(pid, signal);
    } catch {
      // process may already be dead
    }
  }
}

const globalForOs = globalThis as unknown as { __devhub_os?: OsAdapter };

export function getOsAdapter(): OsAdapter {
  if (!globalForOs.__devhub_os) {
    globalForOs.__devhub_os = new MacOsAdapter();
  }
  return globalForOs.__devhub_os;
}
