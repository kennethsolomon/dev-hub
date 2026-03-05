'use client';

import { useApi } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';

interface PreflightResult {
  check: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  quickFix?: { label: string; action: string; args?: any };
}

export function PreflightPanel({ projectId }: { projectId: string }) {
  const { data: checks, loading, refetch } = useApi<PreflightResult[]>(`/api/projects/${projectId}/preflight`);

  const statusIcon = (s: string) => {
    switch (s) {
      case 'pass': return <span className="text-green-400 font-mono text-xs font-medium">PASS</span>;
      case 'warn': return <span className="text-amber-400 font-mono text-xs font-medium">WARN</span>;
      case 'fail': return <span className="text-red-400 font-mono text-xs font-medium">FAIL</span>;
      default: return null;
    }
  };

  const handleQuickFix = async (action: string, args: any) => {
    alert(`Quick fix: ${action}\nArgs: ${JSON.stringify(args)}`);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[15px] font-semibold">Preflight Checks</span>
        <Button size="sm" variant="outline" onClick={refetch} disabled={loading}>
          {loading ? 'Checking...' : 'Re-check'}
        </Button>
      </div>
      <div className="p-4">
        {!checks ? (
          <p className="text-sm text-muted-foreground">Loading checks...</p>
        ) : (
          <div className="space-y-0">
            {checks.map((check, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-10">{statusIcon(check.status)}</span>
                  <span className="text-sm">{check.message}</span>
                </div>
                {check.quickFix && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleQuickFix(check.quickFix!.action, check.quickFix!.args)}
                  >
                    {check.quickFix.label}
                  </Button>
                )}
              </div>
            ))}
            {checks.length === 0 && (
              <p className="text-sm text-muted-foreground">All checks passed.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
