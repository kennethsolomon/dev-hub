'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ErrorPattern } from '@/lib/diagnostics/patterns';

interface ErrorDiagnosticProps {
  pattern: ErrorPattern;
  projectId: string;
  onFixApplied?: () => void;
}

export function ErrorDiagnostic({ pattern, projectId, onFixApplied }: ErrorDiagnosticProps) {
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleFix = async () => {
    if (!pattern.quickfix) return;
    setFixing(true);
    setResult(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/quickfix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: pattern.quickfix.action,
          ...pattern.quickfix.args,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ ok: true, message: data.message || 'Fix applied successfully.' });
        onFixApplied?.();
      } else {
        setResult({ ok: false, message: data.error || 'Fix failed.' });
      }
    } catch {
      setResult({ ok: false, message: 'Network error — could not reach the server.' });
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="mx-2 my-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-400">{pattern.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{pattern.description}</p>
        </div>
        {pattern.quickfix && !result?.ok && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-[var(--color-primary)]/40 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 text-xs"
            disabled={fixing}
            onClick={handleFix}
          >
            {fixing ? 'Fixing...' : pattern.quickfix.label}
          </Button>
        )}
      </div>

      <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
        {pattern.steps.map((step, i) => (
          <li key={i} className="leading-relaxed">
            <StepText text={step} />
          </li>
        ))}
      </ol>

      {result && (
        <p className={`text-xs font-medium ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

function StepText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-foreground/80">
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
