'use client';

import { use } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ProjectDetail } from '@/components/projects/project-detail';

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell>
      <ProjectDetail projectId={id} />
    </AppShell>
  );
}
