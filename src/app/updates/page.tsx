'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useApi, apiPost } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  type: string;
}

interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  isMajor: boolean;
}

interface UpdateReport {
  tool: string;
  packages: OutdatedPackage[];
  scannedAt: string;
}

interface UpgradeNote {
  id: string;
  created_at: string;
  tool: string;
  summary: string;
  details_json: string | null;
}

export default function UpdatesPage() {
  const { data: projects } = useApi<Project[]>('/api/projects');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [reports, setReports] = useState<UpdateReport[]>([]);
  const [notes, setNotes] = useState<UpgradeNote[]>([]);
  const [scanning, setScanning] = useState(false);
  const [noteText, setNoteText] = useState('');

  const handleScan = async (projectId: string) => {
    setScanning(true);
    setSelectedProject(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}/updates`);
      const data = await res.json();
      setReports(data.reports || []);
      setNotes(data.notes || []);
    } catch (err: any) {
      toast.error(err.message);
    }
    setScanning(false);
  };

  const handleAddNote = async () => {
    if (!selectedProject || !noteText) return;
    try {
      await apiPost(`/api/projects/${selectedProject}/updates`, {
        tool: 'manual',
        summary: noteText,
      });
      toast.success('Note saved');
      setNoteText('');
      handleScan(selectedProject);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Update Advisor</h2>
          <p className="text-muted-foreground text-sm">Check for outdated dependencies and track upgrade notes</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Projects</h3>
            {projects?.map(p => (
              <button
                key={p.id}
                onClick={() => handleScan(p.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedProject === p.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                }`}
              >
                {p.name}
                <Badge variant="outline" className="ml-2 text-xs">{p.type}</Badge>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {scanning && <p className="text-sm text-muted-foreground">Scanning dependencies...</p>}

            {reports.map((report, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{report.tool} outdated</CardTitle>
                    <span className="text-xs text-muted-foreground">{report.packages.length} packages</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {report.packages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">All dependencies are up to date.</p>
                  ) : (
                    <div className="space-y-1">
                      {report.packages.map((pkg, j) => (
                        <div key={j} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                          <div className="flex items-center gap-2">
                            {pkg.isMajor && <Badge variant="destructive" className="text-xs">MAJOR</Badge>}
                            <span className="text-sm font-mono">{pkg.name}</span>
                          </div>
                          <span className="text-xs font-mono text-muted-foreground">
                            {pkg.current} -&gt; {pkg.latest}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {report.packages.some(p => p.isMajor) && (
                    <div className="mt-4 p-3 rounded-md bg-yellow-500/5 border border-yellow-500/20">
                      <p className="text-sm font-medium text-yellow-400">Safe Update Checklist</p>
                      <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                        <li>Review changelog for breaking changes</li>
                        <li>Run full test suite after updating</li>
                        <li>Diff lockfile to verify only expected changes</li>
                        <li>Record notes below for future reference</li>
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {selectedProject && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Upgrade Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Record upgrade notes..."
                      className="text-sm"
                    />
                  </div>
                  <Button size="sm" onClick={handleAddNote} disabled={!noteText}>Save Note</Button>

                  {notes.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {notes.map(note => (
                        <div key={note.id} className="p-2 rounded bg-muted/50 text-sm">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{note.tool}</span>
                            <span>{new Date(note.created_at).toLocaleDateString()}</span>
                          </div>
                          <p>{note.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!selectedProject && (
              <p className="text-muted-foreground text-sm">Select a project to scan for updates.</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
