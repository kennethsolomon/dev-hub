export const queryKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  projectEnv: (id: string) => ['projects', id, 'env'] as const,
  preflight: (id: string) => ['projects', id, 'preflight'] as const,
  status: ['status'] as const,
  settings: ['settings'] as const,
  auth: ['auth'] as const,
  stacks: ['stacks'] as const,
};
