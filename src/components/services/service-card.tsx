'use client';

import { useState } from 'react';
import { useStartService, useStopService, useUpdateService, useDeleteService } from '@/lib/query/mutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ServiceCardProps {
  service: {
    id: string; name: string; command: string; desired_port: number | null;
    assigned_port: number | null; is_primary: number; restart_policy: string;
    depends_on_json: string; env_json: string; cwd: string | null;
  };
  isRunning: boolean;
  latestRun?: {
    id: string; status: string; pid: number | null; assigned_port: number | null;
    started_at: string; stopped_at: string | null; exit_code: number | null;
  };
}

export function ServiceCard({ service, isRunning, latestRun }: ServiceCardProps) {
  const [editing, setEditing] = useState(false);
  const [command, setCommand] = useState(service.command);
  const [desiredPort, setDesiredPort] = useState(String(service.desired_port || ''));
  const startService = useStartService();
  const stopService = useStopService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const starting = startService.isPending;
  const stopping = stopService.isPending;
  const saving = updateService.isPending;
  const deleting = deleteService.isPending;

  const handleStart = async () => {
    try {
      const result = await startService.mutateAsync(service.id);
      if (result.portConflict) {
        toast.warning(
          `Port ${result.portConflict.original} was busy -> assigned ${result.portConflict.assigned} for this run (and saved).`
        );
      } else {
        const port = result.assignedPort;
        if (port) {
          const url = `http://localhost:${port}`;
          toast.success(`${service.name} started`, {
            description: url,
            action: { label: 'Open', onClick: () => window.open(url, '_blank') },
          });
        } else {
          toast.success(`${service.name} started`);
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStop = async () => {
    try {
      await stopService.mutateAsync(service.id);
      toast.success(`${service.name} stopped`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSave = async () => {
    try {
      await updateService.mutateAsync({
        serviceId: service.id,
        command,
        desired_port: desiredPort ? parseInt(desiredPort) : null,
      });
      toast.success('Service updated');
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete service "${service.name}"?`)) return;
    try {
      await deleteService.mutateAsync(service.id);
      toast.success('Service deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deps = JSON.parse(service.depends_on_json || '[]');
  const displayPort = isRunning ? (latestRun?.assigned_port || service.assigned_port) : service.desired_port;

  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold">{service.name}</span>
          <span className="text-xs text-muted-foreground">editing</span>
        </div>
        <div>
          <label className="text-xs font-medium">Command</label>
          <Input value={command} onChange={e => setCommand(e.target.value)} className="font-mono text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium">Desired Port</label>
          <Input value={desiredPort} onChange={e => setDesiredPort(e.target.value)} placeholder="auto" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={saving} onClick={handleSave}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex items-center justify-between rounded-xl border bg-card px-4 py-3 transition-all duration-150 hover:border-primary/15 ${isRunning ? 'border-l-[3px] border-l-primary bg-primary/[0.02] border-border' : 'border-border'}`}>
      {/* Left: status + name + command */}
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? 'bg-green-500 animate-pulse-ring' : 'bg-zinc-600'}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{service.name}</span>
            {service.is_primary ? <Badge variant="outline" className="text-[10px] px-1.5 py-0">primary</Badge> : null}
            {service.restart_policy !== 'no' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">restart: {service.restart_policy}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-mono text-muted-foreground truncate">{service.command}</span>
            {deps.length > 0 && (
              <span className="text-xs text-muted-foreground">depends: {deps.join(', ')}</span>
            )}
          </div>
          {latestRun && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {latestRun.status}
              {latestRun.exit_code !== null && ` (exit ${latestRun.exit_code})`}
              {latestRun.started_at && ` at ${new Date(latestRun.started_at).toLocaleTimeString()}`}
            </p>
          )}
        </div>
      </div>

      {/* Right: port + actions */}
      <div className="flex items-center gap-3 shrink-0">
        {displayPort && (
          isRunning ? (
            <a
              href={`http://localhost:${displayPort}`}
              target="_blank"
              rel="noopener"
              className="text-xs font-mono text-primary hover:underline"
            >
              :{displayPort}
              {service.desired_port && latestRun?.assigned_port && latestRun.assigned_port !== service.desired_port && (
                <span className="text-amber-400 ml-1">(wanted :{service.desired_port})</span>
              )}
            </a>
          ) : (
            <span className="text-xs font-mono text-muted-foreground">:{displayPort}</span>
          )
        )}
        <div className="flex gap-1.5">
          {isRunning ? (
            <Button size="sm" variant="destructive" disabled={stopping} onClick={handleStop}>
              {stopping && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {stopping ? 'Stopping...' : 'Stop'}
            </Button>
          ) : (
            <Button size="sm" disabled={starting} onClick={handleStart}>
              {starting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {starting ? 'Starting...' : 'Start'}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" onClick={() => setEditing(true)}>Edit</Button>
          <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive" disabled={deleting} onClick={handleDelete}>
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {deleting ? 'Removing...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}
