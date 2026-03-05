import { describe, it, expect, vi } from 'vitest';
import { detectProjectType } from '../scanner';
import fs from 'fs';

vi.mock('fs');

describe('Project Type Detection', () => {
  it('should detect Laravel project', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      'artisan', 'composer.json', 'app', 'routes',
    ] as any);

    expect(detectProjectType('/test/laravel-app')).toBe('laravel');
  });

  it('should detect Node project', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      'package.json', 'src', 'node_modules',
    ] as any);

    expect(detectProjectType('/test/node-app')).toBe('node');
  });

  it('should detect Expo project', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      'package.json', 'app.json',
    ] as any);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      dependencies: { expo: '~49.0.0' },
    }));

    expect(detectProjectType('/test/expo-app')).toBe('expo');
  });

  it('should return null for non-project directories', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      'random-file.txt', 'another-dir',
    ] as any);

    expect(detectProjectType('/test/random')).toBeNull();
  });
});
