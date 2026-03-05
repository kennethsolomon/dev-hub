import { NextResponse } from 'next/server';
import { getProcessManager } from '@/lib/process/manager';
import { getRoutingTable } from '@/lib/proxy/router';

export async function GET() {
  const pm = getProcessManager();
  // Rehydrate on first status check to recover from server restarts
  pm.rehydrateFromDb();

  const running = pm.getAllRunning().map(sp => ({
    serviceId: sp.serviceId,
    runId: sp.runId,
    pid: sp.pid || sp.process?.pid || null,
    assignedPort: sp.assignedPort,
  }));

  const routes = getRoutingTable();

  return NextResponse.json({ running, routes });
}
