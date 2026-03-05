import { ChildProcess, spawn } from 'child_process';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb, Service, Run } from '../db';
import { getOsAdapter } from '../os/adapter';
import { findFreePort, persistAssignedPort } from './port-allocator';
import { EventEmitter } from 'events';

export interface ServiceProcess {
  serviceId: string;
  runId: string;
  process: ChildProcess | null; // null for rehydrated processes
  logPath: string;
  assignedPort: number | null;
  pid: number | null; // track PID separately for rehydrated processes
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 = just check if process exists
    return true;
  } catch {
    return false;
  }
}

class ProcessManager extends EventEmitter {
  private running = new Map<string, ServiceProcess>();
  private rehydrated = false;

  constructor() {
    super();
    // Prevent ERR_UNHANDLED_ERROR crashes
    this.on('error', (serviceId, err) => {
      console.error(`[DevHub] Process error for service ${serviceId}:`, err?.message || err);
    });
  }

  /**
   * Rehydrate running processes from the database.
   * Checks if PIDs from 'running' DB records are still alive and re-tracks them.
   */
  rehydrateFromDb(): void {
    if (this.rehydrated) return;
    this.rehydrated = true;

    try {
      const db = getDb();
      const runningRuns = db.prepare(
        "SELECT r.*, s.assigned_port as svc_port FROM runs r JOIN services s ON s.id = r.service_id WHERE r.status = 'running'"
      ).all() as Array<Run & { svc_port: number | null }>;

      for (const run of runningRuns) {
        // Skip if already tracked
        if (this.running.has(run.service_id)) continue;

        if (run.pid && isProcessAlive(run.pid)) {
          // Process is still alive — re-track it
          console.log(`[DevHub] Rehydrating service ${run.service_id} (PID ${run.pid}, port ${run.assigned_port})`);
          this.running.set(run.service_id, {
            serviceId: run.service_id,
            runId: run.id,
            process: null, // we don't have the ChildProcess handle
            logPath: run.log_path || '',
            assignedPort: run.assigned_port,
            pid: run.pid,
          });
        } else {
          // Process is dead — mark run as failed
          console.log(`[DevHub] Marking stale run ${run.id} as failed (PID ${run.pid} not alive)`);
          db.prepare(
            "UPDATE runs SET status = 'failed', stopped_at = datetime('now') WHERE id = ?"
          ).run(run.id);
        }
      }
    } catch (err) {
      console.error('[DevHub] Rehydration error:', err);
    }
  }

  getRunning(serviceId: string): ServiceProcess | undefined {
    return this.running.get(serviceId);
  }

  getAllRunning(): ServiceProcess[] {
    return Array.from(this.running.values());
  }

  isRunning(serviceId: string): boolean {
    const sp = this.running.get(serviceId);
    if (!sp) return false;

    // For rehydrated processes, verify the PID is still alive
    const pid = sp.pid || sp.process?.pid;
    if (pid && !isProcessAlive(pid)) {
      // Process died — clean up
      this.running.delete(serviceId);
      const db = getDb();
      db.prepare(
        "UPDATE runs SET status = 'failed', stopped_at = datetime('now') WHERE id = ?"
      ).run(sp.runId);
      return false;
    }

    return true;
  }

  async startService(serviceId: string): Promise<{
    runId: string;
    assignedPort: number | null;
    portConflict?: { original: number; assigned: number };
  }> {
    if (this.isRunning(serviceId)) {
      throw new Error(`Service ${serviceId} is already running`);
    }

    const db = getDb();
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId) as Service | undefined;
    if (!service) throw new Error(`Service ${serviceId} not found`);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(service.project_id) as any;
    if (!project) throw new Error(`Project not found for service ${serviceId}`);

    // Port allocation
    let assignedPort: number | null = null;
    let portConflict: { original: number; assigned: number } | undefined;

    if (service.desired_port !== null || service.command.includes('$PORT')) {
      const result = await findFreePort(service.desired_port);
      assignedPort = result.port;
      persistAssignedPort(serviceId, assignedPort);

      if (result.wasConflict && result.originalPort) {
        portConflict = { original: result.originalPort, assigned: assignedPort };
      }
    }

    // Prepare log file
    const logDir = path.join(process.env.DEVHUB_ROOT || process.cwd(), 'data', 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const runId = uuid();
    const logPath = path.join(logDir, `${runId}.log`);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    // Prepare command with port substitution
    let command = service.command;
    if (assignedPort !== null) {
      command = command.replace(/\$PORT/g, String(assignedPort));
    }

    // Parse env
    const envOverrides = JSON.parse(service.env_json || '{}');
    const dbOverrides = db.prepare(
      'SELECT key, value FROM env_overrides WHERE project_id = ? AND (service_id = ? OR service_id IS NULL)'
    ).all(service.project_id, serviceId) as Array<{ key: string; value: string }>;

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...envOverrides,
      ...Object.fromEntries(dbOverrides.map(o => [o.key, o.value])),
    };
    if (assignedPort !== null) {
      env.PORT = String(assignedPort);
    }

    // Determine working directory
    const cwd = service.cwd ? path.resolve(project.path, service.cwd) : project.path;

    // Validate cwd exists
    if (!fs.existsSync(cwd)) {
      logStream.end();
      throw new Error(`Working directory does not exist: ${cwd}`);
    }

    // Spawn using OS adapter shell wrapping
    const os = getOsAdapter();
    const [shell, ...shellArgs] = os.wrapCommand(command);

    let child: ChildProcess;
    try {
      child = spawn(shell, shellArgs, {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true, // survive parent process restarts
      });
      // Unref so DevHub can exit without waiting for the child
      child.unref();
    } catch (spawnErr: any) {
      logStream.end();
      throw new Error(`Failed to spawn process: ${spawnErr.message}`);
    }

    // Handle spawn errors (e.g. ENOENT)
    child.on('error', (err) => {
      logStream.write(`[${new Date().toISOString()}] [error] Spawn error: ${err.message}\n`);
      logStream.end();
      this.running.delete(serviceId);
      db.prepare(`
        UPDATE runs SET status = 'failed', stopped_at = datetime('now')
        WHERE id = ?
      `).run(runId);
      this.emit('error', serviceId, err);
    });

    // Write logs
    const writeLog = (data: Buffer, stream: 'stdout' | 'stderr') => {
      const line = data.toString();
      const timestamp = new Date().toISOString();
      const formatted = `[${timestamp}] [${stream}] ${line}`;
      logStream.write(formatted);
      this.emit('log', serviceId, runId, { timestamp, stream, text: line });
    };

    child.stdout?.on('data', (data) => writeLog(data, 'stdout'));
    child.stderr?.on('data', (data) => writeLog(data, 'stderr'));

    // Create run record
    db.prepare(`
      INSERT INTO runs (id, service_id, status, pid, assigned_port, started_at, log_path)
      VALUES (?, ?, 'running', ?, ?, datetime('now'), ?)
    `).run(runId, serviceId, child.pid ?? null, assignedPort, logPath);

    const sp: ServiceProcess = {
      serviceId,
      runId,
      process: child,
      logPath,
      assignedPort,
      pid: child.pid ?? null,
    };
    this.running.set(serviceId, sp);

    child.on('exit', (code, signal) => {
      logStream.end();
      this.running.delete(serviceId);

      db.prepare(`
        UPDATE runs SET status = ?, exit_code = ?, stopped_at = datetime('now')
        WHERE id = ?
      `).run(code === 0 ? 'stopped' : 'failed', code, runId);

      this.emit('exit', serviceId, runId, { code, signal });

      // Restart policy
      if (service.restart_policy === 'always' || (service.restart_policy === 'on-failure' && code !== 0)) {
        setTimeout(() => this.startService(serviceId).catch(err => {
          console.error(`[DevHub] Auto-restart failed for service ${serviceId}:`, err?.message || err);
        }), 2000);
      }
    });

    return { runId, assignedPort, portConflict };
  }

  async stopService(serviceId: string): Promise<void> {
    const sp = this.running.get(serviceId);
    if (!sp) return;

    const db = getDb();
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId) as Service | undefined;
    const stopSignal = (service?.stop_signal || 'SIGINT') as NodeJS.Signals;
    const stopTimeout = service?.stop_timeout || 10000;
    const os = getOsAdapter();

    const pid = sp.pid || sp.process?.pid;

    if (pid) {
      if (sp.process) {
        // We have the ChildProcess handle — use graceful shutdown with escalation
        os.killProcess(pid, stopSignal);

        await new Promise<void>((resolve) => {
          let resolved = false;
          const done = () => { if (!resolved) { resolved = true; resolve(); } };

          const escalationTimer = setTimeout(() => {
            os.killProcess(pid, 'SIGTERM');
            const killTimer = setTimeout(() => {
              if (this.running.has(serviceId)) {
                os.killProcess(pid, 'SIGKILL');
              }
              done();
            }, 3000);
            killTimer.unref();
          }, stopTimeout);

          sp.process!.once('exit', () => {
            clearTimeout(escalationTimer);
            done();
          });
        });
      } else {
        // Rehydrated process — no ChildProcess handle, kill by PID
        try {
          // Send to the process group (negative PID) since we spawn with detached: true
          process.kill(-pid, stopSignal);
        } catch {
          try { process.kill(pid, stopSignal); } catch {}
        }
        // Wait for the process to exit, with escalation timeout
        await new Promise<void>((resolve) => {
          let resolved = false;
          const done = () => { if (!resolved) { resolved = true; resolve(); } };

          const pollInterval = setInterval(() => {
            if (!isProcessAlive(pid)) {
              clearInterval(pollInterval);
              done();
            }
          }, 500);

          // Escalate after timeout
          setTimeout(() => {
            clearInterval(pollInterval);
            if (isProcessAlive(pid)) {
              try { process.kill(-pid, 'SIGKILL'); } catch {}
              try { process.kill(pid, 'SIGKILL'); } catch {}
            }
            done();
          }, stopTimeout + 3000);
        });
      }
    }

    // Update DB
    db.prepare(
      "UPDATE runs SET status = 'stopped', stopped_at = datetime('now') WHERE id = ?"
    ).run(sp.runId);

    this.running.delete(serviceId);
  }

  async startProject(projectId: string): Promise<Array<{
    serviceId: string;
    runId: string;
    assignedPort: number | null;
    portConflict?: { original: number; assigned: number };
  }>> {
    const db = getDb();
    const services = db.prepare(
      'SELECT * FROM services WHERE project_id = ? ORDER BY is_primary DESC'
    ).all(projectId) as Service[];

    // Topological sort based on dependsOn
    const sorted = topologicalSort(services);
    const results = [];

    for (const svc of sorted) {
      if (this.isRunning(svc.id)) continue;
      try {
        const result = await this.startService(svc.id);
        results.push({ serviceId: svc.id, ...result });
      } catch (err: any) {
        console.error(`[DevHub] Failed to start service "${svc.name}":`, err?.message || err);
        results.push({
          serviceId: svc.id,
          runId: '',
          assignedPort: null,
          error: err?.message || 'Failed to start service',
        });
      }
    }

    return results;
  }

  async stopProject(projectId: string): Promise<void> {
    const db = getDb();
    const services = db.prepare('SELECT id FROM services WHERE project_id = ?').all(projectId) as Array<{ id: string }>;

    await Promise.all(services.map(s => this.stopService(s.id)));
  }
}

function topologicalSort(services: Service[]): Service[] {
  const byId = new Map(services.map(s => [s.id, s]));
  const byName = new Map(services.map(s => [s.name, s]));
  const visited = new Set<string>();
  const result: Service[] = [];

  function visit(svc: Service) {
    if (visited.has(svc.id)) return;
    visited.add(svc.id);

    const deps: string[] = JSON.parse(svc.depends_on_json || '[]');
    for (const dep of deps) {
      const depSvc = byName.get(dep) || byId.get(dep);
      if (depSvc) visit(depSvc);
    }
    result.push(svc);
  }

  for (const svc of services) visit(svc);
  return result;
}

// Singleton — use globalThis to survive Next.js HMR in dev mode
const globalForPM = globalThis as unknown as { __devhub_pm?: ProcessManager };

export function getProcessManager(): ProcessManager {
  if (!globalForPM.__devhub_pm) {
    const pm = new ProcessManager();
    globalForPM.__devhub_pm = pm;
    // Rehydrate running processes from DB on first creation
    pm.rehydrateFromDb();
  }
  return globalForPM.__devhub_pm;
}
