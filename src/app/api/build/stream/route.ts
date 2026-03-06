import { NextRequest } from 'next/server';
import { getFileWatcherManager, BuildPhase } from '@/lib/process/file-watcher';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const fw = getFileWatcherManager();

      const onStatus = (
        projectId: string,
        phase: BuildPhase,
        serviceName?: string,
        error?: string,
        restarted?: string[],
      ) => {
        const event = `data: ${JSON.stringify({ projectId, phase, serviceName, error, restarted })}\n\n`;
        try {
          controller.enqueue(encoder.encode(event));
        } catch {}
      };

      fw.on('build-status', onStatus);

      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepalive);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        fw.off('build-status', onStatus);
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
