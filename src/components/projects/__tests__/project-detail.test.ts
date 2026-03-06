import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../project-detail.tsx'),
  'utf-8'
);

describe('ProjectDetail hooks ordering', () => {
  it('should call all hooks before any early return', () => {
    const fnStart = SOURCE.indexOf('export function ProjectDetail');
    expect(fnStart).toBeGreaterThan(-1);

    const afterFnStart = SOURCE.slice(fnStart);
    const firstEarlyReturn = afterFnStart.search(/if\s*\(.*\)\s*return\s*\(/);
    expect(firstEarlyReturn).toBeGreaterThan(-1);

    const beforeEarlyReturn = afterFnStart.slice(0, firstEarlyReturn);

    // useMemo must appear before the first early return
    expect(beforeEarlyReturn).toContain('useMemo');
  });

  it('should not have any hook calls after early returns', () => {
    const fnStart = SOURCE.indexOf('export function ProjectDetail');
    const afterFnStart = SOURCE.slice(fnStart);

    // Find the last early return (error/!data check)
    const errorReturn = afterFnStart.indexOf("if (error || !data) return");
    expect(errorReturn).toBeGreaterThan(-1);

    // Get code after the error early return up to the component's return JSX
    const afterErrorReturn = afterFnStart.slice(errorReturn);
    const mainReturn = afterErrorReturn.indexOf('\n  return (');
    const betweenReturns = afterErrorReturn.slice(0, mainReturn);

    // No React hooks should be called between the last early return and the main return
    const hookPattern = /\buse(State|Effect|Memo|Callback|Ref|Context)\s*\(/;
    expect(betweenReturns).not.toMatch(hookPattern);
  });
});
