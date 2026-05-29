'use client';

import { useState } from 'react';
import { CheckIcon, XIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

type Outcome = 'accepted' | 'declined';

export function QuoteResponse({
  token,
  initialStatus,
  brandColor,
}: {
  token: string;
  initialStatus: string;
  brandColor: string;
}) {
  // Already-resolved quotes just show their state, no buttons.
  const resolvedInitial: Outcome | null =
    initialStatus === 'accepted' || initialStatus === 'converted_to_invoice'
      ? 'accepted'
      : initialStatus === 'declined'
        ? 'declined'
        : null;

  const [outcome, setOutcome] = useState<Outcome | null>(resolvedInitial);
  const [pending, setPending] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only draft/sent quotes are still open to a decision.
  const canRespond = ['draft', 'sent'].includes(initialStatus);

  async function respond(accept: boolean) {
    setPending(accept ? 'accepted' : 'declined');
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc('respond_to_shared_quote', {
        p_token: token,
        p_accept: accept,
      });
      if (rpcError) throw rpcError;
      if (data === 'accepted' || (accept && data === 'already_accepted')) {
        setOutcome('accepted');
      } else if (data === 'declined') {
        setOutcome('declined');
      } else if (data === 'not_found') {
        setError('This quote could not be found.');
      } else {
        setError('This quote can no longer be changed.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(null);
    }
  }

  if (outcome === 'accepted') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center">
        <p className="text-base font-semibold text-emerald-700">✓ Quote accepted</p>
        <p className="mt-1 text-sm text-emerald-700/80">
          Thank you! We&apos;ll be in touch to take it forward.
        </p>
      </div>
    );
  }

  if (outcome === 'declined') {
    return (
      <div className="rounded-xl border border-border bg-muted px-4 py-4 text-center">
        <p className="text-base font-medium text-muted-foreground">Quote declined</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No problem — reach out if you change your mind.
        </p>
      </div>
    );
  }

  if (!canRespond) return null;

  return (
    <div className="space-y-2">
      <p className="text-center text-sm text-muted-foreground">
        Happy with this quote?
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => respond(true)}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: brandColor }}
        >
          <CheckIcon className="size-4" />
          {pending === 'accepted' ? 'Saving…' : 'Accept quote'}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => respond(false)}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          <XIcon className="size-4" />
          {pending === 'declined' ? 'Saving…' : 'Decline'}
        </button>
      </div>
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}
