'use client';

import { useState, useEffect, useRef } from 'react';

export interface BuildStatus {
  building: boolean;
  projectId: string | null;
  phase: string | null;
  serviceName: string | null;
  error: string | null;
  restarted: string[];
}

export function useBuildStatus() {
  const [status, setStatus] = useState<BuildStatus>({
    building: false,
    projectId: null,
    phase: null,
    serviceName: null,
    error: null,
    restarted: [],
  });
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/build/stream');

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Clear any pending auto-hide timer
        if (clearTimerRef.current) {
          clearTimeout(clearTimerRef.current);
          clearTimerRef.current = null;
        }

        const isTerminal = data.phase === 'complete' || data.phase === 'error';

        setStatus({
          building: !isTerminal,
          projectId: data.projectId,
          phase: data.phase,
          serviceName: data.serviceName || null,
          error: data.error || null,
          restarted: data.restarted || [],
        });

        // Auto-hide after 3s on complete/error
        if (isTerminal) {
          clearTimerRef.current = setTimeout(() => {
            setStatus(prev => ({ ...prev, building: false, phase: null, projectId: null }));
          }, 3000);
        }
      } catch {}
    };

    return () => {
      es.close();
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  return status;
}
