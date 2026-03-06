'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './keys';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    let message = `${res.status}: ${res.statusText}`;
    try { message = JSON.parse(text).error || message; } catch { if (process.env.NODE_ENV === 'development') console.warn('[fetchJson] Non-JSON error body:', text); }
    throw new Error(message);
  }
  return res.json();
}

// --- Shared types ---

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  path: string;
  type: string;
  service_count: number;
  primary_port: number | null;
}

export interface StatusData {
  running: Array<{ serviceId: string; runId: string; pid: number; assignedPort: number | null }>;
  routes: Array<{ slug: string; projectName: string; port: number; running: boolean; url: string }>;
}

export interface ProjectData {
  project: {
    id: string; name: string; slug: string; path: string; type: string;
    config_json: string | null; auto_build_enabled: number; build_command: string | null;
    watch_debounce_ms: number; created_at: string; updated_at: string;
  };
  services: Array<{
    id: string; name: string; command: string; desired_port: number | null;
    assigned_port: number | null; is_primary: number; restart_policy: string;
    depends_on_json: string; env_json: string; cwd: string | null;
    restart_on_watch: number; watch_build_command: string | null;
  }>;
  runs: Array<{
    id: string; service_id: string; status: string; pid: number | null;
    assigned_port: number | null; started_at: string; stopped_at: string | null;
    exit_code: number | null; log_path: string | null;
  }>;
}

export interface EnvVariable {
  key: string;
  fileValue: string | null;
  source: string | null;
  override: string | null;
  effective: string;
  isPort: boolean;
  isSecret: boolean;
  portStatus?: 'free' | 'in-use' | null;
}

export interface EnvData {
  files: string[];
  variables: EnvVariable[];
}

export interface PreflightResult {
  check: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  quickFix?: { label: string; action: string; args?: any };
}

export interface StackData {
  stacks: Array<{ id: string; name: string }>;
  items: Array<{ stack_id: string; project_id: string; project_name: string; slug: string; type: string; sort_order: number }>;
}

export interface AuthInfo {
  authEnabled: boolean;
  hasPasscode: boolean;
}

// --- Query hooks ---

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => fetchJson<ProjectRow[]>('/api/projects'),
  });
}

export function useStatus() {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: () => fetchJson<StatusData>('/api/status'),
    staleTime: 2_000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => fetchJson<ProjectData>(`/api/projects/${id}`),
  });
}

export function useProjectEnv(id: string) {
  return useQuery({
    queryKey: queryKeys.projectEnv(id),
    queryFn: () => fetchJson<EnvData>(`/api/projects/${id}/env`),
  });
}

export function usePreflight(id: string) {
  return useQuery({
    queryKey: queryKeys.preflight(id),
    queryFn: () => fetchJson<PreflightResult[]>(`/api/projects/${id}/preflight`),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => fetchJson<Record<string, string>>('/api/settings'),
    staleTime: 30_000,
  });
}

export function useAuth() {
  return useQuery({
    queryKey: queryKeys.auth,
    queryFn: () => fetchJson<AuthInfo>('/api/auth'),
  });
}

export function useStacks() {
  return useQuery({
    queryKey: queryKeys.stacks,
    queryFn: () => fetchJson<StackData>('/api/stacks'),
  });
}
