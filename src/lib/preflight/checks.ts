import fs from 'fs';
import path from 'path';
import { getDb, Service, Project } from '../db';
import { getOsAdapter } from '../os/adapter';
import { getToolchainDetector } from '../toolchain/detector';

export interface PreflightResult {
  check: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  quickFix?: { label: string; action: string; args?: any };
}

export async function runPreflightChecks(projectId: string): Promise<PreflightResult[]> {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Project | undefined;
  if (!project) return [{ check: 'project', status: 'fail', message: 'Project not found' }];

  const services = db.prepare('SELECT * FROM services WHERE project_id = ?').all(projectId) as Service[];
  const results: PreflightResult[] = [];

  // 1. Check project path exists
  if (!fs.existsSync(project.path)) {
    results.push({ check: 'path', status: 'fail', message: `Project path does not exist: ${project.path}` });
    return results;
  }
  results.push({ check: 'path', status: 'pass', message: 'Project path exists' });

  // 2. Check .env file
  const envPath = path.join(project.path, '.env');
  const envExamplePath = path.join(project.path, '.env.example');
  if (fs.existsSync(envExamplePath) && !fs.existsSync(envPath)) {
    results.push({
      check: 'env',
      status: 'fail',
      message: '.env file missing (but .env.example exists)',
      quickFix: { label: 'Copy .env.example to .env', action: 'copy-env', args: { projectId } },
    });
  } else if (fs.existsSync(envPath)) {
    results.push({ check: 'env', status: 'pass', message: '.env file present' });
  }

  // 3. Check dependencies
  if (['node', 'expo'].includes(project.type)) {
    const nodeModules = path.join(project.path, 'node_modules');
    if (!fs.existsSync(nodeModules)) {
      results.push({
        check: 'deps',
        status: 'fail',
        message: 'node_modules not found',
        quickFix: { label: 'Run npm install', action: 'install-deps', args: { projectId } },
      });
    } else {
      results.push({ check: 'deps', status: 'pass', message: 'node_modules present' });
    }
  }

  if (project.type === 'laravel') {
    const vendor = path.join(project.path, 'vendor');
    if (!fs.existsSync(vendor)) {
      results.push({
        check: 'deps',
        status: 'fail',
        message: 'vendor directory not found',
        quickFix: { label: 'Run composer install', action: 'install-deps', args: { projectId } },
      });
    } else {
      results.push({ check: 'deps', status: 'pass', message: 'vendor directory present' });
    }
  }

  // 4. Check toolchain
  try {
    const detector = getToolchainDetector();
    const info = await detector.detect(project.path);

    if (info.node?.mismatch) {
      results.push({
        check: 'toolchain-node',
        status: 'warn',
        message: `Node version mismatch: required ${info.node.required}, active ${info.node.active}`,
      });
    } else if (info.node?.active) {
      results.push({ check: 'toolchain-node', status: 'pass', message: `Node ${info.node.active}` });
    }

    if (info.php?.mismatch) {
      results.push({
        check: 'toolchain-php',
        status: 'warn',
        message: `PHP version mismatch: required ${info.php.required}, active ${info.php.active}`,
      });
    } else if (info.php?.active) {
      results.push({ check: 'toolchain-php', status: 'pass', message: `PHP ${info.php.active}` });
    }
  } catch {}

  // 5. Check port conflicts for services
  const os = getOsAdapter();
  for (const svc of services) {
    if (svc.desired_port) {
      const inUse = await os.isPortInUse(svc.desired_port);
      if (inUse) {
        const proc = await os.findProcessOnPort(svc.desired_port);
        results.push({
          check: `port-${svc.name}`,
          status: 'warn',
          message: `Port ${svc.desired_port} for "${svc.name}" is in use${proc ? ` by ${proc.name} (PID ${proc.pid})` : ''}`,
        });
      } else {
        results.push({ check: `port-${svc.name}`, status: 'pass', message: `Port ${svc.desired_port} is available` });
      }
    }
  }

  // 6. Check required env keys
  const envDefs = db.prepare(
    'SELECT * FROM env_definitions WHERE project_id = ? AND required = 1'
  ).all(projectId) as any[];

  if (envDefs.length > 0 && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envKeys = new Set(
      envContent.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => l.split('=')[0].trim())
    );

    for (const def of envDefs) {
      if (!envKeys.has(def.key)) {
        results.push({
          check: `env-key-${def.key}`,
          status: 'fail',
          message: `Required env key "${def.key}" is missing`,
        });
      }
    }
  }

  return results;
}
