'use client';

import { useState } from 'react';
import { useApi, apiPost, apiDelete } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';
import { Search, X, RefreshCw } from 'lucide-react';

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
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'running' | 'stopped'>('all');

  const runningServiceIds = new Set(status?.running?.map(r => r.serviceId) || []);
  const routeMap = new Map(status?.routes?.map(r => [r.slug, r]) || []);

  const runningCount = status?.running?.length || 0;
  const projectCount = projects?.length || 0;
  const portsInUse = new Set(status?.running?.map(r => r.assignedPort).filter(Boolean)).size;
  const totalServices = projects?.reduce((acc, p) => acc + p.service_count, 0) || 0;
  const runningProjectCount = projects?.filter(p => routeMap.get(p.slug)?.running).length || 0;

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

  const projectTypes = [...new Set(projects?.map(p => p.type) || [])];

  const filteredProjects = projects?.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.slug.toLowerCase().includes(q) && !p.path.toLowerCase().includes(q)) return false;
    }
    if (filterType && p.type !== filterType) return false;
    if (filterStatus === 'running' && !getProjectStatus(p)) return false;
    if (filterStatus === 'stopped' && getProjectStatus(p)) return false;
    return true;
  });

  const hasActiveFilters = !!search || !!filterType || filterStatus !== 'all';

  const typeBadgeColor = (type: string) => {
    switch (type) {
      case 'node': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'laravel': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'expo': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Health dots: cap at 10 visible
  const healthDots = projects?.slice(0, 10).map(p => getProjectStatus(p)) || [];
  const healthOverflow = projectCount > 10 ? projectCount - 10 : 0;

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
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => { refetch(); refetchStatus(); }}>
            <RefreshCw className="w-3.5 h-3.5" />
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
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-2xl font-bold font-display">{projectCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Projects</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-2xl font-bold font-display text-green-400">{runningCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Services Running</p>
          {totalServices > 0 && (
            <div className="h-1 w-full rounded-full bg-muted mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${(runningCount / totalServices) * 100}%` }}
              />
            </div>
          )}
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-2xl font-bold font-display text-cyan-400">{portsInUse}</p>
          <p className="text-xs text-muted-foreground mt-1">Ports</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-1 flex-wrap">
            {healthDots.map((running, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full shrink-0 ${running ? 'bg-primary' : 'border border-muted-foreground/30'}`}
              />
            ))}
            {healthOverflow > 0 && (
              <span className="text-[10px] text-muted-foreground ml-0.5">+{healthOverflow}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{runningProjectCount}/{projectCount} healthy</p>
        </div>
      </div>

      {/* Portless mode banner */}
      <PortlessBanner />

      {/* Search & Filters */}
      {projectCount > 0 && (
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="pl-9 font-mono text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'running', 'stopped'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-md text-xs transition-all duration-150 border ${
                  filterStatus === s
                    ? 'bg-primary/8 text-foreground font-medium border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border-transparent'
                }`}
              >
                {s === 'all' ? 'All' : s === 'running' ? 'Running' : 'Stopped'}
              </button>
            ))}
            {projectTypes.length > 1 && <div className="w-px h-5 bg-border self-center" />}
            {projectTypes.length > 1 && projectTypes.map(t => (
              <button
                key={t}
                onClick={() => setFilterType(filterType === t ? null : t)}
                className={`px-2.5 py-1 rounded-md text-xs transition-all duration-150 border ${
                  filterType === t
                    ? 'bg-primary/8 text-foreground font-medium border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border-transparent'
                }`}
              >
                {t}
              </button>
            ))}
            {hasActiveFilters && (
              <button
                onClick={() => { setSearch(''); setFilterType(null); setFilterStatus('all'); }}
                className="px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Project Rows */}
      <div className="space-y-3">
        {filteredProjects?.map((project, i) => {
          const isRunning = getProjectStatus(project);
          const route = routeMap.get(project.slug);

          return (
            <div
              key={project.id}
              className={`group relative rounded-xl border bg-card px-4 py-3.5 transition-all duration-150 hover:border-primary/15 hover:-translate-y-px animate-fade-up ${
                isRunning ? 'border-l-[3px] border-l-primary bg-primary/[0.02]' : 'border-border'
              }`}
              style={{ animationDelay: `${150 + i * 40}ms` }}
            >
              <div className="flex items-center gap-4">
                {/* Left: status + name + type */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? 'bg-green-500 animate-pulse-ring' : 'bg-zinc-600'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/projects/${project.id}`} className="text-[15px] font-semibold font-display hover:text-primary transition-colors truncate">
                        {project.name}
                      </Link>
                      <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 ${typeBadgeColor(project.type)}`}>
                        {project.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="font-mono truncate max-w-[300px]">{project.path}</span>
                      <span>&middot;</span>
                      <span>{project.service_count} service{project.service_count !== 1 ? 's' : ''}</span>
                      {route?.port && !isRunning && (
                        <>
                          <span>&middot;</span>
                          <span className="font-mono text-cyan-400/60">:{route.port}</span>
                        </>
                      )}
                      {isRunning && route?.port && (
                        <>
                          <span>&middot;</span>
                          <a
                            href={`http://localhost:${route.port}`}
                            target="_blank"
                            rel="noopener"
                            className="font-mono text-primary hover:underline"
                          >
                            localhost:{route.port}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 shrink-0">
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
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(project.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredProjects?.length === 0 && projectCount > 0 && (
          <div className="text-center py-12 animate-fade-up">
            <p className="text-muted-foreground mb-3">No projects match your filters.</p>
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterType(null); setFilterStatus('all'); }}>
              Clear filters
            </Button>
          </div>
        )}

        {projects?.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center animate-fade-up">
            <div className="text-primary/30 text-4xl mb-4">&#9671;</div>
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
