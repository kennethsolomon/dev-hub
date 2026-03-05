import { getDb } from '../db';
import { getProcessManager } from '../process/manager';

export interface RouteTarget {
  host: string;
  port: number;
}

export function resolveSubdomain(hostname: string): RouteTarget | null {
  const db = getDb();
  const baseDomain = (db.prepare("SELECT value FROM settings WHERE key = 'base_domain'").get() as any)?.value || 'localhost';

  // Extract subdomain: e.g., "myapp.localhost" -> "myapp"
  const suffix = `.${baseDomain}`;
  if (!hostname.endsWith(suffix) && hostname !== baseDomain) {
    return null;
  }

  // devhub.localhost -> DevHub UI itself
  if (hostname === `devhub${suffix}` || hostname === baseDomain) {
    return null; // Let Next.js handle it
  }

  const subdomain = hostname.slice(0, -suffix.length);
  if (!subdomain) return null;

  // Look up project by slug
  const project = db.prepare('SELECT id FROM projects WHERE slug = ?').get(subdomain) as any;
  if (!project) return null;

  // Find primary service
  const service = db.prepare(
    'SELECT id, assigned_port FROM services WHERE project_id = ? AND is_primary = 1 LIMIT 1'
  ).get(project.id) as any;

  if (!service) return null;

  // Check if actually running and get the real assigned port
  const pm = getProcessManager();
  if (!pm.isRunning(service.id)) return null;

  const actualPort = pm.getRunning(service.id)?.assignedPort || service.assigned_port;
  if (!actualPort) return null;

  return { host: '127.0.0.1', port: actualPort };
}

export function getRoutingTable(): Array<{
  slug: string;
  projectName: string;
  port: number;
  running: boolean;
  url: string;
}> {
  const db = getDb();
  const baseDomain = (db.prepare("SELECT value FROM settings WHERE key = 'base_domain'").get() as any)?.value || 'localhost';
  const subdomainRouting = (db.prepare("SELECT value FROM settings WHERE key = 'subdomain_routing'").get() as any)?.value === 'true';
  const portlessMode = (db.prepare("SELECT value FROM settings WHERE key = 'portless_mode'").get() as any)?.value === 'true';

  const projects = db.prepare(`
    SELECT p.id, p.name, p.slug, s.id as service_id, s.assigned_port
    FROM projects p
    LEFT JOIN services s ON s.project_id = p.id AND s.is_primary = 1
  `).all() as any[];

  const pm = getProcessManager();

  return projects.map(p => {
    const running = p.service_id ? pm.isRunning(p.service_id) : false;

    // Get the actual running port from ProcessManager (more accurate than DB)
    const actualPort = p.service_id
      ? (pm.getRunning(p.service_id)?.assignedPort || p.assigned_port)
      : p.assigned_port;

    // Direct URL always works when running
    const directUrl = actualPort ? `http://localhost:${actualPort}` : '';

    // Subdomain URL only works with portless mode (Caddy proxy)
    let url: string;
    if (subdomainRouting && portlessMode) {
      url = `http://${p.slug}.${baseDomain}`;
    } else {
      url = directUrl;
    }

    return {
      slug: p.slug,
      projectName: p.name,
      port: actualPort || 0,
      running,
      url,
    };
  });
}

export function generateCaddyfile(): string {
  const db = getDb();
  const proxyPort = (db.prepare("SELECT value FROM settings WHERE key = 'proxy_port'").get() as any)?.value || '4400';
  const baseDomain = (db.prepare("SELECT value FROM settings WHERE key = 'base_domain'").get() as any)?.value || 'localhost';

  return `# DevHub Caddyfile - Generated automatically
# This file is used by the portless proxy (Caddy) to route subdomain traffic.

*.${baseDomain}, ${baseDomain} {
  reverse_proxy 127.0.0.1:${proxyPort}
}
`;
}
