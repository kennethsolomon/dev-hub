'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiPost } from '@/lib/hooks/use-api';

export default function LoginPage() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/api/auth', { action: 'login', passcode });
      router.push('/');
    } catch {
      setError('Invalid passcode');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>DevHub</CardTitle>
          <p className="text-sm text-muted-foreground">Enter your passcode to continue</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              placeholder="Passcode"
              autoFocus
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={!passcode}>
              Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
