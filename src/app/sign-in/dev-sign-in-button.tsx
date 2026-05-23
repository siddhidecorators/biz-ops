'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/browser';

// Dev-only password sign-in. Parent component decides whether to render this
// based on NODE_ENV — never expose in production.
export function DevSignInButton({
  email,
  password,
  next,
}: {
  email: string;
  password: string;
  next?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setPending(false);
      setError(authError.message);
      return;
    }
    router.push(next ?? '/');
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleSignIn}
        disabled={pending}
        variant="outline"
        className="h-11 w-full text-sm"
      >
        {pending ? 'Signing in…' : `Dev sign-in (${email})`}
      </Button>
      {error && (
        <p className="text-center text-xs text-destructive">
          {error}
        </p>
      )}
      <p className="text-center text-[11px] text-muted-foreground">
        Dev mode only — never shown in production.
      </p>
    </div>
  );
}
