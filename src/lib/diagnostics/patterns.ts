export interface ErrorPattern {
  id: string;
  regex: RegExp;
  title: string;
  description: string;
  steps: string[];
  quickfix?: {
    label: string;
    action: string;
    args?: Record<string, string>;
  };
}

export const ERROR_PATTERNS: ErrorPattern[] = [
  {
    id: 'native-module-mismatch',
    regex: /NODE_MODULE_VERSION \d+.*(?:requires|needs).*NODE_MODULE_VERSION \d+/i,
    title: 'Native Module Version Mismatch',
    description:
      'A native Node.js module was compiled against a different Node.js version than the one currently running.',
    steps: [
      'Stop the service if running.',
      'Run `npm rebuild` in the project directory to recompile native modules.',
      'If that fails, delete node_modules and reinstall: `rm -rf node_modules && npm install`.',
      'Restart the service.',
    ],
    quickfix: {
      label: 'Rebuild Native Modules',
      action: 'rebuild-native-modules',
    },
  },
  {
    id: 'module-not-found',
    regex: /Cannot find module ['"]([^'"]+)['"]/,
    title: 'Module Not Found',
    description: 'A required module could not be found. Dependencies may need to be installed.',
    steps: [
      'Run `npm install` to install missing dependencies.',
      'If the module is a local file, check that the path is correct.',
      'Restart the service after installing.',
    ],
    quickfix: {
      label: 'Install Dependencies',
      action: 'install-deps',
    },
  },
  {
    id: 'port-in-use',
    regex: /EADDRINUSE[^]*?(?:port\s*[:=]?\s*(\d+)|:(\d+))/i,
    title: 'Port Already In Use',
    description: 'The requested port is already occupied by another process.',
    steps: [
      'Check which process is using the port with `lsof -i :<port>`.',
      'Stop the conflicting process, or change this service to use a different port.',
      'Restart the service.',
    ],
  },
  {
    id: 'permission-denied',
    regex: /EACCES[^]*?permission denied/i,
    title: 'Permission Denied',
    description: 'The process does not have permission to access a file or resource.',
    steps: [
      'Check file ownership and permissions with `ls -la <path>`.',
      'Fix permissions with `chmod` or `chown` as needed.',
      'Avoid running with `sudo` — fix the underlying permission issue instead.',
    ],
  },
  {
    id: 'command-not-found',
    regex: /(?:command not found|not found):\s*(\S+)/i,
    title: 'Command Not Found',
    description:
      'A required command-line tool is not installed or not available in the shell PATH.',
    steps: [
      'Verify the tool is installed: `which <command>`.',
      'If using nvm/fnm, ensure your shell profile loads it (DevHub uses `zsh -lc` to wrap commands).',
      'Install the missing tool if needed.',
      'Restart the service.',
    ],
  },
];

export function matchErrorPatterns(text: string): ErrorPattern[] {
  return ERROR_PATTERNS.filter((pattern) => pattern.regex.test(text));
}
