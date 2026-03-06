'use client';

import { useState } from 'react';
import { useStacks, useProjects, useStatus } from '@/lib/query/hooks';
import { useCreateStack, useStartStack, useStopStack, useDeleteStack } from '@/lib/query/mutations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export function StacksPageContent() {
  const { data: stackData } = useStacks();
  const { data: projects } = useProjects();
  const { data: status } = useStatus();
  const createStackMut = useCreateStack();
  const startStackMut = useStartStack();
  const stopStackMut = useStopStack();
  const deleteStackMut = useDeleteStack();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const stacks = stackData?.stacks || [];
  const items = stackData?.items || [];
  const runningRoutes = new Set(status?.routes?.filter((r: any) => r.running).map((r: any) => r.slug) || []);

  const handleCreate = async () => {
    try {
      await createStackMut.mutateAsync({ name: newName, project_ids: selectedProjectIds });
      toast.success('Stack created');
      setCreateOpen(false);
      setNewName('');
      setSelectedProjectIds([]);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStartStack = async (stackId: string) => {
    try {
      await startStackMut.mutateAsync(stackId);
      toast.success('Stack starting');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStopStack = async (stackId: string) => {
    try {
      await stopStackMut.mutateAsync(stackId);
      toast.success('Stack stopped');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteStack = async (stackId: string) => {
    if (!confirm('Delete this stack?')) return;
    try {
      await deleteStackMut.mutateAsync(stackId);
      toast.success('Stack deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleProject = (pid: string) => {
    setSelectedProjectIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
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
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight font-display">Stacks</h2>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {stacks.map((stack, i) => {
          const stackItems = items.filter(it => it.stack_id === stack.id);
          const allRunning = stackItems.length > 0 && stackItems.every(it => runningRoutes.has(it.slug));

          return (
            <Card
              key={stack.id}
              className="relative group transition-all duration-150 hover:border-primary/15 hover:-translate-y-px animate-fade-up"
              style={{ animationDelay: `${100 + i * 50}ms` }}
            >
              {allRunning && (
                <div className="absolute left-0 top-4 bottom-4 w-[3px] bg-primary rounded-r-full" />
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[15px] font-semibold">{stack.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{stackItems.length} project{stackItems.length !== 1 ? 's' : ''}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 hover:text-destructive"
                      onClick={() => handleDeleteStack(stack.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  {stackItems.map(item => (
                    <div key={item.project_id} className="flex items-center gap-2 text-sm">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${runningRoutes.has(item.slug) ? 'bg-green-500 animate-pulse-ring' : 'bg-zinc-600'}`} />
                      <span>{item.project_name}</span>
                      <Badge variant="outline" className={`text-xs ${typeBadgeColor(item.type)}`}>{item.type}</Badge>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleStartStack(stack.id)}>Start All</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleStopStack(stack.id)}>Stop All</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {stacks.length === 0 && (
          <div className="col-span-full animate-fade-up">
            <div className="border border-dashed border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground mb-4">No stacks yet. Create one to group related projects.</p>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>Create Stack</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
