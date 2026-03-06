import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock instrumentation.node to avoid pulling in shutdown/db dependencies
const mockNodeRegister = vi.fn();
vi.mock('../instrumentation.node', () => ({
  register: mockNodeRegister,
}));

describe('instrumentation.ts', () => {
  const originalRuntime = process.env.NEXT_RUNTIME;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    if (originalRuntime === undefined) {
      delete process.env.NEXT_RUNTIME;
    } else {
      process.env.NEXT_RUNTIME = originalRuntime;
    }
  });

  it('should call instrumentation.node.register() when NEXT_RUNTIME is nodejs', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    const { register } = await import('../instrumentation');
    await register();
    expect(mockNodeRegister).toHaveBeenCalledOnce();
  });

  it('should NOT call instrumentation.node.register() when NEXT_RUNTIME is edge', async () => {
    process.env.NEXT_RUNTIME = 'edge';
    const { register } = await import('../instrumentation');
    await register();
    expect(mockNodeRegister).not.toHaveBeenCalled();
  });

  it('should NOT call instrumentation.node.register() when NEXT_RUNTIME is unset', async () => {
    delete process.env.NEXT_RUNTIME;
    const { register } = await import('../instrumentation');
    await register();
    expect(mockNodeRegister).not.toHaveBeenCalled();
  });

  it('onRequestError should be a no-op function', async () => {
    const { onRequestError } = await import('../instrumentation');
    await expect(onRequestError()).resolves.toBeUndefined();
  });
});
