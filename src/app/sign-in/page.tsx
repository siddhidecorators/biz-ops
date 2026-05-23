import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { DevSignInButton } from './dev-sign-in-button';

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

  // Read dev creds at request time. NEXT_PUBLIC_ means they're embedded in
  // the client bundle — that's fine because the surrounding NODE_ENV check
  // means this branch is dead-code-eliminated in production builds.
  const devEmail =
    process.env.NODE_ENV === 'development'
      ? process.env.NEXT_PUBLIC_DEV_TEST_EMAIL
      : undefined;
  const devPassword =
    process.env.NODE_ENV === 'development'
      ? process.env.NEXT_PUBLIC_DEV_TEST_PASSWORD
      : undefined;
  const showDevButton = !!(devEmail && devPassword);

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

        {showDevButton && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>
            <DevSignInButton email={devEmail!} password={devPassword!} next={next} />
          </>
        )}

        {error === 'auth_failed' && (
          <p className="text-center text-sm text-destructive">
            Sign-in failed. Try again.
          </p>
        )}
      </div>
    </main>
  );
}
