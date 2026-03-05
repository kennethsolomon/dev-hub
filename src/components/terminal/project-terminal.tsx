'use client';

import { useState, useRef, useEffect } from 'react';

interface TerminalEntry {
  command: string;
  output: string;
  exitCode: number;
}

interface ProjectTerminalProps {
  projectId: string;
  projectPath: string;
}

export function ProjectTerminal({ projectId, projectPath }: ProjectTerminalProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [runningCommand, setRunningCommand] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  // Elapsed time counter
  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const runCommand = async () => {
    const command = input.trim();
    if (!command || running) return;

    setInput('');
    setRunning(true);
    setRunningCommand(command);
    setHistoryIndex(-1);

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
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (entries.length === 0) return;
      const newIndex = historyIndex < entries.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      setInput(entries[entries.length - 1 - newIndex].command);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(entries[entries.length - 1 - newIndex].command);
      }
    }
  };

  return (
    <div
      className="rounded-xl border border-border bg-[#08080A] overflow-hidden flex flex-col"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-semibold">Terminal</span>
          <span className="text-xs text-muted-foreground font-mono">{projectPath}</span>
        </div>
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => { e.stopPropagation(); setEntries([]); }}
        >
          Clear
        </button>
      </div>

      {/* Output */}
      <div ref={scrollRef} className="flex-1 min-h-[300px] max-h-[500px] overflow-auto p-4 space-y-3 font-mono text-xs">
        {entries.length === 0 && !running && (
          <p className="text-muted-foreground">Type a command below to run it in the project directory.</p>
        )}

        {entries.map((entry, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-primary">$</span>
              <span className="text-primary">{entry.command}</span>
            </div>
            {entry.output && (
              <pre className={`whitespace-pre-wrap leading-relaxed pl-4 ${entry.exitCode !== 0 ? 'text-red-400' : 'text-foreground/80'}`}>
                {entry.output}
              </pre>
            )}
            {entry.exitCode !== 0 && (
              <p className="text-red-400/60 pl-4">exit code {entry.exitCode}</p>
            )}
          </div>
        ))}

        {running && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-primary">$</span>
              <span className="text-primary">{runningCommand}</span>
            </div>
            <div className="flex items-center gap-3 pl-4">
              <BouncingDots />
              <span className="text-muted-foreground">{elapsed}s</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className={`border-t bg-[#08080A] px-4 py-3 flex items-center gap-2 font-mono text-xs transition-colors duration-300 ${running ? 'border-primary/40' : 'border-border'}`}>
        {running ? (
          <span className="text-primary/60 animate-pulse">$</span>
        ) : (
          <span className="text-primary">$</span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          placeholder={running ? `Running ${runningCommand}...` : 'Type a command...'}
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50"
          autoFocus
        />
      </div>
    </div>
  );
}

function BouncingDots() {
  return (
    <span className="inline-flex items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary"
          style={{
            animation: 'terminal-bounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  );
}
