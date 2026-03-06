import { AppShell } from '@/components/layout/app-shell';
import { Dashboard } from '@/components/dashboard/dashboard';

export default function Home() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}
