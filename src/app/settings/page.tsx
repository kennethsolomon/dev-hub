'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useApi, apiPut, apiPost } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FolderOpen, Globe, Shield, Search, X, Check, AlertTriangle, Loader2 } from 'lucide-react';

function StatusDot({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
      <div className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-primary animate-pulse-ring' : 'bg-muted-foreground/30'}`} />
      <span className={`text-xs ${active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </button>
  );
}

function typeBadgeClass(type: string) {
  switch (type) {
    case 'node': return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'laravel': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'expo': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
}

const DEFAULT_SETTINGS: Record<string, string> = {
  workspace_roots: '[]',
  subdomain_routing: 'false',
  portless_mode: 'false',
  base_domain: 'localhost',
  proxy_port: '4400',
  bind_mode: 'localhost',
  auth_enabled: 'false',
};

export default function SettingsPage() {
  const { data: settings, refetch } = useApi<Record<string, string>>('/api/settings');
  const { data: authInfo, refetch: refetchAuth } = useApi<{ authEnabled: boolean; hasPasscode: boolean }>('/api/auth');
  const [workspaceRoots, setWorkspaceRoots] = useState<string[]>([]);
  const [newRoot, setNewRoot] = useState('');
  const [baseDomain, setBaseDomain] = useState('localhost');
  const [proxyPort, setProxyPort] = useState('4400');
  const [passcode, setPasscode] = useState('');
  const [discoveredProjects, setDiscoveredProjects] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (settings) {
      try { setWorkspaceRoots(JSON.parse(settings.workspace_roots || '[]')); } catch { setWorkspaceRoots([]); }
      setBaseDomain(settings.base_domain || 'localhost');
      setProxyPort(settings.proxy_port || '4400');
    }
  }, [settings]);

  const saveSettings = async (updates: Record<string, string>) => {
    try {
      await apiPut('/api/settings', updates);
      toast.success('Settings saved');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const addRoot = () => {
    if (!newRoot || workspaceRoots.includes(newRoot)) return;
    const updated = [...workspaceRoots, newRoot];
    setWorkspaceRoots(updated);
    saveSettings({ workspace_roots: JSON.stringify(updated) });
    setNewRoot('');
  };

  const removeRoot = (root: string) => {
    const updated = workspaceRoots.filter(r => r !== root);
    setWorkspaceRoots(updated);
    saveSettings({ workspace_roots: JSON.stringify(updated) });
  };

  const scanAll = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/discovery');
      const data = await res.json();
      setDiscoveredProjects(data.projects || []);
    } catch {}
    setScanning(false);
  };

  const importProject = async (path: string) => {
    try {
      await apiPost('/api/projects', { action: 'import', path });
      toast.success('Project imported');
      scanAll();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSetupPasscode = async () => {
    if (!passcode || passcode.length < 4) {
      toast.error('Passcode must be at least 4 characters');
      return;
    }
    try {
      await apiPost('/api/auth', { action: 'setup', passcode });
      toast.success('Passcode set and auth enabled');
      setPasscode('');
      refetchAuth();
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) return;
    await saveSettings(DEFAULT_SETTINGS);
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!settings) return <AppShell><div className="p-6 text-muted-foreground">Loading...</div></AppShell>;

  const subdomainRouting = settings.subdomain_routing === 'true';
  const portlessMode = settings.portless_mode === 'true';
  const bindMode = settings.bind_mode || 'localhost';
  const authEnabled = settings.auth_enabled === 'true';
  const urlPreview = `my-app.${baseDomain}${portlessMode ? '' : ':' + proxyPort}`;

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-[720px]">
        {/* Header */}
        <div className="animate-fade-up">
          <h2 className="text-[28px] font-bold tracking-tight font-display">Settings</h2>
          <p className="text-muted-foreground text-sm">Configure your development environment</p>
        </div>

        {/* Status Ribbon */}
        <div className="rounded-lg bg-card border border-border p-3 flex gap-6 animate-fade-up" style={{ animationDelay: '50ms' }}>
          <StatusDot active={subdomainRouting} label="Routing" onClick={() => scrollTo('routing')} />
          <StatusDot active={portlessMode} label="Portless" onClick={() => scrollTo('routing')} />
          <StatusDot active={bindMode === 'lan'} label="LAN" onClick={() => scrollTo('security')} />
          <StatusDot active={authEnabled} label="Auth" onClick={() => scrollTo('security')} />
        </div>

        {/* Workspace Roots */}
        <Card id="workspace" className="relative overflow-hidden animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-[18px] h-[18px] text-primary/60" />
                <CardTitle className="text-[15px] font-semibold font-display">Workspace Roots</CardTitle>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={scanAll} disabled={scanning}>
                {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                {scanning ? 'Scanning...' : 'Scan Projects'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Directories to scan for discoverable projects</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {workspaceRoots.map(root => (
                <div key={root} className="group flex items-center justify-between px-3 py-2.5 rounded-lg bg-background border border-border">
                  <span className="text-sm font-mono truncate">{root}</span>
                  <button
                    onClick={() => removeRoot(root)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newRoot}
                onChange={e => setNewRoot(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRoot()}
                placeholder="/Users/you/projects"
                className="font-mono"
              />
              <Button onClick={addRoot} disabled={!newRoot} size="sm" className="px-3">
                + Add
              </Button>
            </div>

            {discoveredProjects.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-dashed border-border" />
                  <span className="text-xs text-muted-foreground">Discovered ({discoveredProjects.length} found)</span>
                  <div className="flex-1 border-t border-dashed border-border" />
                </div>
                {discoveredProjects.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-background border border-border animate-fade-up"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium">{p.name}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 ${typeBadgeClass(p.type)}`}>{p.type}</Badge>
                      <span className="text-xs text-muted-foreground font-mono truncate">{p.path}</span>
                    </div>
                    {p.alreadyImported ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Check className="w-3 h-3" />
                        <span>Imported</span>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => importProject(p.path)}>Import</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Routing & Proxy */}
        <Card id="routing" className="relative overflow-hidden animate-fade-up" style={{ animationDelay: '150ms' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-[18px] h-[18px] text-cyan-400/60" />
              <CardTitle className="text-[15px] font-semibold font-display">Routing & Proxy</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Route *.localhost to project services</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toggle Group */}
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              <div className={`px-4 py-3.5 flex items-center justify-between transition-colors duration-200 ${subdomainRouting ? 'bg-primary/[0.03]' : ''}`}>
                <div>
                  <Label className="text-sm">Subdomain Routing</Label>
                  <p className="text-xs text-muted-foreground">Access projects via slug.{baseDomain}</p>
                </div>
                <Switch
                  checked={subdomainRouting}
                  onCheckedChange={v => saveSettings({ subdomain_routing: String(v) })}
                />
              </div>
              <div className={`px-4 py-3.5 flex items-center justify-between transition-colors duration-200 ${portlessMode ? 'bg-primary/[0.03]' : ''}`}>
                <div>
                  <Label className="text-sm">Portless Mode</Label>
                  <p className="text-xs text-muted-foreground">Remove port from URLs (requires Caddy)</p>
                </div>
                <Switch
                  checked={portlessMode}
                  onCheckedChange={v => saveSettings({ portless_mode: String(v) })}
                />
              </div>
            </div>

            {/* Portless Instructions */}
            <div
              className="grid transition-all duration-200"
              style={{ gridTemplateRows: portlessMode ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden min-h-0">
                <div className="p-3 rounded-lg bg-background border border-border font-mono text-xs space-y-1.5">
                  <p className="font-sans text-xs font-medium text-muted-foreground mb-2">Portless Mode Setup</p>
                  <p><span className="text-primary">$</span> brew install caddy</p>
                  <p><span className="text-primary">$</span> curl http://localhost:{proxyPort}/api/proxy/caddyfile &gt; /tmp/devhub-Caddyfile</p>
                  <p><span className="text-primary">$</span> sudo caddy run --config /tmp/devhub-Caddyfile</p>
                  <p className="text-muted-foreground pt-1">Or: <span className="text-primary">$</span> sudo ./scripts/install-portless.sh</p>
                </div>
              </div>
            </div>

            {/* Domain + Port */}
            <div className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2 items-center">
              <Label className="text-sm text-right">Base Domain</Label>
              <Input value={baseDomain} onChange={e => setBaseDomain(e.target.value)} className="font-mono" />
              <Label className="text-sm text-right">Proxy Port</Label>
              <Input value={proxyPort} onChange={e => setProxyPort(e.target.value)} className="font-mono" />
              <div />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">{urlPreview}</span>
                <Button size="sm" onClick={() => saveSettings({ base_domain: baseDomain, proxy_port: proxyPort })}>Save</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security & Access */}
        <Card id="security" className="relative overflow-hidden animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-[18px] h-[18px] text-muted-foreground/60" />
              <CardTitle className="text-[15px] font-semibold font-display">Security & Access</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Control network exposure and authentication</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toggle Group */}
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              <div className={`px-4 py-3.5 flex items-center justify-between transition-colors duration-200 ${bindMode === 'lan' ? 'bg-amber-500/[0.03]' : ''}`}>
                <div>
                  <Label className="text-sm">LAN Mode (0.0.0.0)</Label>
                  <p className="text-xs text-muted-foreground">Allow connections from other devices</p>
                </div>
                <Switch
                  checked={bindMode === 'lan'}
                  onCheckedChange={v => {
                    if (v && !confirm('Warning: LAN mode exposes DevHub to your local network. Are you sure?')) return;
                    saveSettings({ bind_mode: v ? 'lan' : 'localhost' });
                  }}
                />
              </div>
              {authInfo?.authEnabled && (
                <div className={`px-4 py-3.5 flex items-center justify-between transition-colors duration-200 ${authEnabled ? 'bg-primary/[0.03]' : ''}`}>
                  <div>
                    <Label className="text-sm">Auth Enabled</Label>
                    <p className="text-xs text-muted-foreground">Require passcode to access DevHub</p>
                  </div>
                  <Switch
                    checked={authEnabled}
                    onCheckedChange={v => saveSettings({ auth_enabled: String(v) })}
                  />
                </div>
              )}
            </div>

            {/* LAN Warning */}
            {bindMode === 'lan' && (
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-400">
                  LAN mode is active. DevHub is accessible from other devices on your network.
                  Passcode authentication is strongly recommended.
                </p>
              </div>
            )}

            {/* Passcode */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label className="text-sm">Passcode Authentication</Label>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${authInfo?.hasPasscode ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                  <span className={`text-[11px] ${authInfo?.hasPasscode ? 'text-primary' : 'text-muted-foreground'}`}>
                    {authInfo?.hasPasscode ? 'Active' : 'Not set'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={passcode}
                  onChange={e => setPasscode(e.target.value)}
                  placeholder={authInfo?.hasPasscode ? 'New passcode' : 'Set passcode (min 4 chars)'}
                />
                <Button onClick={handleSetupPasscode} disabled={!passcode}>
                  {authInfo?.hasPasscode ? 'Update' : 'Set Passcode'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="relative overflow-hidden animate-fade-up mt-4" style={{ animationDelay: '250ms' }}>
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-destructive/30" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Reset All Settings</p>
                <p className="text-xs text-muted-foreground mt-0.5">Restore all options to their default values</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleReset}
              >
                Reset Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
