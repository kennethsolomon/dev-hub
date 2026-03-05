'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useLogStream, LogEntry } from '@/lib/hooks/use-log-stream';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { matchErrorPatterns } from '@/lib/diagnostics/patterns';
import { ErrorDiagnostic } from './error-diagnostic';

interface LogViewerProps {
  services: Array<{ id: string; name: string }>;
  runs: Array<{ id: string; service_id: string; status: string; log_path: string | null }>;
  projectId?: string;
}

export function LogViewer({ services, runs, projectId }: LogViewerProps) {
  const [selectedService, setSelectedService] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const { logs, connected, clear } = useLogStream(selectedService);
  const [historicalLogs, setHistoricalLogs] = useState<string>('');
  const [showHistorical, setShowHistorical] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = search
    ? logs.filter(l => l.text.toLowerCase().includes(search.toLowerCase()))
    : logs;

  // Compute which log indices should show diagnostics (first occurrence only)
  const diagnosticMap = useMemo(() => {
    const seen = new Set<string>();
    const map = new Map<number, import('@/lib/diagnostics/patterns').ErrorPattern[]>();
    filteredLogs.forEach((entry, i) => {
      const matches = matchErrorPatterns(entry.text);
      const newMatches = matches.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      if (newMatches.length > 0) map.set(i, newMatches);
    });
    return map;
  }, [filteredLogs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const loadHistorical = async (runId: string) => {
    try {
      const res = await fetch(`/api/logs/${runId}?tail=500${search ? `&search=${encodeURIComponent(search)}` : ''}`);
      const data = await res.json();
      setHistoricalLogs(data.content || '');
      setShowHistorical(true);
    } catch {}
  };

  const serviceNameMap = new Map(services.map(s => [s.id, s.name]));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-semibold">Logs</span>
          <Badge variant={connected ? 'default' : 'secondary'} className="text-xs">
            {connected ? 'Live' : 'Disconnected'}
          </Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={clear} className="text-xs text-muted-foreground">Clear</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 py-2 border-b border-border bg-muted/30">
        <select
          className="h-8 rounded-lg border border-border bg-background px-3 text-xs font-mono"
          value={selectedService || ''}
          onChange={e => setSelectedService(e.target.value || undefined)}
        >
          <option value="">All services</option>
          {services.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Input
          placeholder="Search logs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {/* Log Content */}
      <div className="bg-background">
        {showHistorical ? (
          <div className="space-y-2 p-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Historical logs</span>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowHistorical(false)}>Show Live</Button>
            </div>
            <pre className="font-mono text-xs rounded-lg p-4 overflow-auto max-h-[500px] whitespace-pre-wrap text-foreground/80">
              {historicalLogs || 'No logs found.'}
            </pre>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="font-mono text-xs p-4 overflow-auto max-h-[500px] space-y-0.5">
              {filteredLogs.length === 0 ? (
                <p className="text-muted-foreground">No log output yet. Start a service to see logs.</p>
              ) : (
                filteredLogs.map((entry, i) => {
                  const newMatches = diagnosticMap.get(i);
                  return (
                    <div key={i}>
                      <LogLine entry={entry} serviceName={serviceNameMap.get(entry.serviceId)} />
                      {projectId && newMatches?.map((pattern) => (
                        <ErrorDiagnostic
                          key={pattern.id}
                          pattern={pattern}
                          projectId={projectId}
                        />
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            {runs.length > 0 && (
              <div className="px-4 py-3 border-t border-border space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Previous runs:</p>
                {runs.slice(0, 5).map(run => (
                  <button
                    key={run.id}
                    className="text-xs text-primary hover:underline block"
                    onClick={() => loadHistorical(run.id)}
                  >
                    {serviceNameMap.get(run.service_id) || 'unknown'} - {run.status} ({run.id.slice(0, 8)})
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LogLine({ entry, serviceName }: { entry: LogEntry; serviceName?: string }) {
  const isError = entry.stream === 'stderr' || /error|exception|fatal/i.test(entry.text);
  const isWarn = /warn|warning/i.test(entry.text);

  return (
    <div className={`${isError ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-foreground/80'}`}>
      <span className="text-muted-foreground/50">{new Date(entry.timestamp).toLocaleTimeString()}</span>
      {serviceName && <span className="text-primary ml-2">[{serviceName}]</span>}
      <span className="ml-2 whitespace-pre-wrap">{entry.text}</span>
    </div>
  );
}
