'use client';

import { useState } from 'react';
import { useApi, apiPost, apiPut, apiDelete } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { LogViewer } from '@/components/logs/log-viewer';
import { PreflightPanel } from '@/components/projects/preflight-panel';
import { ServiceCard } from '@/components/services/service-card';
import { EnvPanel } from '@/components/projects/env-panel';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ProjectData {
  project: {
    id: string; name: string; slug: string; path: string; type: string;
    config_json: string | null; created_at: string; updated_at: string;
  };
  services: Array<{
    id: string; name: string; command: string; desired_port: number | null;
    assigned_port: number | null; is_primary: number; restart_policy: string;
    depends_on_json: string; env_json: string; cwd: string | null;
  }>;
  runs: Array<{
    id: string; service_id: string; status: string; pid: number | null;
    assigned_port: number | null; started_at: string; stopped_at: string | null;
    exit_code: number | null; log_path: string | null;
  }>;
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const { data, loading, error, refetch } = useApi<ProjectData>(`/api/projects/${projectId}`);
  const { data: status, refetch: refetchStatus } = useApi<any>('/api/status');
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [newService, setNewService] = useState({ name: '', command: '', desired_port: '', is_primary: false });

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (error || !data) return (
    <div className="p-6 space-y-4 animate-fade-up">
      <h2 className="text-[28px] font-bold tracking-tight font-display">Project Not Found</h2>
      <p className="text-muted-foreground">This project may have been removed or the ID is invalid.</p>
      <p className="text-xs text-muted-foreground font-mono">{projectId}</p>
      <Link href="/" className="text-primary hover:underline text-sm">Back to Dashboard</Link>
    </div>
  );

  const { project, services, runs } = data;
  const runningServiceIds = new Set(status?.running?.map((r: any) => r.serviceId) || []);

  const handleStartAll = async () => {
    try {
      const results = await apiPost(`/api/projects/${projectId}/start`);
      for (const r of results) {
        if (r.portConflict) {
          toast.warning(`Port ${r.portConflict.original} was busy -> assigned ${r.portConflict.assigned}`);
        }
      }
      refetch();
      await refetchStatus();
      const primaryPort = results.find((r: any) => r.assignedPort)?.assignedPort;
      if (primaryPort) {
        const url = `http://localhost:${primaryPort}`;
        toast.success('All services starting', {
          description: url,
          action: { label: 'Open', onClick: () => window.open(url, '_blank') },
        });
      } else {
        toast.success('All services starting');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStopAll = async () => {
    try {
      await apiPost(`/api/projects/${projectId}/stop`);
      toast.success('All services stopped');
      refetch();
      refetchStatus();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddService = async () => {
    try {
      await apiPost('/api/services', {
        project_id: projectId,
        name: newService.name,
        command: newService.command,
        desired_port: newService.desired_port ? parseInt(newService.desired_port) : null,
        is_primary: newService.is_primary,
      });
      toast.success('Service added');
      setAddServiceOpen(false);
      setNewService({ name: '', command: '', desired_port: '', is_primary: false });
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const anyRunning = services.some(s => runningServiceIds.has(s.id));

  const runningService = status?.running?.find((r: any) => services.some(s => s.id === r.serviceId));
  const directPort = runningService?.assignedPort;
  const route = status?.routes?.find((r: any) => r.slug === project.slug);
  const useSubdomain = route?.url && !route.url.includes(':4400');
  const projectUrl = useSubdomain ? route.url : (directPort ? `http://localhost:${directPort}` : null);

  return (
    <div className="p-6 space-y-6">
      {/* Back link */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors animate-fade-up">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up" style={{ animationDelay: '50ms' }}>
        <div>
          <h2 className="text-[28px] font-bold tracking-tight font-display">{project.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground font-mono">{project.path}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {anyRunning ? (
            <Button variant="destructive" onClick={handleStopAll}>Stop All</Button>
          ) : (
            <Button onClick={handleStartAll}>Start All</Button>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 animate-fade-up" style={{ animationDelay: '100ms' }}>
        <Badge variant="outline">{project.type}</Badge>
        <Badge variant="outline" className="font-mono">{project.slug}.localhost</Badge>
        <Badge variant={anyRunning ? 'default' : 'secondary'}>
          {anyRunning ? 'Running' : 'Stopped'}
        </Badge>
        {anyRunning && projectUrl && (
          <a href={projectUrl} target="_blank" rel="noopener" className="text-sm text-primary hover:underline font-mono">
            {projectUrl}
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
        <Tabs defaultValue="services">
          <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start gap-0 p-0 h-auto">
            <TabsTrigger value="services" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
              Services ({services.length})
            </TabsTrigger>
            <TabsTrigger value="logs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
              Logs
            </TabsTrigger>
            <TabsTrigger value="preflight" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
              Preflight
            </TabsTrigger>
            <TabsTrigger value="env" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
              Environment
            </TabsTrigger>
            <TabsTrigger value="config" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
              Config
            </TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-4 mt-6">
            <div className="flex justify-end">
              <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">Add Service</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Service</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <Input value={newService.name} onChange={e => setNewService(s => ({ ...s, name: e.target.value }))} placeholder="e.g., dev, worker, redis" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Command</label>
                      <Input value={newService.command} onChange={e => setNewService(s => ({ ...s, command: e.target.value }))} placeholder="npm run dev" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Desired Port (optional)</label>
                      <Input value={newService.desired_port} onChange={e => setNewService(s => ({ ...s, desired_port: e.target.value }))} placeholder="3000" />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={newService.is_primary} onChange={e => setNewService(s => ({ ...s, is_primary: e.target.checked }))} />
                      Primary service (receives subdomain traffic)
                    </label>
                    <Button onClick={handleAddService} disabled={!newService.name || !newService.command}>Add</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {services.map(svc => (
              <ServiceCard
                key={svc.id}
                service={svc}
                isRunning={runningServiceIds.has(svc.id)}
                latestRun={runs.find(r => r.service_id === svc.id)}
                onRefetch={() => { refetch(); refetchStatus(); }}
              />
            ))}

            {services.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No services configured. Add one to get started.</p>
            )}
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <LogViewer services={services} runs={runs} />
          </TabsContent>

          <TabsContent value="preflight" className="mt-6">
            <PreflightPanel projectId={projectId} />
          </TabsContent>

          <TabsContent value="env" className="mt-6">
            <EnvPanel projectId={projectId} projectPath={project.path} />
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <ConfigPanel project={project} onUpdate={refetch} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ConfigPanel({ project, onUpdate }: { project: any; onUpdate: () => void }) {
  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);

  const handleSave = async () => {
    try {
      await apiPut(`/api/projects/${project.id}`, { name, slug });
      toast.success('Project updated');
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold">Project Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Slug (used for subdomain routing)</label>
          <Input value={slug} onChange={e => setSlug(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Path</label>
          <Input value={project.path} disabled className="font-mono" />
        </div>
        <div>
          <label className="text-sm font-medium">Type</label>
          <Input value={project.type} disabled />
        </div>
        <Button onClick={handleSave}>Save Changes</Button>
      </CardContent>
    </Card>
  );
}
