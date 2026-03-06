import { getDb, closeDb } from '../db';

const SHUTDOWN_TIMEOUT = 30_000;

let shutdownInProgress = false;

export function registerShutdownHandlers(): void {
  const handler = async (signal: string) => {
    if (shutdownInProgress) return;
    shutdownInProgress = true;

    console.log(`[DevHub] Received ${signal}, shutting down...`);

    try {
      const db = getDb();
      const row = db.prepare("SELECT value FROM settings WHERE key = 'stop_all_on_exit'").get() as { value: string } | undefined;
      const stopAll = !row || row.value !== 'false'; // default: enabled

      if (stopAll) {
        // Dynamic import to avoid circular dependency
        const { getProcessManager } = await import('./manager');
        const pm = getProcessManager();
        const running = pm.getAllRunning();

        if (running.length > 0) {
          console.log(`[DevHub] Stopping ${running.length} running service(s)...`);

          const stopAll = Promise.all(
            running.map(sp =>
              pm.stopService(sp.serviceId).catch(err =>
                console.error(`[DevHub] Failed to stop ${sp.serviceId}:`, err?.message)
              )
            )
          );

          // Global timeout so shutdown doesn't hang
          await Promise.race([
            stopAll,
            new Promise<void>(resolve => setTimeout(() => {
              console.warn('[DevHub] Shutdown timeout reached, forcing exit');
              resolve();
            }, SHUTDOWN_TIMEOUT)),
          ]);

          console.log('[DevHub] All services stopped');
        }
      } else {
        console.log('[DevHub] "Stop all on exit" is disabled, leaving services running');
      }
    } catch (err) {
      console.error('[DevHub] Shutdown error:', err);
    }

    closeDb();

    // Re-raise the signal so Next.js (and Node) can do its own cleanup.
    // Remove our handler first to avoid infinite loop.
    process.removeListener(signal, handler as any);
    process.kill(process.pid, signal);
  };

  // Use 'on' (not 'once') so the handler stays registered across HMR cycles.
  // The shutdownInProgress flag prevents double execution.
  // Prepend with process.prependListener so we run BEFORE Next.js's handler.
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.prependListener(sig, () => handler(sig));
  }

  console.log('[DevHub] Shutdown handlers registered');
}
