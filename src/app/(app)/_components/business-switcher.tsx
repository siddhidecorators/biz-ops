'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { del } from 'idb-keyval';
import {
  ChevronsUpDownIcon,
  CheckIcon,
  PlusIcon,
  Building2Icon,
  MailIcon,
  SettingsIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/browser';
import { ORG_ROLE_LABELS, type OrgRole } from '@/lib/enums';
import { cn } from '@/lib/utils';

// Must match the persisted-cache key in query-provider.tsx — we wipe it on a
// business switch so Business A's rows can't show under Business B.
const RQ_CACHE_KEY = 'smallbiz-ops:rq-cache';

type OrgRow = {
  org_id: string;
  name: string;
  logo_url: string | null;
  role: OrgRole;
  settings_complete: boolean;
  is_active: boolean;
};
type InviteRow = { org_id: string; org_name: string; role: OrgRole; created_at: string };

async function fetchMyOrgs(): Promise<OrgRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('list_my_orgs');
  if (error) throw error;
  return (data ?? []) as OrgRow[];
}
async function fetchMyInvites(): Promise<InviteRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('list_my_invites');
  if (error) throw error;
  return (data ?? []) as InviteRow[];
}

export const orgSwitcherKeys = {
  orgs: ['my-orgs'] as const,
  invites: ['my-invites'] as const,
};

export function BusinessSwitcher({
  currentOrgName,
  variant = 'header',
}: {
  currentOrgName: string;
  variant?: 'header' | 'row';
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: orgs = [] } = useQuery({
    queryKey: orgSwitcherKeys.orgs,
    queryFn: fetchMyOrgs,
    enabled: open,
    initialData: [],
  });
  // Invites load eagerly so the trigger can show a badge.
  const { data: invites = [] } = useQuery({
    queryKey: orgSwitcherKeys.invites,
    queryFn: fetchMyInvites,
    staleTime: 60_000,
  });

  async function hardReset(to: string) {
    queryClient.clear();
    try {
      await del(RQ_CACHE_KEY);
    } catch {
      /* best effort */
    }
    window.location.href = to;
  }

  async function switchTo(orgId: string) {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('switch_active_org', { p_org_id: orgId });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    await hardReset('/');
  }

  async function acceptInvite(orgId: string) {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('accept_invite', { p_org_id: orgId });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    await supabase.rpc('switch_active_org', { p_org_id: orgId });
    await hardReset('/');
  }

  async function addBusiness() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('create_additional_org', { p_name: name });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    // The new business isn't set up yet -> finish onboarding (the layout gate
    // would route there anyway).
    await hardReset('/onboarding');
  }

  const inviteCount = invites.length;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setAdding(false); }}>
      <DialogPrimitive.Trigger
        aria-label="Switch business"
        className={cn(
          'group flex items-center gap-1.5 outline-none',
          variant === 'header'
            ? 'min-w-0 max-w-full rounded-lg px-1 py-0.5 -ml-1 hover:bg-muted'
            : 'w-full rounded-xl border border-border bg-card p-3 hover:bg-muted/60',
        )}
      >
        {variant === 'row' && (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-tint text-primary">
            <Building2Icon className="size-4" />
          </span>
        )}
        <span className="min-w-0 flex-1 text-left">
          <span
            className={cn(
              'block truncate font-medium tracking-tight',
              variant === 'header' ? 'text-base leading-tight' : 'text-sm',
            )}
          >
            {currentOrgName}
          </span>
          {variant === 'row' && (
            <span className="block text-xs text-muted-foreground">
              Switch, add, or accept an invite
            </span>
          )}
        </span>
        {inviteCount > 0 && (
          <span className="grid size-4 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {inviteCount}
          </span>
        )}
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-foreground/30 duration-200 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-popover pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl ring-1 ring-foreground/10 duration-200 outline-none data-open:animate-in data-open:slide-in-from-bottom-6 data-closed:animate-out data-closed:slide-out-to-bottom-6">
          <div aria-hidden className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-border" />
          <DialogPrimitive.Title className="text-overline shrink-0 px-5 py-2">
            Your businesses
          </DialogPrimitive.Title>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
            {/* Businesses */}
            <div className="space-y-1.5">
              {orgs.map((o) => (
                <button
                  key={o.org_id}
                  type="button"
                  disabled={busy}
                  onClick={() => (o.is_active ? setOpen(false) : switchTo(o.org_id))}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors disabled:opacity-60',
                    o.is_active ? 'bg-brand-tint' : 'hover:bg-muted/60',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-full',
                      o.is_active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Building2Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-medium', o.is_active && 'text-primary')}>
                      {o.name || 'Untitled business'}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {ORG_ROLE_LABELS[o.role]}
                      {!o.settings_complete && ' · setup incomplete'}
                    </span>
                  </span>
                  {o.is_active && <CheckIcon className="size-5 shrink-0 text-primary" />}
                </button>
              ))}
            </div>

            {/* Add business */}
            {adding ? (
              <div className="mt-2 rounded-xl border border-border p-3">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New business name"
                  className="h-11"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addBusiness();
                  }}
                />
                <div className="mt-2 flex gap-2">
                  <Button type="button" className="h-10 flex-1" disabled={busy || !newName.trim()} onClick={addBusiness}>
                    {busy ? 'Creating…' : 'Create & set up'}
                  </Button>
                  <Button type="button" variant="outline" className="h-10" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-1.5 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-primary transition-colors hover:bg-muted/60"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-tint">
                  <PlusIcon className="size-4" />
                </span>
                <span className="text-sm font-medium">Add a business</span>
              </button>
            )}

            {/* Pending invitations */}
            {inviteCount > 0 && (
              <div className="mt-3">
                <p className="text-overline px-3 pt-1 pb-1.5">Invitations</p>
                <div className="space-y-1.5">
                  {invites.map((inv) => (
                    <div key={inv.org_id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-info-tint text-info-strong">
                        <MailIcon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{inv.org_name}</span>
                        <span className="block text-xs text-muted-foreground">
                          Join as {ORG_ROLE_LABELS[inv.role]}
                        </span>
                      </span>
                      <Button type="button" size="sm" className="h-9" disabled={busy} onClick={() => acceptInvite(inv.org_id)}>
                        Accept
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer: settings link */}
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center gap-3 rounded-xl px-3 py-3 text-muted-foreground transition-colors hover:bg-muted/60"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">
                <SettingsIcon className="size-4" />
              </span>
              <span className="text-sm font-medium">Business settings</span>
            </Link>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
