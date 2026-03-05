import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseEnvFiles, isPortVar, isSecretVar } from '../parser';
import fs from 'fs';

vi.mock('fs');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('parseEnvFiles', () => {
  it('should parse a basic .env file', () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) =>
      String(p).endsWith('.env') && !String(p).endsWith('.env.local') && !String(p).endsWith('.env.development')
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      'PORT=3000\nDB_HOST=localhost\nAPI_KEY=sk-abc123\n'
    );

    const result = parseEnvFiles('/test/project');
    expect(result.files).toEqual(['.env']);
    expect(result.entries).toHaveLength(3);
    expect(result.entries).toContainEqual({ key: 'PORT', value: '3000', source: '.env' });
    expect(result.entries).toContainEqual({ key: 'DB_HOST', value: 'localhost', source: '.env' });
    expect(result.entries).toContainEqual({ key: 'API_KEY', value: 'sk-abc123', source: '.env' });
  });

  it('should skip comments and empty lines', () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) =>
      String(p).endsWith('.env') && !String(p).endsWith('.env.local') && !String(p).endsWith('.env.development')
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      '# This is a comment\n\nPORT=3000\n# Another comment\nNODE_ENV=dev\n\n'
    );

    const result = parseEnvFiles('/test/project');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].key).toBe('PORT');
    expect(result.entries[1].key).toBe('NODE_ENV');
  });

  it('should handle quoted values', () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) =>
      String(p).endsWith('.env') && !String(p).endsWith('.env.local') && !String(p).endsWith('.env.development')
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      'DOUBLE="hello world"\nSINGLE=\'foo bar\'\nNONE=plain\n'
    );

    const result = parseEnvFiles('/test/project');
    expect(result.entries).toContainEqual({ key: 'DOUBLE', value: 'hello world', source: '.env' });
    expect(result.entries).toContainEqual({ key: 'SINGLE', value: 'foo bar', source: '.env' });
    expect(result.entries).toContainEqual({ key: 'NONE', value: 'plain', source: '.env' });
  });

  it('should handle export prefix', () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) =>
      String(p).endsWith('.env') && !String(p).endsWith('.env.local') && !String(p).endsWith('.env.development')
    );
    vi.mocked(fs.readFileSync).mockReturnValue('export PORT=8080\nexport NODE_ENV=production\n');

    const result = parseEnvFiles('/test/project');
    expect(result.entries).toContainEqual({ key: 'PORT', value: '8080', source: '.env' });
    expect(result.entries).toContainEqual({ key: 'NODE_ENV', value: 'production', source: '.env' });
  });

  it('should override keys from later env files', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p: any) => {
      if (String(p).endsWith('.env.local')) return 'PORT=4000\n';
      if (String(p).endsWith('.env.development')) return 'PORT=5000\nDEBUG=true\n';
      return 'PORT=3000\nNODE_ENV=dev\n';
    });

    const result = parseEnvFiles('/test/project');
    expect(result.files).toEqual(['.env', '.env.local', '.env.development']);

    const portEntry = result.entries.find(e => e.key === 'PORT');
    expect(portEntry?.value).toBe('5000');
    expect(portEntry?.source).toBe('.env.development');

    // NODE_ENV from .env should still be present
    expect(result.entries.find(e => e.key === 'NODE_ENV')).toBeDefined();
    // DEBUG from .env.development should be present
    expect(result.entries.find(e => e.key === 'DEBUG')).toBeDefined();
  });

  it('should return empty when no env files exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = parseEnvFiles('/test/project');
    expect(result.files).toEqual([]);
    expect(result.entries).toEqual([]);
  });

  it('should skip lines without equals sign', () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) =>
      String(p).endsWith('.env') && !String(p).endsWith('.env.local') && !String(p).endsWith('.env.development')
    );
    vi.mocked(fs.readFileSync).mockReturnValue('VALID=yes\nINVALID_LINE\nALSO_VALID=true\n');

    const result = parseEnvFiles('/test/project');
    expect(result.entries).toHaveLength(2);
  });

  it('should handle values with equals signs', () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) =>
      String(p).endsWith('.env') && !String(p).endsWith('.env.local') && !String(p).endsWith('.env.development')
    );
    vi.mocked(fs.readFileSync).mockReturnValue('DATABASE_URL=postgres://user:pass@host/db?opt=val\n');

    const result = parseEnvFiles('/test/project');
    expect(result.entries[0].value).toBe('postgres://user:pass@host/db?opt=val');
  });
});

describe('isPortVar', () => {
  it('should detect port by key name', () => {
    expect(isPortVar('PORT', '3000')).toBe(true);
    expect(isPortVar('DB_PORT', '5432')).toBe(true);
    expect(isPortVar('WEBHOOK_PORT', '9000')).toBe(true);
    expect(isPortVar('port', 'abc')).toBe(true); // key match, value irrelevant
  });

  it('should detect port by numeric value in range', () => {
    expect(isPortVar('SOME_VAR', '8080')).toBe(true);
    expect(isPortVar('MY_SERVICE', '3000')).toBe(true);
    expect(isPortVar('RANDOM', '65535')).toBe(true);
    expect(isPortVar('MIN_PORT_RANGE', '1000')).toBe(true);
  });

  it('should not detect non-port values', () => {
    expect(isPortVar('NODE_ENV', 'production')).toBe(false);
    expect(isPortVar('COUNT', '42')).toBe(false);       // below 1000
    expect(isPortVar('BIG_NUM', '70000')).toBe(false);  // above 65535
    expect(isPortVar('API_URL', 'http://localhost')).toBe(false);
    expect(isPortVar('FLOAT', '3000.5')).toBe(false);   // not integer
  });
});

describe('isSecretVar', () => {
  it('should detect secret keys', () => {
    expect(isSecretVar('API_KEY')).toBe(true);
    expect(isSecretVar('SECRET_KEY')).toBe(true);
    expect(isSecretVar('AUTH_TOKEN')).toBe(true);
    expect(isSecretVar('DB_PASSWORD')).toBe(true);
    expect(isSecretVar('PRIVATE_KEY')).toBe(true);
    expect(isSecretVar('AWS_CREDENTIAL')).toBe(true);
  });

  it('should not flag port keys as secrets', () => {
    expect(isSecretVar('DB_PORT')).toBe(false);
    expect(isSecretVar('WEBHOOK_PORT')).toBe(false);
  });

  it('should not flag normal keys as secrets', () => {
    expect(isSecretVar('NODE_ENV')).toBe(false);
    expect(isSecretVar('DATABASE_URL')).toBe(false);
    expect(isSecretVar('APP_NAME')).toBe(false);
    expect(isSecretVar('DEBUG')).toBe(false);
  });
});
