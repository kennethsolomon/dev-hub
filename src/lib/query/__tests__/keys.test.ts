import { describe, it, expect } from 'vitest';
import { queryKeys } from '../keys';

describe('queryKeys', () => {
  it('projects key is a stable array', () => {
    expect(queryKeys.projects).toEqual(['projects']);
  });

  it('project(id) returns scoped key', () => {
    expect(queryKeys.project('abc-123')).toEqual(['projects', 'abc-123']);
  });

  it('projectEnv(id) returns env-scoped key', () => {
    expect(queryKeys.projectEnv('abc-123')).toEqual(['projects', 'abc-123', 'env']);
  });

  it('preflight(id) returns preflight-scoped key', () => {
    expect(queryKeys.preflight('abc-123')).toEqual(['projects', 'abc-123', 'preflight']);
  });

  it('status key is a stable array', () => {
    expect(queryKeys.status).toEqual(['status']);
  });

  it('settings key is a stable array', () => {
    expect(queryKeys.settings).toEqual(['settings']);
  });

  it('auth key is a stable array', () => {
    expect(queryKeys.auth).toEqual(['auth']);
  });

  it('stacks key is a stable array', () => {
    expect(queryKeys.stacks).toEqual(['stacks']);
  });

  it('project keys are hierarchical (startsWith projects)', () => {
    const projectKey = queryKeys.project('x');
    const envKey = queryKeys.projectEnv('x');
    const preflightKey = queryKeys.preflight('x');

    // All project-scoped keys start with 'projects'
    expect(projectKey[0]).toBe('projects');
    expect(envKey[0]).toBe('projects');
    expect(preflightKey[0]).toBe('projects');
  });

  it('different project IDs produce different keys', () => {
    const key1 = queryKeys.project('a');
    const key2 = queryKeys.project('b');
    expect(key1).not.toEqual(key2);
  });
});
