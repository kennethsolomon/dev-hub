import { describe, it, expect } from 'vitest';
import { matchErrorPatterns, ERROR_PATTERNS } from '../patterns';

describe('matchErrorPatterns', () => {
  it('matches NODE_MODULE_VERSION mismatch', () => {
    const text =
      "The module '/path/to/better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 141.";
    const matches = matchErrorPatterns(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('native-module-mismatch');
  });

  it('matches Cannot find module', () => {
    const text = "Error: Cannot find module 'express'";
    const matches = matchErrorPatterns(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('module-not-found');
  });

  it('matches EADDRINUSE', () => {
    const text = 'Error: listen EADDRINUSE: address already in use :::3000';
    const matches = matchErrorPatterns(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('port-in-use');
  });

  it('matches EACCES permission denied', () => {
    const text = "Error: EACCES: permission denied, open '/etc/hosts'";
    const matches = matchErrorPatterns(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('permission-denied');
  });

  it('matches command not found', () => {
    const text = 'zsh: command not found: node';
    const matches = matchErrorPatterns(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('command-not-found');
  });

  it('returns empty array for non-matching text', () => {
    const text = 'Server started on port 3000';
    const matches = matchErrorPatterns(text);
    expect(matches).toHaveLength(0);
  });

  it('all patterns have required fields', () => {
    for (const pattern of ERROR_PATTERNS) {
      expect(pattern.id).toBeTruthy();
      expect(pattern.regex).toBeInstanceOf(RegExp);
      expect(pattern.title).toBeTruthy();
      expect(pattern.description).toBeTruthy();
      expect(pattern.steps.length).toBeGreaterThan(0);
    }
  });

  it('patterns with quickfix have label and action', () => {
    const withQuickfix = ERROR_PATTERNS.filter((p) => p.quickfix);
    expect(withQuickfix.length).toBeGreaterThan(0);
    for (const pattern of withQuickfix) {
      expect(pattern.quickfix!.label).toBeTruthy();
      expect(pattern.quickfix!.action).toBeTruthy();
    }
  });
});
