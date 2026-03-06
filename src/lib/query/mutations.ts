'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

async function postJson(url: string, body?: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function putJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function deleteJson(url: string) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}

// --- Project mutations ---

export function useStartProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => postJson(`/api/projects/${projectId}/start`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.status });
      qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useStopProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => postJson(`/api/projects/${projectId}/stop`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.status });
      qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => deleteJson(`/api/projects/${projectId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
      qc.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
}

export function useImportProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => postJson('/api/projects', { action: 'import', path }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: { projectId: string; name?: string; slug?: string }) =>
      putJson(`/api/projects/${projectId}`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.project(vars.projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

// --- Service mutations ---

export function useStartService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) => postJson(`/api/services/${serviceId}/start`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
}

export function useStopService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) => postJson(`/api/services/${serviceId}/stop`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { project_id: string; name: string; command: string; desired_port?: number | null }) =>
      postJson('/api/services', body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.project(vars.project_id) });
    },
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, ...body }: { serviceId: string; name?: string; command?: string; desired_port?: number | null; env_json?: string; cwd?: string | null }) =>
      putJson(`/api/services/${serviceId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) => deleteJson(`/api/services/${serviceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
}

// --- Settings mutations ---

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Record<string, string>) => putJson('/api/settings', updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}

// --- Auth mutations ---

export function useSetupAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (passcode: string) => postJson('/api/auth', { action: 'setup', passcode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auth });
      qc.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}

// --- Stack mutations ---

export function useCreateStack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; project_ids: string[] }) => postJson('/api/stacks', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.stacks });
    },
  });
}

export function useStartStack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stackId: string) => postJson(`/api/stacks/${stackId}/start`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
}

export function useStopStack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stackId: string) => postJson(`/api/stacks/${stackId}/stop`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
}

export function useDeleteStack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stackId: string) => deleteJson(`/api/stacks/${stackId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.stacks });
    },
  });
}

// --- Env mutations ---

export function useUpdateEnv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, key, value }: { projectId: string; key: string; value: string | null }) =>
      putJson(`/api/projects/${projectId}/env`, { key, value }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.projectEnv(vars.projectId) });
    },
  });
}

// --- Updates mutations ---

export function useScanUpdates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, tools }: { projectId: string; tools: string[] }) =>
      postJson(`/api/projects/${projectId}/updates`, { action: 'scan', tools }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}
