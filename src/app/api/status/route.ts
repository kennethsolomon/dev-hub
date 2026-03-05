import { NextResponse } from 'next/server';
import { getProcessManager } from '@/lib/process/manager';
import { getRoutingTable } from '@/lib/proxy/router';

export async function GET() {
  const pm = getProcessManager();

  const running = pm.getAllRunning().map(sp => ({
    serviceId: sp.serviceId,
    runId: sp.runId,
    pid: sp.pid || sp.process?.pid || null,
    assignedPort: sp.assignedPort,
  }));

  const routes = getRoutingTable();

  return NextResponse.json({ running, routes });
}
