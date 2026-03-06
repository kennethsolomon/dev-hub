'use client';

import { useState } from 'react';
import { useProjects } from '@/lib/query/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronRight, Loader2, RefreshCw, Package } from 'lucide-react';

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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function severityWidth(pkg: OutdatedPackage): number {
  const currentMajor = parseInt(pkg.current.replace(/^v/, '').split('.')[0], 10) || 0;
  const latestMajor = parseInt(pkg.latest.replace(/^v/, '').split('.')[0], 10) || 0;
  const delta = latestMajor - currentMajor;
  if (delta <= 0) return 1;
  if (delta === 1) return 2;
  if (delta === 2) return 3;
  if (delta === 3) return 4;
  return Math.min(delta, 6);
}

function packageType(pkg: OutdatedPackage): 'major' | 'minor' | 'patch' {
  if (pkg.isMajor) return 'major';
  const currentParts = pkg.current.replace(/^v/, '').split('.').map(Number);
  const latestParts = pkg.latest.replace(/^v/, '').split('.').map(Number);
  if ((latestParts[1] ?? 0) > (currentParts[1] ?? 0)) return 'minor';
  return 'patch';
}

export function UpdatesPageContent() {
  const { data: projects } = useProjects();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [reports, setReports] = useState<UpdateReport[]>([]);
  const [notes, setNotes] = useState<UpgradeNote[]>([]);
  const [scanning, setScanning] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const handleScan = async (projectId: string) => {
    setScanning(true);
    setSelectedProject(projectId);
    setCheckedItems(new Set());
    try {
      const res = await fetch(`/api/projects/${projectId}/updates`);
      const data = await res.json();
      setReports(data.reports || []);
      setNotes(data.notes || []);
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    }
    setScanning(false);
  };

  const handleAddNote = async () => {
    if (!selectedProject || !noteText) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'manual', summary: noteText }),
      });
      if (!res.ok) throw new Error('Failed to save note');
      toast.success('Note saved');
      setNoteText('');
      handleScan(selectedProject);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleCheck = (i: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const allPackages = reports.flatMap(r => r.packages);
  const totalOutdated = allPackages.length;
  const majorCount = allPackages.filter(p => p.isMajor).length;
  const minorPatchCount = totalOutdated - majorCount;
  const hasMajor = majorCount > 0;

  const sortedPackages = (pkgs: OutdatedPackage[]) => {
    return [...pkgs].sort((a, b) => {
      const typeOrder = { major: 0, minor: 1, patch: 2 };
      return typeOrder[packageType(a)] - typeOrder[packageType(b)];
    });
  };

  const selectedProjectName = projects?.find(p => p.id === selectedProject)?.name;

  const checklist = [
    'Review changelog for breaking changes',
    'Run full test suite after updating',
    'Diff lockfile to verify only expected changes',
    'Record notes below for future reference',
  ];

  const toolBadgeClass = (tool: string) => {
    switch (tool) {
      case 'npm': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'composer': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <h2 className="text-[28px] font-bold tracking-tight font-display">Update Advisor</h2>
        <p className="text-muted-foreground text-sm">Check for outdated dependencies and track upgrade notes</p>
      </div>

      {/* Summary Stats */}
      {selectedProject && !scanning && totalOutdated > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up" style={{ animationDelay: '50ms' }}>
          <div className="rounded-lg border border-border bg-card p-4 border-l-2 border-l-foreground/20">
            <p className="text-2xl font-bold font-display">{totalOutdated}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total outdated</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 border-l-2 border-l-amber-500/50">
            <p className="text-2xl font-bold font-display text-amber-400">{majorCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Major updates</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 border-l-2 border-l-cyan-500/50">
            <p className="text-2xl font-bold font-display text-cyan-400">{minorPatchCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Minor / patch</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 border-l-2 border-l-primary/50">
            <p className="text-2xl font-bold font-display text-primary">{reports.filter(r => r.packages.length === 0).length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Up to date</p>
          </div>
        </div>
      )}

      {/* Project Selector Pills */}
      <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {projects?.map(p => {
            const isActive = selectedProject === p.id;
            const projectPkgCount = isActive ? totalOutdated : null;
            const isUpToDate = isActive && !scanning && totalOutdated === 0 && reports.length > 0;
            return (
              <button
                key={p.id}
                onClick={() => handleScan(p.id)}
                className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-all duration-150 border ${
                  isActive
                    ? 'bg-primary/8 text-foreground font-medium border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border-transparent'
                }`}
              >
                <span>{p.name}</span>
                {isActive && scanning && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                )}
                {isActive && !scanning && isUpToDate && (
                  <Check className="w-3.5 h-3.5 text-primary" />
                )}
                {isActive && !scanning && projectPkgCount !== null && projectPkgCount > 0 && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs h-5 px-1.5">{projectPkgCount}</Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scanning Skeleton */}
      {scanning && (
        <div className="space-y-4 animate-fade-up">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Scanning dependencies for {selectedProjectName}...</span>
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-12 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Package Reports */}
      {!scanning && reports.map((report, i) => (
        <Card key={i} className="animate-fade-up" style={{ animationDelay: `${150 + i * 50}ms` }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-[15px] font-semibold">{report.tool} outdated</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {report.packages.length} package{report.packages.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{relativeTime(report.scannedAt)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => selectedProject && handleScan(selectedProject)}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {report.packages.length === 0 ? (
              <div className="flex items-center gap-2 py-4">
                <Check className="w-4 h-4 text-primary" />
                <p className="text-sm text-muted-foreground">All dependencies are up to date.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border mb-1">
                  <span className="flex-1 min-w-0">Package</span>
                  <span className="w-20 text-right">Current</span>
                  <span className="w-20 text-right">Latest</span>
                  <span className="w-16 text-center">Type</span>
                  <span className="w-16 text-center hidden sm:block">Severity</span>
                </div>

                {sortedPackages(report.packages).map((pkg, j) => {
                  const type = packageType(pkg);
                  const severity = severityWidth(pkg);
                  const isFirstMinor = j > 0 && packageType(sortedPackages(report.packages)[j - 1]) === 'major' && type !== 'major';

                  return (
                    <div key={j}>
                      {isFirstMinor && (
                        <div className="border-b border-border/50 my-1" />
                      )}
                      <div
                        className="flex items-center gap-4 px-2 py-2.5 rounded-md transition-colors hover:bg-white/[0.02] animate-fade-up"
                        style={{ animationDelay: `${200 + j * 30}ms` }}
                      >
                        <span className="flex-1 min-w-0 text-sm font-mono truncate">{pkg.name}</span>
                        <span className="w-20 text-right text-xs font-mono text-muted-foreground">{pkg.current}</span>
                        <span className="w-20 text-right text-xs font-mono text-foreground">{pkg.latest}</span>
                        <span className="w-16 text-center">
                          {type === 'major' && (
                            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5">MAJOR</Badge>
                          )}
                          {type === 'minor' && (
                            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px] px-1.5">minor</Badge>
                          )}
                          {type === 'patch' && (
                            <Badge className="bg-muted text-muted-foreground border-border text-[10px] px-1.5">patch</Badge>
                          )}
                        </span>
                        <span className="w-16 justify-center hidden sm:flex">
                          <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                type === 'major' ? 'bg-amber-500' : type === 'minor' ? 'bg-cyan-500' : 'bg-muted-foreground/30'
                              }`}
                              style={{ width: `${(severity / 6) * 100}%` }}
                            />
                          </div>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {hasMajor && report.packages.some(p => p.isMajor) && (
              <div className="mt-4 rounded-lg bg-amber-500/5 border border-amber-500/20 border-l-2 border-l-amber-500/40 overflow-hidden">
                <button
                  onClick={() => setChecklistOpen(!checklistOpen)}
                  className="w-full flex items-center gap-2 p-3 text-left hover:bg-amber-500/5 transition-colors"
                >
                  {checklistOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-amber-400">Safe Update Checklist</span>
                  <span className="text-xs text-muted-foreground ml-auto">{checkedItems.size}/{checklist.length}</span>
                </button>
                {checklistOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    {checklist.map((item, ci) => (
                      <label key={ci} className="flex items-center gap-2.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        <Checkbox
                          checked={checkedItems.has(ci)}
                          onCheckedChange={() => toggleCheck(ci)}
                          className="h-3.5 w-3.5"
                        />
                        <span className={checkedItems.has(ci) ? 'line-through opacity-50' : ''}>{item}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Upgrade Notes */}
      {!scanning && selectedProject && (
        <Card className="animate-fade-up" style={{ animationDelay: '250ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold">Upgrade Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Record upgrade notes..."
                className="text-sm min-h-[80px]"
              />
              <Button size="sm" onClick={handleAddNote} disabled={!noteText}>Save Note</Button>
            </div>

            {notes.length > 0 && (
              <div className="relative space-y-0 mt-2">
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                {notes.map((note, ni) => (
                  <div
                    key={note.id}
                    className="relative flex gap-3 py-2.5 animate-fade-up"
                    style={{ animationDelay: `${ni * 40}ms` }}
                  >
                    <div className="w-[23px] shrink-0 flex justify-center pt-1 relative z-10">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                    </div>
                    <div className="flex-1 min-w-0 rounded-lg bg-muted/30 border border-border/50 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge variant="outline" className={`text-[10px] px-1.5 ${toolBadgeClass(note.tool)}`}>
                          {note.tool}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {relativeTime(note.created_at)}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">{note.summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!selectedProject && (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-up" style={{ animationDelay: '150ms' }}>
          <Package className="w-10 h-10 text-primary/30 mb-4" />
          <p className="text-muted-foreground text-sm">Select a project above to scan for outdated dependencies.</p>
        </div>
      )}
    </div>
  );
}
