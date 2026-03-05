'use client';

import { useState } from 'react';
import { useApi, apiPut } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EnvVariable {
  key: string;
  fileValue: string | null;
  source: string | null;
  override: string | null;
  effective: string;
  isPort: boolean;
  isSecret: boolean;
  portStatus?: 'free' | 'in-use' | null;
}

interface EnvData {
  files: string[];
  variables: EnvVariable[];
}

export function EnvPanel({ projectId, projectPath }: { projectId: string; projectPath: string }) {
  const { data, loading, refetch } = useApi<EnvData>(`/api/projects/${projectId}/env`);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleEdit = (v: EnvVariable) => {
    setEditingKey(v.key);
    setEditValue(v.override ?? v.effective);
  };

  const handleSave = async (key: string) => {
    setSavingKey(key);
    try {
      await apiPut(`/api/projects/${projectId}/env`, { key, value: editValue });
      toast.success(`Override saved for ${key}`);
      setEditingKey(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingKey(null);
    }
  };

  const handleRemoveOverride = async (key: string) => {
    setRemovingKey(key);
    try {
      await apiPut(`/api/projects/${projectId}/env`, { key, value: null });
      toast.success(`Override removed for ${key}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRemovingKey(null);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    setAdding(true);
    try {
      await apiPut(`/api/projects/${projectId}/env`, { key: newKey.trim(), value: newValue });
      toast.success(`Added override for ${newKey}`);
      setAddOpen(false);
      setNewKey('');
      setNewValue('');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const toggleReveal = (key: string) => {
    setRevealedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const maskValue = (value: string) => '••••••••';

  if (loading) return <div className="p-4 text-muted-foreground text-sm">Loading environment...</div>;

  const variables = data?.variables || [];
  const files = data?.files || [];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <span className="text-[15px] font-semibold">Environment Variables</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {files.length > 0
              ? `Source: ${files.join(', ')}`
              : `No .env files found in ${projectPath}`}
            {variables.filter(v => v.override !== null).length > 0 && (
              <> &middot; {variables.filter(v => v.override !== null).length} override{variables.filter(v => v.override !== null).length !== 1 ? 's' : ''} active</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={refreshing} onClick={async () => {
            setRefreshing(true);
            try { await refetch(); } finally { setRefreshing(false); }
          }}>
            {refreshing && <Loader2 className="w-3 h-3 animate-spin" />}
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs">Add Override</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Environment Override</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Key</label>
                  <Input
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    placeholder="e.g. WEBHOOK_PORT"
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Value</label>
                  <Input
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder="e.g. 9000"
                    className="font-mono"
                  />
                </div>
                <Button onClick={handleAdd} disabled={!newKey.trim() || adding}>
                  {adding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {adding ? 'Adding...' : 'Add Override'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {variables.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No environment variables found. Add an override or create a .env file in your project.
          </p>
        ) : (
          <div className="space-y-0">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
              <span>Key</span>
              <span>.env Value</span>
              <span>Override</span>
              <span className="w-[140px]">Actions</span>
            </div>

            {/* Rows */}
            {variables.map(v => (
              <EnvRow
                key={v.key}
                variable={v}
                isEditing={editingKey === v.key}
                editValue={editValue}
                isRevealed={revealedKeys.has(v.key)}
                isSaving={savingKey === v.key}
                isRemoving={removingKey === v.key}
                onEdit={() => handleEdit(v)}
                onEditValueChange={setEditValue}
                onSave={() => handleSave(v.key)}
                onCancel={() => setEditingKey(null)}
                onRemoveOverride={() => handleRemoveOverride(v.key)}
                onToggleReveal={() => toggleReveal(v.key)}
                maskValue={maskValue}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EnvRow({
  variable: v,
  isEditing,
  editValue,
  isRevealed,
  isSaving,
  isRemoving,
  onEdit,
  onEditValueChange,
  onSave,
  onCancel,
  onRemoveOverride,
  onToggleReveal,
  maskValue,
}: {
  variable: EnvVariable;
  isEditing: boolean;
  editValue: string;
  isRevealed: boolean;
  isSaving: boolean;
  isRemoving: boolean;
  onEdit: () => void;
  onEditValueChange: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemoveOverride: () => void;
  onToggleReveal: () => void;
  maskValue: (val: string) => string;
}) {
  const displayValue = (val: string | null) => {
    if (val === null) return <span className="text-muted-foreground/50">&mdash;</span>;
    if (v.isSecret && !isRevealed) return <span className="text-muted-foreground">{maskValue(val)}</span>;
    return <span className="font-mono text-xs break-all">{val}</span>;
  };

  const portDot = () => {
    if (!v.isPort) return null;
    const color = v.portStatus === 'free' ? 'bg-green-500' : v.portStatus === 'in-use' ? 'bg-red-500' : 'bg-zinc-600';
    const label = v.portStatus === 'free' ? 'Port free' : v.portStatus === 'in-use' ? 'Port in use' : 'Unknown';
    return <div className={`w-2 h-2 rounded-full ${color} shrink-0`} title={label} />;
  };

  if (isEditing) {
    return (
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2 items-center bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          {portDot()}
          <span className="font-mono text-xs font-medium">{v.key}</span>
        </div>
        <div>{displayValue(v.fileValue)}</div>
        <Input
          value={editValue}
          onChange={e => onEditValueChange(e.target.value)}
          className="font-mono text-xs h-7"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <div className="flex gap-1 w-[140px]">
          <Button size="sm" variant="default" className="h-7 text-xs" disabled={isSaving} onClick={onSave}>
            {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={isSaving} onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2 items-center hover:bg-muted/20 rounded-lg group">
      <div className="flex items-center gap-2">
        {portDot()}
        <span className="font-mono text-xs font-medium">{v.key}</span>
        {v.isPort && (
          <Badge variant="outline" className="text-[10px] px-1 py-0">port</Badge>
        )}
        {v.override !== null && !v.fileValue && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-500/30 text-blue-400">override only</Badge>
        )}
      </div>
      <div>{displayValue(v.fileValue)}</div>
      <div className="flex items-center gap-1">
        {v.override !== null ? (
          <Badge variant="secondary" className="font-mono text-xs px-1.5 py-0">
            {v.isSecret && !isRevealed ? maskValue(v.override) : v.override}
          </Badge>
        ) : (
          <span className="text-muted-foreground/50 text-xs">&mdash;</span>
        )}
      </div>
      <div className="flex gap-1 w-[140px] opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onEdit}>Edit</Button>
        {v.isSecret && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onToggleReveal}>
            {isRevealed ? 'Hide' : 'Show'}
          </Button>
        )}
        {v.override !== null && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" disabled={isRemoving} onClick={onRemoveOverride}>
            {isRemoving && <Loader2 className="w-3 h-3 animate-spin" />}
            {isRemoving ? 'Removing...' : 'Remove'}
          </Button>
        )}
      </div>
    </div>
  );
}
