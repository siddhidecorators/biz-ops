import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UsersIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm, type OrgRow } from '@/app/onboarding/onboarding-form';
import { Card, CardContent } from '@/components/ui/card';
import { DeleteBusiness } from './_components/delete-business';
import { AppBar } from '../_components/app-bar';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, full_name, role')
    .eq('id', user.id)
    .maybeSingle<{ org_id: string; full_name: string | null; role: 'owner' | 'admin' | 'staff' }>();

  if (!profile) {
    return (
      <>
        <AppBar title="Settings" back={{ href: '/' }} />
        <main className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-xl font-medium">Profile not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Try signing out and back in.
          </p>
        </main>
      </>
    );
  }

  const { data: org } = await supabase
    .from('orgs')
    .select('*')
    .eq('id', profile.org_id)
    .maybeSingle<OrgRow>();

  if (!org) {
    return (
      <>
        <AppBar title="Settings" back={{ href: '/' }} />
        <main className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-xl font-medium">Org not found</h1>
        </main>
      </>
    );
  }

  return (
    <>
      <AppBar
        title="Business settings"
        subtitle={org.name}
        back={{ href: '/' }}
      />
      <main className="mx-auto max-w-2xl px-6 py-5">
        {profile.role === 'owner' && (
          <Link href="/settings/team" className="mb-5 block">
            <Card size="sm" className="transition-colors hover:bg-muted active:bg-muted">
              <CardContent className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-brand-tint text-primary">
                  <UsersIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Team</p>
                  <p className="text-xs text-muted-foreground">
                    Members, roles, and pending invites
                  </p>
                </div>
                <span aria-hidden className="text-muted-foreground">›</span>
              </CardContent>
            </Card>
          </Link>
        )}

        <p className="mb-5 text-sm text-muted-foreground">
          These details show up on invoices and quotes. Update anything and tap Save.
        </p>
        <OnboardingForm
          org={org}
          defaultSignatory={profile.full_name ?? user.user_metadata?.full_name ?? ''}
          defaultEmail={user.email ?? ''}
          submitLabel="Save changes"
        />

        {profile.role === 'owner' && <DeleteBusiness orgName={org.name} />}
      </main>
    </>
  );
}
