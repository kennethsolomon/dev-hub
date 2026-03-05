'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { LogEntry } from '@/lib/hooks/use-log-stream';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { matchErrorPatterns } from '@/lib/diagnostics/patterns';
import { ErrorDiagnostic } from './error-diagnostic';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LogViewerProps {
  services: Array<{ id: string; name: string }>;
  runs: Array<{ id: string; service_id: string; status: string; log_path: string | null; started_at?: string; stopped_at?: string | null }>;
  projectId?: string;
  logs: LogEntry[];
  connected: boolean;
  clearLogs: () => void;
  onRunsChanged: () => void;
}

export function LogViewer({ services, runs, projectId, logs: allLogs, connected, clearLogs, onRunsChanged }: LogViewerProps) {
  const [selectedService, setSelectedService] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [historicalLogs, setHistoricalLogs] = useState<string>('');
  const [showHistorical, setShowHistorical] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter by selected service, then by search text
  const filteredLogs = useMemo(() => {
    let filtered = selectedService
      ? allLogs.filter(l => l.serviceId === selectedService)
      : allLogs;
    if (search) {
      filtered = filtered.filter(l => l.text.toLowerCase().includes(search.toLowerCase()));
    }
    return filtered;
  }, [allLogs, selectedService, search]);

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

  // Refresh relative timestamps every 60s
  const [, setTick] = useState(false);
  useEffect(() => {
    if (runs.length === 0) return;
    const interval = setInterval(() => setTick(t => !t), 60000);
    return () => clearInterval(interval);
  }, [runs.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allLogs]);

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
        <Button size="sm" variant="ghost" onClick={clearLogs} className="text-xs text-muted-foreground">Clear</Button>
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
              <div className="px-4 py-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium">Previous runs:</p>
                  {projectId && runs.some(r => r.status !== 'running') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground h-6 px-2"
                      disabled={clearingAll}
                      onClick={async () => {
                        setClearingAll(true);
                        try {
                          const res = await fetch(`/api/projects/${projectId}/logs`, { method: 'DELETE' });
                          if (!res.ok) throw new Error();
                          const data = await res.json();
                          toast.success(`Deleted ${data.deleted} log${data.deleted !== 1 ? 's' : ''}`);
                          onRunsChanged();
                        } catch { toast.error('Failed to clear logs'); }
                        finally { setClearingAll(false); }
                      }}
                    >
                      {clearingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Clear All Logs'}
                    </Button>
                  )}
                </div>
                {runs.slice(0, 10).map(run => (
                  <div key={run.id} className="flex items-center gap-2 group">
                    <button
                      className="text-xs text-primary hover:underline text-left flex-1"
                      onClick={() => loadHistorical(run.id)}
                    >
                      {serviceNameMap.get(run.service_id) || 'unknown'} - {run.status}
                      {run.started_at && (
                        <span className="text-muted-foreground ml-1.5">
                          {formatRunTime(run.started_at, run.stopped_at)}
                        </span>
                      )}
                    </button>
                    {run.status !== 'running' && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
                        disabled={deletingRunId === run.id}
                        onClick={async () => {
                          setDeletingRunId(run.id);
                          try {
                            const res = await fetch(`/api/logs/${run.id}`, { method: 'DELETE' });
                            if (!res.ok) throw new Error();
                            toast.success('Log deleted');
                            onRunsChanged();
                          } catch { toast.error('Failed to delete log'); }
                          finally { setDeletingRunId(null); }
                        }}
                      >
                        {deletingRunId === run.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatRunTime(startedAt: string, stoppedAt?: string | null): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  let timeStr: string;
  if (diffMins < 1) timeStr = 'just now';
  else if (diffMins < 60) timeStr = `${diffMins}m ago`;
  else if (diffMins < 1440) timeStr = `${Math.floor(diffMins / 60)}h ago`;
  else timeStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (stoppedAt) {
    const durationMs = new Date(stoppedAt).getTime() - start.getTime();
    const durationSecs = Math.floor(durationMs / 1000);
    const durStr = durationSecs < 60 ? `${durationSecs}s` : durationSecs < 3600 ? `${Math.floor(durationSecs / 60)}m` : `${Math.floor(durationSecs / 3600)}h`;
    return `${timeStr} (ran ${durStr})`;
  }
  return timeStr;
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
