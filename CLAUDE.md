@AGENTS.md

# SmallBiz Ops — project memory for Claude

Read this at the start of every session. The goal is to bring a fresh Claude
up to speed in under two minutes. Keep it opinionated and current.

## What this is

A mobile-first PWA for **Siddhi Decorators** — Pankaj Garg's boutique interiors
atelier in Pitampura, Delhi NCR (14 crafts, 8 brand dealerships, B2B + B2C,
project-based with 50% advance + balance).

The workflow it covers end-to-end:

> sign in → add customer → add product/service template → create quote →
> WhatsApp the PDF → convert accepted quote to a tax invoice → record
> partial/full payments → reshare PDF as receipt when paid

Single-tenant for Siddhi today; the schema is scoped under `org_id` so
multi-tenancy is a flag flip later (Arnav is a freelance digital marketer and
may resell this to other Delhi small businesses).

## Stack

- **Next.js 16** (App Router, Turbopack, React 19) — **NOT 15**, see gotchas below
- **Supabase** — Postgres + Auth (Google OAuth) + Storage
- **Tailwind v4** + **shadcn/ui** built on Base UI primitives
- **@react-pdf/renderer** — client-side PDF generation, lazy-loaded
- **Sonner** for toasts, **lucide-react** for icons
- **Fraunces** (serif display) + **Geist** (sans body) via next/font/google
- Deployed on **Vercel**

## Critical: Next 16 ≠ Next 15

Several APIs moved since pre-Jan-2026 training cutoffs. Read `AGENTS.md`
before writing Next code. The traps:

- `cookies()`, `headers()`, page `params`, page `searchParams` are all **async** — `await` them
- `middleware.ts` → **`proxy.ts`** (file + function name), NodeJS runtime only
- `'use cache'` directive replaces `unstable_cache`
- `revalidateTag(tag, profile)` requires a 2nd profile arg
- Viewport lives in `export const viewport: Viewport = {...}`, **not** under metadata
- PWA manifest goes in `src/app/manifest.ts` (auto-linked at `/manifest.webmanifest`)
- Turbopack is the default — don't pass `--turbopack`, pass `--webpack` to opt out

## Project layout

```
src/
├── app/
│   ├── (app)/                    Authed route group — bottom nav + AppBar shell
│   │   ├── _components/          app-bar.tsx, bottom-nav.tsx, toast-from-query.tsx
│   │   ├── page.tsx              Home dashboard (4 count cards + coming-soon strip)
│   │   ├── customers/            list, new, [id]; actions.ts; _components/{form,delete}
│   │   ├── products/             same shape as customers, grouped by craft chapter
│   │   ├── quotes/               list, new, [id], [id]/edit; multi-line form;
│   │   │                         quote-pdf.tsx (shared with invoices);
│   │   │                         quote-actions.tsx (status transitions + convert)
│   │   ├── invoices/             list, [id]; record-payment dialog; payments ledger
│   │   └── settings/             Reuses OnboardingForm with custom submit label
│   ├── sign-in/                  Google OAuth entry
│   ├── onboarding/               First-login wizard (settings_complete=false)
│   ├── auth/callback/            OAuth code exchange
│   ├── layout.tsx                Root: fonts, Toaster, SW register, viewport
│   ├── globals.css               Tailwind theme + terracotta brand vars
│   └── manifest.ts               PWA manifest (Next 16 MetadataRoute)
├── components/
│   ├── ui/                       shadcn/ui wrappers around Base UI
│   └── sw-register.tsx           Production-only SW registration client component
├── lib/
│   ├── supabase/                 server.ts (async), browser.ts, proxy-helper.ts
│   ├── enums.ts                  Mirror of Postgres ENUMs + display labels + groups
│   ├── india.ts                  36 states, GST validators, NCR_STATE_CODES
│   └── format.ts                 formatINR, formatINRForPdf, amountInIndianWords
└── proxy.ts                      Auth refresh + unauth redirect; matcher bypasses PWA assets

public/
├── icon.svg                      Terracotta gradient tile with serif S (favicon + manifest)
└── sw.js                         Minimal pass-through SW (Phase 2 will add real caching)

supabase/migrations/
├── 0001_init.sql                 9 tables + RLS + triggers + storage bucket
└── 0002_service_categories.sql   Adds labour/installation/etc to craft enum
```

## Conventions to honour

### Server actions

- `'use server'` at top of `actions.ts`
- Form action signature: `(prev: State | null, formData: FormData) => Promise<State>`
- Use `.bind(null, id)` for per-instance actions (update, delete)
- zod schema parses FormData; **line-item arrays are serialized as a JSON string
  in a hidden input** named `lines` and parsed via `z.string().transform(JSON.parse)`
- Always `revalidatePath(path)` + `redirect(path + '?saved=<key>')`
- Toast messages registered in `(app)/_components/toast-from-query.tsx`
  — add a `MESSAGES[key]` entry whenever you introduce a new `?saved=` value

### Auth + RLS

- Every domain row carries `org_id`. RLS uses `current_org_id()` (defined in 0001).
- `handle_new_user` trigger creates a fresh `orgs` row + `profiles` row on first sign-in.
- Server: `await createClient()` from `lib/supabase/server`. Don't construct your own.
- Browser: `createClient()` from `lib/supabase/browser` (sync).

### PDF (`src/app/(app)/quotes/_components/quote-pdf.tsx`)

- Used by BOTH `/quotes/[id]` and `/invoices/[id]` — same component, different
  `QuotePdfData`. `buildPdfData()` in quote page; `buildInvoicePdfData()` in invoice page.
- Helvetica body + Times-Bold display (react-pdf built-ins, no font fetch)
- Currency renders as **"Rs 1,250.00"** — Helvetica has no ₹ glyph. Use
  `formatINRForPdf()` in PDF code, `formatINR()` (with ₹) in web UI.
- Per-line CGST/SGST split when intra-state, single IGST column otherwise.
  Driven by `isIntraState` (org state === customer billing state).
- Default T&Cs are inline constants in the component. `org.terms_text` overrides
  them when set, rendered as prose instead of a numbered list.
- Compact layout: ~470pt headroom for line items → comfortably 6-8 items per page.
  If quotes routinely run longer, wire react-pdf's `<Page wrap>` properly.

### UI

- Mobile-first; `max-w-md` on list/detail pages, `max-w-2xl` on forms
- Terracotta `#B8552A` is primary. `--brand-tint` for soft backgrounds.
- Fraunces serif on h1/h2 globally (rule lives OUTSIDE `@layer base` in globals.css
  because Tailwind v4's compiler drops the rule when nested inside — see commit
  history for the saga)
- AppBar pattern: `<AppBar title={...} back={{ href }} right={<icon />} />` at the top
  of each page, then `<main className="mx-auto max-w-md ...">` below
- Bottom nav: Home / Customers / Products / Quotes (4 tabs; Invoices reached
  via quote conversion or home dashboard card)

### Base UI gotchas

- `Button` uses Base UI which expects `render={<X />}` not `asChild`. For
  Link-styled-as-Button, prefer `<Link className={buttonVariants({...})}>` over
  the render prop — cleaner.
- `Select` accepts `value` + `onValueChange` for controlled use.
- `Checkbox` from Base UI submits via a hidden `<input>` automatically when
  given a `name` prop — zod schema treats `v === 'on'` as truthy.

## Build state (May 2026)

**Phase 1 — complete and LIVE in production.** Pankaj can use the app for real
billing today.

- ✅ Auth + first-login onboarding wizard
- ✅ Customers CRUD (NCR-top state picker, Delhi default on new)
- ✅ Products CRUD (templates + service categories, grouped by craft chapter)
- ✅ Quotes CRUD (multi-line items, template picker per line, live totals,
  edit, delete, status transitions: draft → sent → accepted → converted)
- ✅ Quote → Invoice conversion (atomic via `next_invoice_number` RPC, per-line
  CGST/SGST/IGST split on conversion based on customer state)
- ✅ Invoices read-only + record-payment dialog + payments ledger
  (DB trigger `recalc_invoice_payment_status` auto-updates pill on insert/delete)
- ✅ Branded PDF (info box header, Bill/Ship boxes, lines table, totals with
  Paid + Balance Due lines, "Paid in full" stamp, amount in words, default T&Cs,
  payment details + signature, terracotta accents)
- ✅ Settings page (reuses OnboardingForm)
- ✅ PWA manifest + service worker (prod only) — installable on phone home screen
- ✅ Deployed to Vercel under Pankaj's team, auto-deploys on `git push`

## Production deployment (May 2026)

- **Live URL** → https://biz-ops-kohl.vercel.app (also resolves at
  `biz-ops-siddhidecorators-projects.vercel.app`)
- **GitHub repo** → https://github.com/siddhidecorators/biz-ops (Pankaj-owned,
  private)
- **Vercel team** → `siddhidecorators-projects` (Pankaj-owned, hobby tier)
- **CI/CD** — every push to `main` triggers a Vercel build. Preview deploys are
  created for branches/PRs automatically.
- **Owner email** — `siddhidecoratorsdelhi@gmail.com` (Pankaj). All three clouds
  (Supabase, Google Cloud OAuth, Vercel, GitHub) sit under this email.
- **Old deployment** at `smallbiz-ops.vercel.app` (under `arnavgarg-s-projects`)
  is **deprecated** — schedule for deletion. The duplicate doesn't break
  anything because the Supabase project ref is the same.

## Open polish items (none blocking)

- Sign-in page `<title>` renders as "Sign in · SmallBiz Ops · SmallBiz Ops"
  (duplicated suffix). Fix: the page sets `title: 'Sign in · SmallBiz Ops'`
  while the root layout uses a `'%s · SmallBiz Ops'` template. Change the
  page to just `title: 'Sign in'`.
- Vendor a TTF with ₹ glyph for the PDF (currently uses "Rs" prefix as
  Helvetica/Times don't include U+20B9). Host the TTF in Supabase Storage or
  `public/fonts/` and register via `@react-pdf/renderer`'s `Font.register`.

## What's intentionally NOT built (Phase 2+)

- Customer-facing accept/decline link for quotes (WhatsApp loop)
- Offline draft caching (SW is pass-through today)
- E-invoicing IRP integration (only mandatory >₹5 cr turnover; Siddhi is well below)
- GSTR-1 / GSTR-3B export
- Inquiry/leads tracking + automated follow-ups
- Two-way WhatsApp messaging
- Dashboard recent-activity feed, charts
- Dark mode toggle (CSS vars exist, no toggle UI)
- Multi-tenant onboarding (`handle_new_user` works, but no team invite flow)

## Database

- Project ref: `hjlbxbymovuyuklzbfxu` (ap-south-1 Mumbai)
- Dashboard: https://supabase.com/dashboard/project/hjlbxbymovuyuklzbfxu
- Tables: orgs, profiles, customers, product_templates, quotes, quote_lines,
  invoices, invoice_lines, payments
- RLS enabled on all, scoped via `current_org_id()`
- Generated columns on quote_lines/invoice_lines: `amount`, `tax_amount`, `line_total`
- Triggers: `handle_new_user`, `*_set_updated_at`, `payments_recalc_invoice`
- RPCs: `next_invoice_number(p_org_id)`, `next_quote_number(p_org_id)`, `current_fy()`
- Storage bucket: `org-assets` (path convention `<bucket>/<org_id>/<filename>`)

## Supabase MCP

`.mcp.json` in the project root wires a hosted Supabase MCP. **Open Claude
Code from inside this folder** to load it — first MCP tool call triggers
OAuth approval in the browser. Opening from a parent dir skips the MCP and
you're stuck reading SQL migrations to inspect schema.

## Common gotchas (hard-won)

- **Stale CSS after `globals.css` edit**: Turbopack's content-hashed chunks
  stick in the browser. Hard-reload (`Ctrl+Shift+R`) to bust.
- **`@layer base` rules silently dropped** by Tailwind v4 when they include
  custom properties like `font-optical-sizing`. Move such rules outside the
  layer — the h1/h2 font-family rule lives at file top-level now.
- **PWA assets need proxy bypass**: the matcher in `proxy.ts` excludes
  `manifest.webmanifest`, `sw.js`, and image extensions. New static assets
  on auth-required routes will be intercepted unless added to this list.
- **PDF font choice**: stuck with Helvetica/Times until we vendor a TTF with
  ₹ support (tried 4 CDN sources, all returned HTML 404s — see commit history).
  Until then, `formatINRForPdf()` uses "Rs" prefix.
- **Ship-To repeats the billing address silently** when no override. Don't
  re-add a "(same as billing)" hint — Pankaj said it looked apologetic.

## Phase 2 plan (next session)

The highest-priority unbuilt feature is **team invites** — without it, Pankaj's
staff can't share his org's data. Every new Google sign-in creates a separate
walled org today (the `handle_new_user` trigger fires on every `auth.users`
insert and creates a fresh `orgs` row).

### Phase 2.1 — Team invites (start here, ~1.5 hours)

1. **Migration `0003_team_invites.sql`** — new table `org_invites` (org_id,
   email, role, invited_by, created_at, unique on org_id+email). Update
   `handle_new_user` trigger: before creating a new org, check if the
   sign-in email matches a pending invite; if yes, attach the new profile
   to that invite's org with the invite's role and delete the invite row.
2. **`/settings/team` page** — current members list (name, role, "Remove"),
   pending invites list ("Revoke", "Resend"), invite form (email + role
   dropdown). Owner-only access via `current_org_role()` check.
3. **Server actions** in a new `(app)/settings/team/actions.ts`:
   - `inviteMember(email, role)` — owner-only, inserts into `org_invites`.
     Use Supabase Auth's `inviteUserByEmail()` to send the magic link.
   - `revokeInvite(inviteId)` — owner-only delete from `org_invites`.
   - `removeMember(profileId)` — owner-only; set `profiles.org_id = null`.
   - `changeRole(profileId, role)` — owner-only.
4. **Role-based UI gates** — for v1, only gate `/settings/team` to Owner
   role. Everyone in the org can do everything else (Phase 2.5 can split
   Admin/Staff later).
5. **Cleanup orphan test orgs** in `auth.users` from any multi-tenant
   testing done in Phase 1. Owner can do this via Supabase dashboard.

### Phase 2.2 — beyond invites

In rough priority order (Pankaj's actual workflow needs):

- **Customer-facing accept/decline link** for quotes — slug-based no-auth
  route, customer taps Accept/Decline, status updates back in the app.
  Closes the WhatsApp acceptance loop.
- **Inquiries / leads register** — captures walk-in and call leads BEFORE
  they become quotes. Status: new → contacted → quoted → accepted/declined.
  Linkable to a customer once they convert. Reminders for stale leads.
- **Recent activity feed** on home dashboard — "Last 7 days: 3 quotes sent,
  1 converted, Rs 45K received".
- **Two-way WhatsApp** — replaces the manual "share PDF on WhatsApp" step.
  Use WhatsApp Business API (Meta) or a wrapper like Wati/AiSensy.
- **Vendor a TTF with ₹** for the PDF — host in Supabase Storage or
  `public/fonts/`, register via `Font.register` so currency reads "₹ 1,250"
  in PDFs instead of "Rs 1,250".
- **Offline draft caching** for the quote form — real SW caching +
  IndexedDB so quotes can be drafted with patchy mobile data.
- **Sales / purchases registers** + **GSTR-1 export** when Pankaj's
  turnover trajectory warrants it (>₹40L or so).
- **Multi-tenant signup flow** when a second freelance client signs on.
  The schema is ready; need a self-serve sign-up UI.
