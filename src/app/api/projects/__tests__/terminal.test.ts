import { describe, it, expect } from 'vitest';
import { shellEscape } from '../[id]/terminal/route';

describe('shellEscape', () => {
  it('wraps a simple command in single quotes', () => {
    expect(shellEscape('ls -la')).toBe("'ls -la'");
  });

  it('escapes single quotes in commands', () => {
    expect(shellEscape("echo 'hello'")).toBe("'echo '\\''hello'\\'''");
  });

  it('handles commands with double quotes', () => {
    expect(shellEscape('echo "hello world"')).toBe("'echo \"hello world\"'");
  });

  it('handles commands with special characters', () => {
    expect(shellEscape('ls && rm -rf /')).toBe("'ls && rm -rf /'");
  });

  it('handles commands with dollar signs', () => {
    expect(shellEscape('echo $HOME')).toBe("'echo $HOME'");
  });

  it('handles empty string', () => {
    expect(shellEscape('')).toBe("''");
  });

  it('handles commands with backticks', () => {
    expect(shellEscape('echo `whoami`')).toBe("'echo `whoami`'");
  });

  it('handles commands with semicolons', () => {
    expect(shellEscape('echo a; echo b')).toBe("'echo a; echo b'");
  });
});
