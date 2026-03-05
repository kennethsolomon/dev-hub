import { NextRequest } from 'next/server';
import { getProcessManager } from '@/lib/process/manager';

export async function GET(req: NextRequest) {
  const serviceId = req.nextUrl.searchParams.get('serviceId');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const pm = getProcessManager();

      const onLog = (sid: string, _runId: string, data: { timestamp: string; stream: string; text: string }) => {
        if (serviceId && sid !== serviceId) return;
        const event = `data: ${JSON.stringify({ serviceId: sid, ...data })}\n\n`;
        try {
          controller.enqueue(encoder.encode(event));
        } catch {
          // Stream closed
        }
      };

      const onExit = (sid: string, _runId: string, data: { code: number | null; signal: string | null }) => {
        if (serviceId && sid !== serviceId) return;
        const event = `data: ${JSON.stringify({ serviceId: sid, type: 'exit', ...data })}\n\n`;
        try {
          controller.enqueue(encoder.encode(event));
        } catch {}
      };

      pm.on('log', onLog);
      pm.on('exit', onExit);

      // Send keepalive
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepalive);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        pm.off('log', onLog);
        pm.off('exit', onExit);
        clearInterval(keepalive);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
