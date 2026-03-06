import { registerShutdownHandlers } from './lib/process/shutdown';
import { getFileWatcherManager } from './lib/process/file-watcher';

export function register() {
  registerShutdownHandlers();
  getFileWatcherManager().rehydrate();
}
