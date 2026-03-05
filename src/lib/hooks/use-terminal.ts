'use client';

import { useState, useCallback } from 'react';
import { TerminalEntry } from '@/components/terminal/project-terminal';

export function useTerminal(projectId: string) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [runningCommand, setRunningCommand] = useState('');

  const runCommand = useCallback(async (command: string) => {
    setRunning(true);
    setRunningCommand(command);
    try {
      const res = await fetch(`/api/projects/${projectId}/terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      if (res.ok) {
        setEntries((prev) => [...prev, { command, output: data.output || '', exitCode: data.exitCode }]);
      } else {
        setEntries((prev) => [...prev, { command, output: data.error || 'Request failed', exitCode: 1 }]);
      }
    } catch {
      setEntries((prev) => [...prev, { command, output: 'Network error — could not reach the server.', exitCode: 1 }]);
    } finally {
      setRunning(false);
      setRunningCommand('');
    }
  }, [projectId]);

  return { entries, setEntries, running, runningCommand, runCommand };
}
