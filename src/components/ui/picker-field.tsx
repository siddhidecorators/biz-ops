'use client';

import { useId, useMemo, useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PickerOption = { value: string; label: string; hint?: string };
export type PickerGroup = { label?: string; options: PickerOption[] };

// A mobile-first replacement for a <select>. Tapping the full-width trigger
// opens a bottom sheet with (for long lists) a search box and big tappable
// rows — far easier than scrolling a tiny popup. Works in server-action forms
// via a hidden input, and as a controlled component via value/onValueChange.
export function PickerField({
  name,
  label,
  placeholder = 'Select…',
  value: controlledValue,
  defaultValue,
  onValueChange,
  groups,
  options,
  searchable,
  required,
  id,
  triggerClassName,
}: {
  name?: string;
  label: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  groups?: PickerGroup[];
  options?: PickerOption[];
  searchable?: boolean;
  required?: boolean;
  id?: string;
  triggerClassName?: string;
}) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const isControlled = controlledValue !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const value = isControlled ? controlledValue : internal;

  const allGroups: PickerGroup[] = groups ?? [{ options: options ?? [] }];
  const flat = allGroups.flatMap((g) => g.options);
  const selected = flat.find((o) => o.value === value) ?? null;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const showSearch = searchable ?? flat.length > 8;

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allGroups;
    return allGroups
      .map((g) => ({
        ...g,
        options: g.options.filter((o) => o.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.options.length > 0);
  }, [query, allGroups]);

  function select(v: string) {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery('');
        }}
      >
        <DialogPrimitive.Trigger
          render={<button type="button" />}
          id={fieldId}
          aria-required={required || undefined}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-base outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            !selected && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          <span className="truncate text-left">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-foreground/40 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[82vh] w-full max-w-md flex-col rounded-t-3xl bg-popover pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg ring-1 ring-foreground/10 duration-200 outline-none will-change-transform data-open:animate-in data-open:slide-in-from-bottom-4 data-closed:animate-out data-closed:slide-out-to-bottom-4">
            <div aria-hidden className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-border" />
            <DialogPrimitive.Title className="shrink-0 px-4 py-2 text-sm font-semibold">
              {label}
            </DialogPrimitive.Title>

            {showSearch && (
              <div className="shrink-0 px-3 pb-2">
                <div className="flex h-11 items-center gap-2 rounded-lg border border-input px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search ${label.toLowerCase()}…`}
                    className="h-full w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
              {filteredGroups.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No matches for “{query}”
                </p>
              ) : (
                filteredGroups.map((g, gi) => (
                  <div key={g.label ?? gi} className="py-1">
                    {g.label && <p className="text-overline px-3 pt-2 pb-1">{g.label}</p>}
                    {g.options.map((o) => {
                      const active = o.value === value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => select(o.value)}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors active:bg-muted',
                            active ? 'bg-brand-tint' : 'hover:bg-muted/60',
                          )}
                        >
                          <span className="min-w-0">
                            <span
                              className={cn(
                                'block truncate text-base',
                                active && 'font-semibold text-primary',
                              )}
                            >
                              {o.label}
                            </span>
                            {o.hint && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {o.hint}
                              </span>
                            )}
                          </span>
                          {active && <CheckIcon className="size-5 shrink-0 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
