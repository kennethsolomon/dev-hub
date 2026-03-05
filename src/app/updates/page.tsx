'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useApi, apiPost } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  const totalPackages = reports.reduce((acc, r) => acc + r.packages.length, 0);

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="animate-fade-up">
          <h2 className="text-[28px] font-bold tracking-tight font-display">Update Advisor</h2>
          <p className="text-muted-foreground text-sm">Check for outdated dependencies and track upgrade notes</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-up" style={{ animationDelay: '50ms' }}>
          {/* Project List */}
          <div className="space-y-1">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-3">Projects</h3>
            {projects?.map(p => (
              <button
                key={p.id}
                onClick={() => handleScan(p.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150 flex items-center justify-between relative ${
                  selectedProject === p.id
                    ? 'bg-primary/8 text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                }`}
              >
                {selectedProject === p.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <span>{p.name}</span>
                {selectedProject === p.id && totalPackages > 0 && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{totalPackages}</Badge>
                )}
              </button>
            ))}
          </div>

          {/* Update Report */}
          <div className="lg:col-span-2 space-y-4">
            {scanning && <p className="text-sm text-muted-foreground">Scanning dependencies...</p>}

            {reports.map((report, i) => (
              <Card key={i} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[15px] font-semibold">{report.tool} outdated</CardTitle>
                    <span className="text-xs text-muted-foreground">{report.packages.length} package{report.packages.length !== 1 ? 's' : ''}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {report.packages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">All dependencies are up to date.</p>
                  ) : (
                    <div className="space-y-0">
                      {report.packages.map((pkg, j) => (
                        <div key={j} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="flex items-center gap-2">
                            {pkg.isMajor && <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">MAJOR</Badge>}
                            <span className="text-sm font-mono">{pkg.name}</span>
                          </div>
                          <span className="text-xs font-mono text-muted-foreground">
                            {pkg.current} <span className="text-muted-foreground/50">&rarr;</span> {pkg.latest}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {report.packages.some(p => p.isMajor) && (
                    <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <p className="text-sm font-medium text-amber-400">Safe Update Checklist</p>
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
                  <CardTitle className="text-[15px] font-semibold">Upgrade Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Record upgrade notes..."
                    className="text-sm"
                  />
                  <Button size="sm" onClick={handleAddNote} disabled={!noteText}>Save Note</Button>

                  {notes.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {notes.map(note => (
                        <div key={note.id} className="p-3 rounded-lg bg-muted/50 text-sm">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span className="font-mono">{note.tool}</span>
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
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">Select a project to scan for updates.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
