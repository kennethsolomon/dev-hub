import { registerShutdownHandlers } from './lib/process/shutdown';

export function register() {
  registerShutdownHandlers();
}
