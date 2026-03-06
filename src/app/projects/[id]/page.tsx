import { AppShell } from '@/components/layout/app-shell';
import { ProjectDetail } from '@/components/projects/project-detail';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <ProjectDetail projectId={id} />
    </AppShell>
  );
}
