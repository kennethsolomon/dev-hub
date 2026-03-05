import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface ToolchainInfo {
  node?: {
    required: string | null;
    active: string | null;
    source: 'nvmrc' | 'engines' | null;
    mismatch: boolean;
  };
  php?: {
    required: string | null;
    active: string | null;
    source: 'herd' | 'homebrew' | null;
    mismatch: boolean;
  };
}

// Adapter interface for future extension
export interface ToolchainDetector {
  detect(projectPath: string): Promise<ToolchainInfo>;
}

class MacToolchainDetector implements ToolchainDetector {
  async detect(projectPath: string): Promise<ToolchainInfo> {
    const info: ToolchainInfo = {};

    // Node detection
    const nvmrcPath = path.join(projectPath, '.nvmrc');
    const pkgPath = path.join(projectPath, 'package.json');

    let requiredNode: string | null = null;
    let nodeSource: 'nvmrc' | 'engines' | null = null;

    if (fs.existsSync(nvmrcPath)) {
      requiredNode = fs.readFileSync(nvmrcPath, 'utf-8').trim();
      nodeSource = 'nvmrc';
    } else if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.engines?.node) {
          requiredNode = pkg.engines.node;
          nodeSource = 'engines';
        }
      } catch {}
    }

    let activeNode: string | null = null;
    try {
      activeNode = execSync('node --version', { encoding: 'utf-8', timeout: 5000 }).trim();
    } catch {}

    if (requiredNode || activeNode) {
      const mismatch = requiredNode && activeNode
        ? !activeNode.includes(requiredNode.replace(/^v/, '').split('.')[0])
        : false;
      info.node = { required: requiredNode, active: activeNode, source: nodeSource, mismatch };
    }

    // PHP detection (for Laravel projects)
    const composerPath = path.join(projectPath, 'composer.json');
    if (fs.existsSync(composerPath)) {
      let requiredPhp: string | null = null;
      try {
        const composer = JSON.parse(fs.readFileSync(composerPath, 'utf-8'));
        requiredPhp = composer.require?.php || null;
      } catch {}

      let activePhp: string | null = null;
      let phpSource: 'herd' | 'homebrew' | null = null;

      // Check Herd first
      try {
        const herdPhp = execSync('which php', { encoding: 'utf-8', timeout: 5000 }).trim();
        if (herdPhp.includes('Herd')) {
          phpSource = 'herd';
        } else {
          phpSource = 'homebrew';
        }
        activePhp = execSync('php --version', { encoding: 'utf-8', timeout: 5000 }).split('\n')[0];
      } catch {}

      if (requiredPhp || activePhp) {
        info.php = {
          required: requiredPhp,
          active: activePhp,
          source: phpSource,
          mismatch: false, // Simplified for V1
        };
      }
    }

    return info;
  }
}

let _detector: ToolchainDetector | null = null;
export function getToolchainDetector(): ToolchainDetector {
  if (!_detector) _detector = new MacToolchainDetector();
  return _detector;
}
