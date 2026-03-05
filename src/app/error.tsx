'use client';

import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold">Something went wrong</h2>
        <p className="text-muted-foreground text-sm">{error.message}</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={reset}>Try again</Button>
          <a href="/"><Button variant="outline">Back to Dashboard</Button></a>
        </div>
      </div>
    </div>
  );
}
