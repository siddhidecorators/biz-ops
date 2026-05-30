'use client';

import { useState } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
import { createClient } from '@/lib/supabase/browser';

// Owner-only "danger zone". Deleting a business permanently erases ALL its data
// and signs everyone out — so it's gated behind typing the exact business name.
export function DeleteBusiness({ orgName }: { orgName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [pending, setPending] = useState(false);
  const matches = confirmText.trim() === orgName.trim();

  async function handleDelete() {
    if (!matches || pending) return;
    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('delete_org');
      if (error) throw error;
      await supabase.auth.signOut();
      // Hard redirect so the persisted query cache + service worker state for
      // the now-deleted business are dropped cleanly.
      window.location.href = '/sign-in?deleted=1';
    } catch (e) {
      setPending(false);
      toast.error(e instanceof Error ? e.message : 'Could not delete the business.');
    }
  }

  return (
    <Card size="sm" className="mt-8 ring-destructive/25">
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive-tint text-destructive">
            <TriangleAlertIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-destructive">Delete this business</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Permanently erases every customer, quote, invoice and payment, and signs everyone
              out. This cannot be undone.
            </p>
          </div>
        </div>

        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setConfirmText('');
          }}
        >
          <DialogTrigger render={<Button variant="destructive" size="sm" />}>
            Delete business…
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete “{orgName}”?</DialogTitle>
              <DialogDescription>
                This permanently deletes the business and <strong>all</strong> of its data —
                customers, quotes, invoices and payments — and signs everyone out. It cannot be
                undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1">
              <Label htmlFor="confirm-name">
                Type <span className="font-semibold text-foreground">{orgName}</span> to confirm
              </Label>
              <Input
                id="confirm-name"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={orgName}
                autoComplete="off"
                autoCapitalize="off"
                className="h-11"
              />
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
              <Button
                type="button"
                disabled={!matches || pending}
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {pending ? 'Deleting…' : 'Delete forever'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
