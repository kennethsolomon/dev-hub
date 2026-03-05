import { exec } from 'child_process';

export function execAsync(cmd: string, opts: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, opts, (error, stdout, stderr) => {
      if (error) {
        (error as any).stdout = stdout;
        (error as any).stderr = stderr;
        reject(error);
      } else {
        resolve(String(stdout));
      }
    });
  });
}
