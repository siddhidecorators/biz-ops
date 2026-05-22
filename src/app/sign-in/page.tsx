import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';

export const metadata = {
  title: 'Sign in · SmallBiz Ops',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next ?? '/');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">SmallBiz Ops</h1>
          <p className="text-sm text-muted-foreground">
            Customers, products, invoices — on your phone.
          </p>
        </div>

        <SignInButton next={next} />

        {error === 'auth_failed' && (
          <p className="text-center text-sm text-destructive">
            Sign-in failed. Try again.
          </p>
        )}
      </div>
    </main>
  );
}
