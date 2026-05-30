'use client';

import { useActionState } from 'react';
import { ArrowRightIcon, TrophyIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LeadStatus } from '@/lib/enums';
import {
  setLeadStatus,
  convertLeadToQuote,
  type LeadStatusState,
} from '../actions';

const initial: LeadStatusState = { ok: false };

export function LeadActions({
  leadId,
  status,
}: {
  leadId: string;
  status: LeadStatus;
}) {
  const convert = convertLeadToQuote.bind(null, leadId);
  const [convertState, convertAction, converting] = useActionState(
    async (_prev: LeadStatusState | null) => convert(),
    initial,
  );

  const settled = status === 'won' || status === 'lost';

  return (
    <div className="space-y-3">
      {!settled && (
        <form action={convertAction}>
          <Button type="submit" size="lg" className="h-12 w-full" disabled={converting}>
            <ArrowRightIcon className="size-4" />
            {converting ? 'Creating…' : 'Convert to quote'}
          </Button>
          {convertState.formError && (
            <p className="mt-1 text-xs text-destructive">{convertState.formError}</p>
          )}
        </form>
      )}

      <div className="grid grid-cols-2 gap-2">
        <StatusButton leadId={leadId} to="won" label="Won" Icon={TrophyIcon} active={status === 'won'} />
        <StatusButton leadId={leadId} to="lost" label="Lost" Icon={XIcon} active={status === 'lost'} />
      </div>
    </div>
  );
}

function StatusButton({
  leadId,
  to,
  label,
  Icon,
  active,
}: {
  leadId: string;
  to: LeadStatus;
  label: string;
  Icon: typeof TrophyIcon;
  active: boolean;
}) {
  const action = setLeadStatus.bind(null, leadId, to);
  const [state, formAction, pending] = useActionState(
    async (_prev: LeadStatusState | null) => action(),
    initial,
  );

  return (
    <form action={formAction}>
      <Button
        type="submit"
        variant={active ? 'default' : 'outline'}
        size="lg"
        disabled={pending || active}
        className={cn('h-11 w-full', active && to === 'won' && 'bg-emerald-600 hover:bg-emerald-600')}
      >
        <Icon className="size-4" />
        {active ? `Marked ${label.toLowerCase()}` : pending ? 'Saving…' : `Mark ${label.toLowerCase()}`}
      </Button>
      {state.formError && <p className="mt-1 text-xs text-destructive">{state.formError}</p>}
    </form>
  );
}
