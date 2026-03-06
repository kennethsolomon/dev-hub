export async function onRequestError() {
  // Required export — Next.js instrumentation hook
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const mod = await import('./instrumentation.node');
    mod.register();
  }
}
