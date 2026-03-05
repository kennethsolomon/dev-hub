import { getOsAdapter } from '../os/adapter';
import { getDb } from '../db';

const MIN_AUTO_PORT = 10000;
const MAX_AUTO_PORT = 65000;

export async function findFreePort(desired?: number | null): Promise<{
  port: number;
  wasConflict: boolean;
  originalPort?: number;
}> {
  const os = getOsAdapter();

  if (desired && desired > 0) {
    const inUse = await os.isPortInUse(desired);
    if (!inUse) {
      return { port: desired, wasConflict: false };
    }
    // Desired port is busy, find a free one
    const freePort = await pickRandomFreePort(os);
    return { port: freePort, wasConflict: true, originalPort: desired };
  }

  // Auto-assign
  const freePort = await pickRandomFreePort(os);
  return { port: freePort, wasConflict: false };
}

async function pickRandomFreePort(os: ReturnType<typeof getOsAdapter>): Promise<number> {
  // Try up to 50 times to find a free port
  for (let i = 0; i < 50; i++) {
    const port = MIN_AUTO_PORT + Math.floor(Math.random() * (MAX_AUTO_PORT - MIN_AUTO_PORT));

    // Check not already assigned to another service in this session
    const db = getDb();
    const existing = db.prepare(
      'SELECT id FROM services WHERE assigned_port = ?'
    ).get(port);
    if (existing) continue;

    const inUse = await os.isPortInUse(port);
    if (!inUse) return port;
  }
  throw new Error('Could not find a free port after 50 attempts');
}

export function persistAssignedPort(serviceId: string, port: number): void {
  const db = getDb();
  db.prepare(`UPDATE services SET assigned_port = ?, updated_at = datetime('now') WHERE id = ?`).run(port, serviceId);
}

export async function checkPortConflicts(serviceIds: string[]): Promise<
  Array<{ serviceId: string; serviceName: string; desiredPort: number; conflict: boolean; processInfo?: { pid: number; name: string } }>
> {
  const db = getDb();
  const os = getOsAdapter();
  const results = [];

  for (const sid of serviceIds) {
    const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(sid) as any;
    if (!svc || !svc.desired_port) continue;

    const inUse = await os.isPortInUse(svc.desired_port);
    let processInfo;
    if (inUse) {
      processInfo = await os.findProcessOnPort(svc.desired_port) || undefined;
    }
    results.push({
      serviceId: svc.id,
      serviceName: svc.name,
      desiredPort: svc.desired_port,
      conflict: inUse,
      processInfo,
    });
  }
  return results;
}
