'use client';

import { useState, useEffect, useRef } from 'react';

export interface LogEntry {
  serviceId: string;
  timestamp: string;
  stream: string;
  text: string;
  type?: string;
}

export function useLogStream(serviceId?: string) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = serviceId
      ? `/api/logs/stream?serviceId=${serviceId}`
      : '/api/logs/stream';

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs(prev => [...prev.slice(-1000), data]); // Keep last 1000
      } catch {}
    };
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [serviceId]);

  const clear = () => setLogs([]);

  return { logs, connected, clear };
}
