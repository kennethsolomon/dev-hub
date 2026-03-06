import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { EventEmitter } from 'events';
import { getDb, Project, Service } from '../db';
import { getProcessManager } from './manager';
import { getOsAdapter } from '../os/adapter';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'vendor',
  '.turbo', '__pycache__', '.cache', 'coverage', '.output',
  '.nuxt', '.svelte-kit', '.DS_Store',
]);

const IGNORE_EXTENSIONS = new Set(['.log']);

function shouldIgnore(filePath: string): boolean {
  const parts = filePath.split(path.sep);
  for (const part of parts) {
    if (IGNORE_DIRS.has(part)) return true;
    if (part.startsWith('.env')) return true;
  }
  const ext = path.extname(filePath);
  if (IGNORE_EXTENSIONS.has(ext)) return true;
  return false;
}

function execAsync(command: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  const os = getOsAdapter();
  const [shell, ...args] = os.wrapCommand(command);
  const fullCommand = [shell, ...args.map(a => `'${a}'`)].join(' ');

  return new Promise((resolve, reject) => {
    exec(fullCommand, { cwd, timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

interface WatcherEntry {
  watcher: fs.FSWatcher;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  building: boolean;
}

export type BuildPhase = 'change-detected' | 'building' | 'restarting' | 'complete' | 'error';

class FileWatcherManager extends EventEmitter {
  private watchers = new Map<string, WatcherEntry>();

  constructor() {
    super();
    this.on('error', () => {}); // prevent ERR_UNHANDLED_ERROR
  }

  isWatching(projectId: string): boolean {
    return this.watchers.has(projectId);
  }

  startWatching(projectId: string): void {
    if (this.watchers.has(projectId)) return;

    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Project | undefined;
    if (!project) return;
    if (!fs.existsSync(project.path)) return;

    const debounceMs = project.watch_debounce_ms || 2000;

    const watcher = fs.watch(project.path, { recursive: true }, (eventType, filename) => {
      if (!filename || shouldIgnore(filename)) return;

      const entry = this.watchers.get(projectId);
      if (!entry || entry.building) return;

      // Reset debounce timer
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
      entry.debounceTimer = setTimeout(() => {
        this.triggerBuildRestart(projectId);
      }, debounceMs);
    });

    watcher.on('error', (err) => {
      console.error(`[DevHub] File watcher error for project ${projectId}:`, err.message);
      this.stopWatching(projectId);
    });

    this.watchers.set(projectId, { watcher, debounceTimer: null, building: false });
    console.log(`[DevHub] File watcher started for project ${projectId}`);
  }

  stopWatching(projectId: string): void {
    const entry = this.watchers.get(projectId);
    if (!entry) return;

    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.watcher.close();
    this.watchers.delete(projectId);
    console.log(`[DevHub] File watcher stopped for project ${projectId}`);
  }

  async triggerBuildRestart(projectId: string): Promise<string[]> {
    const entry = this.watchers.get(projectId);
    if (entry) entry.building = true;

    const restarted: string[] = [];

    try {
      const db = getDb();
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Project | undefined;
      if (!project) return restarted;

      const services = db.prepare(
        'SELECT * FROM services WHERE project_id = ? AND restart_on_watch = 1'
      ).all(projectId) as Service[];

      const pm = getProcessManager();
      const runningServices = services.filter(s => pm.isRunning(s.id));

      if (runningServices.length === 0) return restarted;

      this.emit('build-status', projectId, 'change-detected' as BuildPhase);

      for (const service of runningServices) {
        const buildCmd = service.watch_build_command || project.build_command;

        if (buildCmd) {
          this.emit('build-status', projectId, 'building' as BuildPhase, service.name);
          try {
            const cwd = service.cwd ? path.resolve(project.path, service.cwd) : project.path;
            await execAsync(buildCmd, cwd);
          } catch (err: any) {
            console.error(`[DevHub] Build failed for service ${service.name}:`, err.message);
            this.emit('build-status', projectId, 'error' as BuildPhase, service.name, err.message);
            continue; // skip restart for this service
          }
        }

        this.emit('build-status', projectId, 'restarting' as BuildPhase, service.name);
        try {
          await pm.stopService(service.id);
          await pm.startService(service.id);
          restarted.push(service.name);
        } catch (err: any) {
          console.error(`[DevHub] Restart failed for service ${service.name}:`, err.message);
          this.emit('build-status', projectId, 'error' as BuildPhase, service.name, err.message);
        }
      }

      this.emit('build-status', projectId, 'complete' as BuildPhase, undefined, undefined, restarted);
    } finally {
      if (entry) entry.building = false;
    }

    return restarted;
  }

  rehydrate(): void {
    try {
      const db = getDb();
      const projects = db.prepare(
        'SELECT * FROM projects WHERE auto_build_enabled = 1'
      ).all() as Project[];

      const pm = getProcessManager();

      for (const project of projects) {
        const services = db.prepare(
          'SELECT id FROM services WHERE project_id = ?'
        ).all(project.id) as Array<{ id: string }>;

        const hasRunning = services.some(s => pm.isRunning(s.id));
        if (hasRunning) {
          this.startWatching(project.id);
        }
      }
    } catch (err) {
      console.error('[DevHub] File watcher rehydration error:', err);
    }
  }

  stopAll(): void {
    for (const projectId of this.watchers.keys()) {
      this.stopWatching(projectId);
    }
  }
}

// Singleton on globalThis
const globalForFW = globalThis as unknown as { __devhub_fw?: FileWatcherManager };

export function getFileWatcherManager(): FileWatcherManager {
  if (!globalForFW.__devhub_fw) {
    globalForFW.__devhub_fw = new FileWatcherManager();
  }
  return globalForFW.__devhub_fw;
}
