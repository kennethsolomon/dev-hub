'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useApi, apiPost, apiPut, apiDelete } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface Stack {
  id: string;
  name: string;
}

interface StackItem {
  stack_id: string;
  project_id: string;
  project_name: string;
  slug: string;
  type: string;
  sort_order: number;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  type: string;
}

export default function StacksPage() {
  const { data: stackData, refetch } = useApi<{ stacks: Stack[]; items: StackItem[] }>('/api/stacks');
  const { data: projects } = useApi<Project[]>('/api/projects');
  const { data: status, refetch: refetchStatus } = useApi<any>('/api/status');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const stacks = stackData?.stacks || [];
  const items = stackData?.items || [];

  const handleCreate = async () => {
    try {
      await apiPost('/api/stacks', { name: newName, project_ids: selectedProjectIds });
      toast.success('Stack created');
      setCreateOpen(false);
      setNewName('');
      setSelectedProjectIds([]);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStartStack = async (stackId: string) => {
    try {
      await apiPost(`/api/stacks/${stackId}/start`);
      toast.success('Stack starting');
      refetchStatus();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStopStack = async (stackId: string) => {
    try {
      await apiPost(`/api/stacks/${stackId}/stop`);
      toast.success('Stack stopped');
      refetchStatus();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteStack = async (stackId: string) => {
    if (!confirm('Delete this stack?')) return;
    try {
      await apiDelete(`/api/stacks/${stackId}`);
      toast.success('Stack deleted');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleProject = (pid: string) => {
    setSelectedProjectIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Stacks</h2>
            <p className="text-muted-foreground text-sm">Group projects for one-click start/stop</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Create Stack</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Stack</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Stack Name</label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Full Stack, API + Workers" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Projects</label>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {projects?.map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedProjectIds.includes(p.id)}
                          onCheckedChange={() => toggleProject(p.id)}
                        />
                        {p.name}
                        <Badge variant="outline" className="text-xs ml-auto">{p.type}</Badge>
                      </label>
                    ))}
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={!newName || selectedProjectIds.length === 0}>
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stacks.map(stack => {
            const stackItems = items.filter(i => i.stack_id === stack.id);
            return (
              <Card key={stack.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{stack.name}</CardTitle>
                    <Badge variant="outline">{stackItems.length} projects</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    {stackItems.map(item => (
                      <div key={item.project_id} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">&middot;</span>
                        {item.project_name}
                        <Badge variant="outline" className="text-xs">{item.type}</Badge>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleStartStack(stack.id)}>Start All</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleStopStack(stack.id)}>Stop All</Button>
                    <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" onClick={() => handleDeleteStack(stack.id)}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {stacks.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-8">
              No stacks yet. Create one to group related projects.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
