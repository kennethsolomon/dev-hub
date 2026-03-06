'use client';

import { useState, useEffect, useMemo } from 'react';
import { useProject, useStatus } from '@/lib/query/hooks';
import { useStartProject, useStopProject, useDeleteProject, useCreateService, useUpdateProject } from '@/lib/query/mutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ServiceCard } from '@/components/services/service-card';
import { ArrowLeft, ExternalLink, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const LogViewer = dynamic(() => import('@/components/logs/log-viewer').then(m => m.LogViewer));
const PreflightPanel = dynamic(() => import('@/components/projects/preflight-panel').then(m => m.PreflightPanel));
const EnvPanel = dynamic(() => import('@/components/projects/env-panel').then(m => m.EnvPanel));
const ProjectTerminal = dynamic(() => import('@/components/terminal/project-terminal').then(m => m.ProjectTerminal));
import { useLogStream } from '@/lib/hooks/use-log-stream';
import { useTerminal } from '@/lib/hooks/use-terminal';


const tabClass = 'rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm';

const typeBadgeColor = (type: string) => {
  switch (type) {
    case 'node': return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'laravel': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'expo': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

function formatUptime(ms: number): string {
  if (ms < 0) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const { data, isLoading: loading, error, refetch } = useProject(projectId);
  const { data: status } = useStatus();
  const startProjectMut = useStartProject();
  const stopProjectMut = useStopProject();
  const deleteProjectMut = useDeleteProject();
  const createServiceMut = useCreateService();
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [newService, setNewService] = useState({ name: '', command: '', desired_port: '' });
  const [startingAll, setStartingAll] = useState(false);
  const [stoppingAll, setStoppingAll] = useState(false);
  const [addingService, setAddingService] = useState(false);
  const terminal = useTerminal(projectId);
  const logStream = useLogStream();

  const earliestStart = useMemo(() => {
    const runs = data?.runs;
    if (!runs) return null;
    const runningRuns = runs.filter(r => r.status === 'running' && r.started_at);
    return runningRuns.length > 0
      ? Math.min(...runningRuns.map(r => new Date(r.started_at).getTime()))
      : null;
  }, [data?.runs]);

  if (loading) return (
    <div className="p-6 space-y-6 animate-fade-up">
      <div className="h-4 w-16 rounded bg-muted animate-pulse" />
      <div className="space-y-3">
        <div className="h-8 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-96 rounded bg-muted animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl bg-card border border-border p-4 space-y-2">
            <div className="h-6 w-16 rounded bg-muted animate-pulse" />
            <div className="h-3 w-12 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
      <div className="h-10 w-full rounded bg-muted animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />
        ))}
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="p-6 flex items-center justify-center min-h-[400px] animate-fade-up">
      <div className="rounded-xl border border-dashed border-border p-12 text-center max-w-md">
        <div className="text-primary/30 text-4xl mb-4">&#9671;</div>
        <h2 className="text-[28px] font-bold tracking-tight font-display">Project Not Found</h2>
        <p className="text-muted-foreground mt-2">This project may have been removed or the ID is invalid.</p>
        <p className="text-xs text-muted-foreground font-mono mt-2">{projectId}</p>
        <Link href="/" className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm mt-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );

  const { project, services, runs } = data;
  const runningServiceIds = new Set(status?.running?.map((r: any) => r.serviceId) || []);

  const handleStartAll = async () => {
    setStartingAll(true);
    try {
      const results = await startProjectMut.mutateAsync(projectId);
      for (const r of results) {
        if (r.portConflict) {
          toast.warning(`Port ${r.portConflict.original} was busy -> assigned ${r.portConflict.assigned}`);
        }
      }
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
    } finally {
      setStartingAll(false);
    }
  };

  const handleStopAll = async () => {
    setStoppingAll(true);
    try {
      await stopProjectMut.mutateAsync(projectId);
      toast.success('All services stopped');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setStoppingAll(false);
    }
  };

  const handleAddService = async () => {
    setAddingService(true);
    try {
      await createServiceMut.mutateAsync({
        project_id: projectId,
        name: newService.name,
        command: newService.command,
        desired_port: newService.desired_port ? parseInt(newService.desired_port) : null,
      });
      toast.success('Service added');
      setAddServiceOpen(false);
      setNewService({ name: '', command: '', desired_port: '' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingService(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm('Delete this project from DevHub? This will not delete any files on disk.')) return;
    try {
      await deleteProjectMut.mutateAsync(projectId);
      toast.success('Project removed');
      window.location.href = '/';
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const anyRunning = services.some(s => runningServiceIds.has(s.id));
  const runningCount = services.filter(s => runningServiceIds.has(s.id)).length;

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
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full shrink-0 ${anyRunning ? 'bg-green-500 animate-pulse-ring' : 'bg-zinc-600'}`} />
          <div>
            <h2 className="text-[28px] font-bold tracking-tight font-display">{project.name}</h2>
            <p className="text-sm text-muted-foreground font-mono">{project.path}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {anyRunning ? (
            <Button variant="destructive" disabled={stoppingAll} onClick={handleStopAll}>
              {stoppingAll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {stoppingAll ? 'Stopping...' : 'Stop All'}
            </Button>
          ) : (
            <Button disabled={startingAll} onClick={handleStartAll}>
              {startingAll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {startingAll ? 'Starting...' : 'Start All'}
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up" style={{ animationDelay: '75ms' }}>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${anyRunning ? 'bg-green-500' : 'bg-zinc-600'}`} />
            <p className={`text-lg font-bold font-display ${anyRunning ? 'text-green-400' : 'text-muted-foreground'}`}>
              {anyRunning ? 'Running' : 'Stopped'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Status</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-lg font-bold font-display">{runningCount}/{services.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Services</p>
          {services.length > 0 && (
            <div className="h-1 w-full rounded-full bg-muted mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${(runningCount / services.length) * 100}%` }}
              />
            </div>
          )}
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          {directPort ? (
            anyRunning ? (
              <a href={`http://localhost:${directPort}`} target="_blank" rel="noopener" className="text-lg font-bold font-display text-cyan-400 font-mono hover:underline">
                :{directPort}
              </a>
            ) : (
              <p className="text-lg font-bold font-display text-cyan-400 font-mono">:{directPort}</p>
            )
          ) : (
            <p className="text-lg font-bold font-display text-muted-foreground">—</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Port</p>
        </div>
        <UptimeDisplay earliestStart={earliestStart} />
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap animate-fade-up" style={{ animationDelay: '100ms' }}>
        <Badge variant="outline" className={`text-[10px] px-1.5 ${typeBadgeColor(project.type)}`}>{project.type}</Badge>
        <Badge variant="outline" className="font-mono text-xs">{project.slug}.localhost</Badge>
        {anyRunning && projectUrl && (
          <a href={projectUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-mono">
            {projectUrl}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
        <Tabs defaultValue="services">
          <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start gap-0 p-0 h-auto">
            <TabsTrigger value="services" className={tabClass}>
              Services ({services.length})
            </TabsTrigger>
            <TabsTrigger value="logs" className={tabClass}>
              <span className="flex items-center gap-1.5">
                {anyRunning && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                Logs
              </span>
            </TabsTrigger>
            <TabsTrigger value="preflight" className={tabClass}>
              Preflight
            </TabsTrigger>
            <TabsTrigger value="env" className={tabClass}>
              Environment
            </TabsTrigger>
            <TabsTrigger value="config" className={tabClass}>
              Config
            </TabsTrigger>
            <TabsTrigger value="terminal" className={tabClass}>
              Terminal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-3 mt-6">
            {services.map((svc, i) => (
              <div key={svc.id} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <ServiceCard
                  service={svc}
                  isRunning={runningServiceIds.has(svc.id)}
                  latestRun={runs.find(r => r.service_id === svc.id)}
                />
              </div>
            ))}

            {services.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-12 text-center animate-fade-up">
                <div className="text-primary/30 text-4xl mb-4">&#9671;</div>
                <p className="text-muted-foreground mb-4">No services configured yet.</p>
                <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">Add Your First Service</Button>
                  </DialogTrigger>
                  <AddServiceDialog
                    newService={newService}
                    setNewService={setNewService}
                    handleAddService={handleAddService}
                    adding={addingService}
                  />
                </Dialog>
              </div>
            ) : (
              <div className="flex justify-end">
                <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">Add Service</Button>
                  </DialogTrigger>
                  <AddServiceDialog
                    newService={newService}
                    setNewService={setNewService}
                    handleAddService={handleAddService}
                    adding={addingService}
                  />
                </Dialog>
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <LogViewer services={services} runs={runs} projectId={projectId} logs={logStream.logs} connected={logStream.connected} clearLogs={logStream.clear} onRunsChanged={refetch} />
          </TabsContent>

          <TabsContent value="preflight" className="mt-6">
            <PreflightPanel projectId={projectId} />
          </TabsContent>

          <TabsContent value="env" className="mt-6">
            <EnvPanel projectId={projectId} projectPath={project.path} />
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <ConfigPanel project={project} onDelete={handleDeleteProject} />
          </TabsContent>

          <TabsContent value="terminal" className="mt-6">
            <ProjectTerminal projectPath={project.path} entries={terminal.entries} setEntries={terminal.setEntries} running={terminal.running} runningCommand={terminal.runningCommand} onRunCommand={terminal.runCommand} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AddServiceDialog({
  newService,
  setNewService,
  handleAddService,
  adding,
}: {
  newService: { name: string; command: string; desired_port: string };
  setNewService: React.Dispatch<React.SetStateAction<{ name: string; command: string; desired_port: string }>>;
  handleAddService: () => void;
  adding: boolean;
}) {
  return (
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
        <Button onClick={handleAddService} disabled={!newService.name || !newService.command || adding}>
          {adding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {adding ? 'Adding...' : 'Add'}
        </Button>
      </div>
    </DialogContent>
  );
}

function UptimeDisplay({ earliestStart }: { earliestStart: number | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!earliestStart) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [earliestStart]);

  const uptimeMs = earliestStart ? now - earliestStart : -1;

  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-lg font-bold font-display">{formatUptime(uptimeMs)}</p>
      </div>
      <p className="text-xs text-muted-foreground mt-1">Uptime</p>
    </div>
  );
}

function ConfigPanel({ project, onDelete }: { project: any; onDelete: () => void }) {
  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);
  const updateProject = useUpdateProject();

  const handleSave = async () => {
    try {
      await updateProject.mutateAsync({ projectId: project.id, name, slug });
      toast.success('Project updated');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[15px] font-semibold font-display">Project Configuration</span>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Slug (used for subdomain routing)</label>
            <Input value={slug} onChange={e => setSlug(e.target.value)} className="font-mono" />
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {slug || project.slug}.localhost
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Path</label>
            <Input value={project.path} disabled className="font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium">Type</label>
            <Input value={project.type} disabled />
          </div>
          <Button disabled={updateProject.isPending} onClick={handleSave}>
            {updateProject.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {updateProject.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-border bg-card overflow-hidden border-t-2 border-t-red-500/50">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[15px] font-semibold font-display text-red-400">Danger Zone</span>
        </div>
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete this project</p>
            <p className="text-xs text-muted-foreground mt-0.5">Remove from DevHub. No files on disk will be deleted.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={onDelete}>Delete Project</Button>
        </div>
      </div>
    </div>
  );
}
