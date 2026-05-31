'use client';

import { useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Trash2Icon, MailIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ORG_ROLES, ORG_ROLE_LABELS, type OrgRole } from '@/lib/enums';
import { createClient } from '@/lib/supabase/browser';
import {
  teamKeys,
  fetchMembers,
  fetchInvites,
  type MemberRow,
  type InviteRow,
} from '@/lib/queries/team';

const INVITABLE_ROLES: ReadonlyArray<OrgRole> = ORG_ROLES.filter(
  (r) => r !== 'owner',
);

export function TeamClient({
  orgId,
  selfUserId,
  initialMembers,
  initialInvites,
}: {
  orgId: string;
  selfUserId: string;
  initialMembers: MemberRow[];
  initialInvites: InviteRow[];
}) {
  const { data: members = initialMembers } = useQuery({
    queryKey: teamKeys.members(),
    queryFn: fetchMembers,
    initialData: initialMembers,
  });
  const { data: invites = initialInvites } = useQuery({
    queryKey: teamKeys.invites(),
    queryFn: fetchInvites,
    initialData: initialInvites,
  });

  return (
    <div className="space-y-5">
      <InviteForm orgId={orgId} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <p className="text-xs text-muted-foreground">
            {members.length} {members.length === 1 ? 'person' : 'people'}
          </p>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <MemberRowItem key={m.id} member={m} isSelf={m.id === selfUserId} orgId={orgId} />
            ))}
          </ul>
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invites</CardTitle>
            <p className="text-xs text-muted-foreground">
              {invites.length} waiting to accept
            </p>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border">
              {invites.map((inv) => (
                <InviteRowItem key={inv.id} invite={inv} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InviteForm({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('staff');
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation<
    InviteRow,
    { code?: string; message?: string },
    { email: string; role: OrgRole },
    { previous: InviteRow[] | undefined; optimisticId: string }
  >({
    mutationFn: async (input) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Your session expired. Reload and sign in again.');
      const { data, error } = await supabase
        .from('org_invites')
        .insert({
          org_id: orgId,
          email: input.email.trim().toLowerCase(),
          role: input.role,
          invited_by: user.id,
        })
        .select('id, email, role, created_at')
        .single<InviteRow>();
      if (error) throw error;
      if (!data) throw new Error('Invite insert returned no row');
      return data;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: teamKeys.invites() });
      const previous = queryClient.getQueryData<InviteRow[]>(
        teamKeys.invites(),
      );
      const optimisticId = `optimistic-${Date.now()}`;
      const optimistic: InviteRow = {
        id: optimisticId,
        email: input.email.trim().toLowerCase(),
        role: input.role,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<InviteRow[]>(teamKeys.invites(), (curr) => [
        optimistic,
        ...(curr ?? []),
      ]);
      return { previous, optimisticId };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) {
        queryClient.setQueryData(teamKeys.invites(), ctx.previous);
      }
      // Surface friendly text for the most common errors.
      const code = err?.code;
      const friendly =
        code === '23505'
          ? "There's already a pending invite for that email."
          : err?.message ?? 'Could not send invite.';
      setError(friendly);
      toast.error(friendly);
    },
    onSuccess: (real, _vars, ctx) => {
      if (ctx) {
        queryClient.setQueryData<InviteRow[]>(
          teamKeys.invites(),
          (curr) =>
            (curr ?? []).map((r) => (r.id === ctx.optimisticId ? real : r)),
        );
      }
      toast.success('Invite added');
      setEmail('');
      setRole('staff');
      setError(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.invites() });
    },
  });

  function handleSubmit() {
    setError(null);
    const trimmed = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError('Enter a valid email');
      return;
    }
    mutate({ email: trimmed, role });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite teammate</CardTitle>
        <p className="text-xs text-muted-foreground">
          They&apos;ll join this business when they accept the invitation — or
          the first time they sign in with this email.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="invite_email">Email</Label>
            <Input
              id="invite_email"
              type="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="teammate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite_role">Role</Label>
            <Select
              name="role"
              value={role}
              onValueChange={(v) => setRole(v as OrgRole)}
            >
              <SelectTrigger id="invite_role" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ORG_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="button"
            size="lg"
            className="h-11 w-full"
            disabled={isPending}
            onClick={handleSubmit}
          >
            <MailIcon className="size-4" />
            {isPending ? 'Sending…' : 'Send invite'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MemberRowItem({
  member: m,
  isSelf,
  orgId,
}: {
  member: MemberRow;
  isSelf: boolean;
  orgId: string;
}) {
  const queryClient = useQueryClient();

  const { mutate: changeRole, isPending: changingRole } = useMutation<
    void,
    { message?: string },
    OrgRole,
    { previous: MemberRow[] | undefined }
  >({
    mutationFn: async (nextRole) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('set_member_role', {
        p_org_id: orgId,
        p_user_id: m.id,
        p_role: nextRole,
      });
      if (error) throw error;
    },
    onMutate: async (nextRole) => {
      await queryClient.cancelQueries({ queryKey: teamKeys.members() });
      const previous = queryClient.getQueryData<MemberRow[]>(teamKeys.members());
      queryClient.setQueryData<MemberRow[]>(teamKeys.members(), (curr) =>
        (curr ?? []).map((row) =>
          row.id === m.id ? { ...row, role: nextRole } : row,
        ),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(teamKeys.members(), ctx.previous);
      toast.error(err?.message ?? 'Could not update role.');
    },
    onSuccess: () => {
      toast.success('Role updated');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members() });
    },
  });

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {m.full_name ?? '—'}
          {isSelf && (
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              you
            </span>
          )}
        </p>
      </div>
      {isSelf || m.role === 'owner' ? (
        <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-medium text-primary">
          {ORG_ROLE_LABELS[m.role]}
        </span>
      ) : (
        <Select
          value={m.role}
          onValueChange={(v) => changeRole(v as OrgRole)}
          disabled={changingRole}
        >
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVITABLE_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ORG_ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {!isSelf && m.role !== 'owner' && <RemoveMemberButton member={m} orgId={orgId} />}
    </li>
  );
}

function RemoveMemberButton({ member: m, orgId }: { member: MemberRow; orgId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useMutation<
    void,
    { message?: string },
    void,
    { previous: MemberRow[] | undefined }
  >({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc('remove_member', {
        p_org_id: orgId,
        p_user_id: m.id,
      });
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: teamKeys.members() });
      const previous = queryClient.getQueryData<MemberRow[]>(teamKeys.members());
      queryClient.setQueryData<MemberRow[]>(teamKeys.members(), (curr) =>
        (curr ?? []).filter((row) => row.id !== m.id),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(teamKeys.members(), ctx.previous);
      toast.error(err?.message ?? 'Could not remove member.');
    },
    onSuccess: () => {
      toast.success('Member removed');
      setOpen(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members() });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${m.full_name ?? 'member'}`}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {m.full_name ?? 'this member'}?</DialogTitle>
          <DialogDescription>
            They&apos;ll lose access to this business. Their other businesses, if
            any, and their login are unaffected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => mutate()}
          >
            {isPending ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteRowItem({ invite: inv }: { invite: InviteRow }) {
  const queryClient = useQueryClient();
  const isOptimistic = inv.id.startsWith('optimistic-');

  const { mutate: revoke, isPending: revoking } = useMutation<
    void,
    { message?: string },
    void,
    { previous: InviteRow[] | undefined }
  >({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from('org_invites')
        .delete()
        .eq('id', inv.id);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: teamKeys.invites() });
      const previous = queryClient.getQueryData<InviteRow[]>(teamKeys.invites());
      queryClient.setQueryData<InviteRow[]>(teamKeys.invites(), (curr) =>
        (curr ?? []).filter((r) => r.id !== inv.id),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(teamKeys.invites(), ctx.previous);
      toast.error(err?.message ?? 'Could not revoke invite.');
    },
    onSuccess: () => {
      toast.success('Invite revoked');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.invites() });
    },
  });

  return (
    <li
      className={
        'flex items-center gap-3 px-4 py-3 ' + (isOptimistic ? 'opacity-70' : '')
      }
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{inv.email}</p>
        <p className="text-xs text-muted-foreground">{ORG_ROLE_LABELS[inv.role]}</p>
      </div>
      {!isOptimistic && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Revoke invite to ${inv.email}`}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          disabled={revoking}
          onClick={() => revoke()}
        >
          <Trash2Icon className="size-4" />
        </Button>
      )}
    </li>
  );
}
