'use client';

import { useState, useRef, useEffect } from 'react';
import { useLogStream, LogEntry } from '@/lib/hooks/use-log-stream';
import { useApi } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface LogViewerProps {
  services: Array<{ id: string; name: string }>;
  runs: Array<{ id: string; service_id: string; status: string; log_path: string | null }>;
}

export function LogViewer({ services, runs }: LogViewerProps) {
  const [selectedService, setSelectedService] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const { logs, connected, clear } = useLogStream(selectedService);
  const [historicalLogs, setHistoricalLogs] = useState<string>('');
  const [showHistorical, setShowHistorical] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const filteredLogs = search
    ? logs.filter(l => l.text.toLowerCase().includes(search.toLowerCase()))
    : logs;

  const serviceNameMap = new Map(services.map(s => [s.id, s.name]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Logs</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={connected ? 'default' : 'secondary'} className="text-xs">
              {connected ? 'Live' : 'Disconnected'}
            </Badge>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-3 text-xs"
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
      </CardHeader>
      <CardContent>
        {showHistorical ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Historical logs</span>
              <Button size="sm" variant="ghost" onClick={() => setShowHistorical(false)}>Show Live</Button>
            </div>
            <pre className="font-mono text-xs bg-muted/50 rounded-md p-4 overflow-auto max-h-[500px] whitespace-pre-wrap">
              {historicalLogs || 'No logs found.'}
            </pre>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="font-mono text-xs bg-muted/50 rounded-md p-4 overflow-auto max-h-[500px] space-y-0.5">
              {filteredLogs.length === 0 ? (
                <p className="text-muted-foreground">No log output yet. Start a service to see logs.</p>
              ) : (
                filteredLogs.map((entry, i) => (
                  <LogLine key={i} entry={entry} serviceName={serviceNameMap.get(entry.serviceId)} />
                ))
              )}
            </div>

            {runs.length > 0 && (
              <div className="mt-3 space-y-1">
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
      </CardContent>
    </Card>
  );
}

function LogLine({ entry, serviceName }: { entry: LogEntry; serviceName?: string }) {
  const isError = entry.stream === 'stderr' || /error|exception|fatal/i.test(entry.text);
  const isWarn = /warn|warning/i.test(entry.text);

  return (
    <div className={`${isError ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-foreground/80'}`}>
      <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</span>
      {serviceName && <span className="text-primary ml-2">[{serviceName}]</span>}
      <span className="ml-2 whitespace-pre-wrap">{entry.text}</span>
    </div>
  );
}
