'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/browser';

export function SignInButton({ next }: { next?: string }) {
  const [pending, setPending] = useState(false);
  const supabase = createClient();

  async function handleSignIn() {
    setPending(true);
    const params = new URLSearchParams();
    if (next) params.set('next', next);
    const redirectTo = `${window.location.origin}/auth/callback${
      params.size ? `?${params.toString()}` : ''
    }`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) {
      setPending(false);
      console.error(error);
    }
  }

  return (
    <Button
      onClick={handleSignIn}
      disabled={pending}
      className="h-12 w-full text-base"
      size="lg"
    >
      {pending ? 'Redirecting…' : 'Sign in with Google'}
    </Button>
  );
}
