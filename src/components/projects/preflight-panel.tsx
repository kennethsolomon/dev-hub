'use client';

import { useApi } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
      case 'pass': return <span className="text-green-400">PASS</span>;
      case 'warn': return <span className="text-yellow-400">WARN</span>;
      case 'fail': return <span className="text-red-400">FAIL</span>;
      default: return null;
    }
  };

  const handleQuickFix = async (action: string, args: any) => {
    // Quick fix actions would be handled by a dedicated API
    // For V1, show what would be done
    alert(`Quick fix: ${action}\nArgs: ${JSON.stringify(args)}`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Preflight Checks</CardTitle>
          <Button size="sm" variant="outline" onClick={refetch} disabled={loading}>
            {loading ? 'Checking...' : 'Re-check'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!checks ? (
          <p className="text-sm text-muted-foreground">Loading checks...</p>
        ) : (
          <div className="space-y-2">
            {checks.map((check, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs w-10">{statusIcon(check.status)}</span>
                  <span className="text-sm">{check.message}</span>
                </div>
                {check.quickFix && (
                  <Button
                    size="sm"
                    variant="outline"
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
      </CardContent>
    </Card>
  );
}
