'use client';

import { useState } from 'react';
import { useApi, apiPost, apiDelete } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  path: string;
  type: string;
  service_count: number;
  primary_port: number | null;
}

interface StatusData {
  running: Array<{ serviceId: string; runId: string; pid: number; assignedPort: number | null }>;
  routes: Array<{ slug: string; projectName: string; port: number; running: boolean; url: string }>;
}

export function Dashboard() {
  const { data: projects, refetch } = useApi<ProjectRow[]>('/api/projects');
  const { data: status, refetch: refetchStatus } = useApi<StatusData>('/api/status');
  const [addOpen, setAddOpen] = useState(false);
  const [addPath, setAddPath] = useState('');
  const [addName, setAddName] = useState('');

  const runningServiceIds = new Set(status?.running?.map(r => r.serviceId) || []);
  const routeMap = new Map(status?.routes?.map(r => [r.slug, r]) || []);

  const runningCount = status?.running?.length || 0;
  const projectCount = projects?.length || 0;
  const portsInUse = new Set(status?.running?.map(r => r.assignedPort).filter(Boolean)).size;

  const handleAdd = async () => {
    try {
      await apiPost('/api/projects', { action: 'import', path: addPath });
      toast.success('Project imported');
      setAddOpen(false);
      setAddPath('');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStartProject = async (projectId: string) => {
    try {
      const results = await apiPost(`/api/projects/${projectId}/start`);
      for (const r of results) {
        if (r.portConflict) {
          toast.warning(`Port ${r.portConflict.original} was busy -> assigned ${r.portConflict.assigned}`);
        }
      }
      await refetchStatus();
      const primaryPort = results.find((r: any) => r.assignedPort)?.assignedPort;
      if (primaryPort) {
        const url = `http://localhost:${primaryPort}`;
        toast.success('Project started', {
          description: url,
          action: { label: 'Open', onClick: () => window.open(url, '_blank') },
        });
      } else {
        toast.success('Project started');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStopProject = async (projectId: string) => {
    try {
      await apiPost(`/api/projects/${projectId}/stop`);
      toast.success('Project stopped');
      refetchStatus();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Delete this project from DevHub?')) return;
    try {
      await apiDelete(`/api/projects/${projectId}`);
      toast.success('Project removed');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getProjectStatus = (project: ProjectRow) => {
    const route = routeMap.get(project.slug);
    return route?.running || false;
  };

  const typeBadgeColor = (type: string) => {
    switch (type) {
      case 'node': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'laravel': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'expo': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight font-display">Dashboard</h2>
          <p className="text-muted-foreground text-sm">
            {projectCount} project{projectCount !== 1 ? 's' : ''} &middot; {runningCount} service{runningCount !== 1 ? 's' : ''} running
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetch(); refetchStatus(); }}>
            Refresh
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Add Project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Project Path</label>
                  <Input
                    placeholder="/Users/you/projects/my-app"
                    value={addPath}
                    onChange={e => setAddPath(e.target.value)}
                  />
                </div>
                <Button onClick={handleAdd} disabled={!addPath}>
                  Import Project
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up" style={{ animationDelay: '50ms' }}>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-2xl font-bold font-display">{projectCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Projects</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-2xl font-bold font-display text-green-400">{runningCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Running</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-2xl font-bold font-display">{portsInUse}</p>
          <p className="text-xs text-muted-foreground mt-1">Ports</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-2xl font-bold font-display">&mdash;</p>
          <p className="text-xs text-muted-foreground mt-1">Updates</p>
        </div>
      </div>

      {/* Portless mode banner */}
      <PortlessBanner />

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {projects?.map((project, i) => {
          const isRunning = getProjectStatus(project);
          const route = routeMap.get(project.slug);

          return (
            <Card
              key={project.id}
              className="relative group transition-all duration-150 hover:border-primary/15 hover:-translate-y-px animate-fade-up"
              style={{ animationDelay: `${100 + i * 50}ms` }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-[15px] font-semibold">
                      <Link href={`/projects/${project.id}`} className="hover:text-primary transition-colors">
                        {project.name}
                      </Link>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[250px]">
                      {project.path}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={typeBadgeColor(project.type)}>
                      {project.type}
                    </Badge>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? 'bg-green-500 animate-pulse-ring' : 'bg-zinc-600'}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{project.service_count} service{project.service_count !== 1 ? 's' : ''}</span>
                  {route?.port ? (
                    <>
                      <span>&middot;</span>
                      <span className="font-mono">:{route.port}</span>
                    </>
                  ) : null}
                  {isRunning && route?.port ? (
                    <>
                      <span>&middot;</span>
                      <a href={`http://localhost:${route.port}`} target="_blank" rel="noopener" className="text-primary hover:underline truncate font-mono">
                        localhost:{route.port}
                      </a>
                    </>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  {isRunning ? (
                    <Button size="sm" variant="destructive" onClick={() => handleStopProject(project.id)}>
                      Stop
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => handleStartProject(project.id)}>
                      Start
                    </Button>
                  )}
                  <Link href={`/projects/${project.id}`}>
                    <Button size="sm" variant="outline">Details</Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(project.id)}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {projects?.length === 0 && (
          <div className="col-span-full text-center py-16 animate-fade-up">
            <p className="text-muted-foreground mb-4">No projects yet. Add one or configure workspace roots in Settings.</p>
            <Button variant="outline" onClick={() => setAddOpen(true)}>Add Your First Project</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PortlessBanner() {
  const { data: settings } = useApi<Record<string, string>>('/api/settings');
  if (!settings) return null;

  const subdomainRouting = settings.subdomain_routing === 'true';
  const portlessMode = settings.portless_mode === 'true';

  if (!subdomainRouting || portlessMode) return null;

  return (
    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm">
      <p className="font-medium text-yellow-400">Subdomain URLs include a port number</p>
      <p className="text-muted-foreground mt-1">
        To get clean URLs like <code className="text-xs font-mono">http://myapp.localhost</code>, enable Portless Mode in Settings.
        This requires a one-time setup with Caddy.
      </p>
    </div>
  );
}
