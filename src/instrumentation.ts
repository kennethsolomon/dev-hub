export async function onRequestError() {
  // Required export — Next.js instrumentation hook
}

export async function register() {
  // Only register on the server (not edge runtime)
  if (typeof window === 'undefined') {
    const { registerShutdownHandlers } = await import('./lib/process/shutdown');
    registerShutdownHandlers();
  }
}
