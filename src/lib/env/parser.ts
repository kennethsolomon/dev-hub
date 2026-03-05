import fs from 'fs';
import path from 'path';

export interface EnvEntry {
  key: string;
  value: string;
  source: string; // filename e.g. ".env", ".env.local"
}

const ENV_FILES = ['.env', '.env.local', '.env.development'];

/**
 * Parse all .env files from a project directory.
 * Later files override earlier ones (same key).
 */
export function parseEnvFiles(projectPath: string): {
  files: string[];
  entries: EnvEntry[];
} {
  const foundFiles: string[] = [];
  const envMap = new Map<string, EnvEntry>();

  for (const filename of ENV_FILES) {
    const filePath = path.join(projectPath, filename);
    if (!fs.existsSync(filePath)) continue;

    foundFiles.push(filename);
    const content = fs.readFileSync(filePath, 'utf-8');

    for (const { key, value } of parseDotenv(content)) {
      envMap.set(key, { key, value, source: filename });
    }
  }

  return {
    files: foundFiles,
    entries: Array.from(envMap.values()),
  };
}

/**
 * Parse a single .env file content into key-value pairs.
 * Handles comments, empty lines, quoted values, and `export` prefix.
 */
function parseDotenv(content: string): Array<{ key: string; value: string }> {
  const result: Array<{ key: string; value: string }> = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Strip optional `export ` prefix
    const stripped = trimmed.startsWith('export ')
      ? trimmed.slice(7).trim()
      : trimmed;

    const eqIndex = stripped.indexOf('=');
    if (eqIndex === -1) continue;

    const key = stripped.slice(0, eqIndex).trim();
    let value = stripped.slice(eqIndex + 1).trim();

    // Remove surrounding quotes (must be matching pair, length > 1)
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
       (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      result.push({ key, value });
    }
  }

  return result;
}

const PORT_KEY_PATTERN = /port/i;
const SECRET_KEY_PATTERN = /(secret|key|token|password|private|credential)/i;

/**
 * Detect if a variable is a port based on key name or numeric value in common port ranges.
 * Key match: any key containing "port" (case-insensitive).
 * Value match: integer 1000-9999 (common dev ports) — higher ranges only with key match
 * to avoid false positives like TIMEOUT_MS=30000.
 */
export function isPortVar(key: string, value: string): boolean {
  if (PORT_KEY_PATTERN.test(key)) return true;
  const num = Number(value);
  if (!Number.isInteger(num)) return false;
  return num >= 1000 && num <= 9999;
}

/**
 * Detect if a variable is a secret based on key name.
 */
export function isSecretVar(key: string): boolean {
  // Don't treat PORT keys as secrets even if they match (e.g., "DB_PORT")
  if (PORT_KEY_PATTERN.test(key)) return false;
  return SECRET_KEY_PATTERN.test(key);
}
