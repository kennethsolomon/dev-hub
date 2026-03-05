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
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

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

  if (!settings) return <AppShell><div className="p-6">Loading...</div></AppShell>;

  const subdomainRouting = settings.subdomain_routing === 'true';
  const portlessMode = settings.portless_mode === 'true';
  const bindMode = settings.bind_mode || 'localhost';

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>

        {/* Workspace Roots */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workspace Roots</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Directories to scan for discoverable projects.
            </p>
            <div className="space-y-2">
              {workspaceRoots.map(root => (
                <div key={root} className="flex items-center justify-between px-3 py-2 rounded bg-muted/50">
                  <span className="text-sm font-mono">{root}</span>
                  <Button size="sm" variant="ghost" onClick={() => removeRoot(root)}>Remove</Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newRoot}
                onChange={e => setNewRoot(e.target.value)}
                placeholder="/Users/you/projects"
              />
              <Button onClick={addRoot} disabled={!newRoot}>Add</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={scanAll} disabled={scanning}>
                {scanning ? 'Scanning...' : 'Scan for Projects'}
              </Button>
            </div>

            {discoveredProjects.length > 0 && (
              <div className="space-y-2 mt-4">
                <h4 className="text-sm font-medium">Discovered Projects</h4>
                {discoveredProjects.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded bg-muted/50">
                    <div>
                      <span className="text-sm">{p.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">{p.type}</Badge>
                      <span className="text-xs text-muted-foreground ml-2">{p.path}</span>
                    </div>
                    {p.alreadyImported ? (
                      <Badge variant="secondary" className="text-xs">Imported</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => importProject(p.path)}>Import</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Routing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subdomain Routing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Subdomain Routing</Label>
                <p className="text-xs text-muted-foreground">Access projects via slug.{baseDomain}</p>
              </div>
              <Switch
                checked={subdomainRouting}
                onCheckedChange={v => saveSettings({ subdomain_routing: String(v) })}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Portless Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Remove port from URLs (requires Caddy + one-time sudo setup)
                </p>
              </div>
              <Switch
                checked={portlessMode}
                onCheckedChange={v => saveSettings({ portless_mode: String(v) })}
              />
            </div>

            {portlessMode && (
              <div className="p-3 rounded bg-muted/50 text-sm space-y-2">
                <p className="font-medium">Portless Mode Setup</p>
                <p className="text-xs text-muted-foreground">
                  1. Install Caddy: <code>brew install caddy</code><br />
                  2. Generate Caddyfile: <code>curl http://localhost:{proxyPort}/api/proxy/caddyfile &gt; /tmp/devhub-Caddyfile</code><br />
                  3. Run: <code>sudo caddy run --config /tmp/devhub-Caddyfile</code><br />
                  Or use the install script: <code>sudo ./scripts/install-portless.sh</code>
                </p>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label>Base Domain</Label>
              <div className="flex gap-2">
                <Input value={baseDomain} onChange={e => setBaseDomain(e.target.value)} />
                <Button onClick={() => saveSettings({ base_domain: baseDomain })}>Save</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Proxy Port</Label>
              <div className="flex gap-2">
                <Input value={proxyPort} onChange={e => setProxyPort(e.target.value)} />
                <Button onClick={() => saveSettings({ proxy_port: proxyPort })}>Save</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bind Mode / Security */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security & Network</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>LAN Mode (0.0.0.0)</Label>
                <p className="text-xs text-muted-foreground">
                  Allow connections from other devices on your network
                </p>
              </div>
              <Switch
                checked={bindMode === 'lan'}
                onCheckedChange={v => {
                  if (v && !confirm('Warning: LAN mode exposes DevHub to your local network. Are you sure?')) return;
                  saveSettings({ bind_mode: v ? 'lan' : 'localhost' });
                }}
              />
            </div>

            {bindMode === 'lan' && (
              <div className="p-3 rounded bg-red-500/5 border border-red-500/20 text-sm text-red-400">
                LAN mode is active. DevHub is accessible from other devices on your network.
                Passcode authentication is strongly recommended.
              </div>
            )}

            <Separator />

            <div>
              <Label>Passcode Authentication</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {authInfo?.hasPasscode ? 'Passcode is set. Auth is enabled.' : 'No passcode set yet.'}
              </p>
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

            {authInfo?.authEnabled && (
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auth Enabled</Label>
                  <p className="text-xs text-muted-foreground">Require passcode to access DevHub</p>
                </div>
                <Switch
                  checked={settings.auth_enabled === 'true'}
                  onCheckedChange={v => saveSettings({ auth_enabled: String(v) })}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
