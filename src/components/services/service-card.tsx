'use client';

import { useState } from 'react';
import { apiPost, apiPut, apiDelete } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  onRefetch: () => void;
}

export function ServiceCard({ service, isRunning, latestRun, onRefetch }: ServiceCardProps) {
  const [editing, setEditing] = useState(false);
  const [command, setCommand] = useState(service.command);
  const [desiredPort, setDesiredPort] = useState(String(service.desired_port || ''));

  const handleStart = async () => {
    try {
      const result = await apiPost(`/api/services/${service.id}/start`);
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
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStop = async () => {
    try {
      await apiPost(`/api/services/${service.id}/stop`);
      toast.success(`${service.name} stopped`);
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSave = async () => {
    try {
      await apiPut(`/api/services/${service.id}`, {
        command,
        desired_port: desiredPort ? parseInt(desiredPort) : null,
      });
      toast.success('Service updated');
      setEditing(false);
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete service "${service.name}"?`)) return;
    try {
      await apiDelete(`/api/services/${service.id}`);
      toast.success('Service deleted');
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deps = JSON.parse(service.depends_on_json || '[]');
  const displayPort = isRunning ? (latestRun?.assigned_port || service.assigned_port) : service.desired_port;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
            <CardTitle className="text-sm font-medium">{service.name}</CardTitle>
            {service.is_primary ? <Badge variant="outline" className="text-xs">primary</Badge> : null}
            {service.restart_policy !== 'no' && (
              <Badge variant="outline" className="text-xs">restart: {service.restart_policy}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
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
                    <span className="text-yellow-400 ml-1">(wanted :{service.desired_port})</span>
                  )}
                </a>
              ) : (
                <span className="text-xs font-mono text-muted-foreground">:{displayPort}</span>
              )
            )}
            {isRunning ? (
              <Button size="sm" variant="destructive" onClick={handleStop}>Stop</Button>
            ) : (
              <Button size="sm" onClick={handleStart}>Start</Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Command</label>
              <Input value={command} onChange={e => setCommand(e.target.value)} className="font-mono text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Desired Port</label>
              <Input value={desiredPort} onChange={e => setDesiredPort(e.target.value)} placeholder="auto" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-mono text-muted-foreground">{service.command}</p>
            {service.cwd && <p className="text-xs text-muted-foreground">cwd: {service.cwd}</p>}
            {deps.length > 0 && (
              <p className="text-xs text-muted-foreground">depends on: {deps.join(', ')}</p>
            )}
            {latestRun && (
              <p className="text-xs text-muted-foreground">
                Last run: {latestRun.status}
                {latestRun.exit_code !== null && ` (exit ${latestRun.exit_code})`}
                {latestRun.started_at && ` at ${new Date(latestRun.started_at).toLocaleTimeString()}`}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
