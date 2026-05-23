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

## Phase 2 plan — strategic roadmap

**Frame:** This app is the **multi-tenant SaaS template** Arnav will resell to
other Delhi small businesses. Every architectural decision in Phase 2 should
help future clients inherit the same snappy, app-like experience by default.

Decided 2026-05-22 — Arnav explicitly asked for the "best plan even if it
requires significant architectural changes". Don't patch; refactor.

**The current ceiling:** every page is a Server Component → every navigation
hits the network → blank screen → render. Fine for 10 users, sluggish for
daily mobile use. The fix is architectural, not band-aid pingers/caching.

### Phase 2A — Data layer refactor (start here, ~4-6 hours)

**Single biggest UX win of the entire plan.** After this, the app feels
native. Tap → render. No blank screens. Forms feel instant.

1. **Add TanStack Query** + `@tanstack/query-sync-storage-persister` for
   IndexedDB cache persistence across sessions.
2. **Move all data fetching from Server Components to Client Components**
   that read via the Supabase JS browser client. RLS still enforced
   server-side — security unchanged.
3. **Server Components become a thin shell** — they only do the initial
   auth check + render the layout. All data hydration is client-side.
4. **Optimistic UI on every mutation:**
   - Save customer → row appears in list INSTANTLY; server confirms in
     background; reverts on error.
   - Record payment → status pill flips immediately.
   - Delete → row vanishes immediately.
5. **Skeleton loaders** on every data list — never a blank screen, always
   shows structure (page header, table outline, button placeholders).
6. **Real service worker** caching the app shell (HTML/JS/CSS) + last-viewed
   data with stale-while-revalidate. Second launch is INSTANT from cache.
7. **Static shell** — `/sign-in` and `/onboarding` become statically
   generated (no server function call per visit).
8. **`vercel.json`** sets `"regions": ["bom1"]` to colocate serverless
   functions with Supabase Mumbai (~150-250ms saved per query).
9. **Cron-job.org** ping every 5 min to keep the few remaining server
   functions warm (eliminates Vercel Hobby cold starts for free).
10. **Combine 4 dashboard count queries into a single RPC**
    `get_dashboard_counts(org_id)` — one network round trip instead of four.

What Pankaj will feel: open app → INSTANT; tap any nav → renders before
finger lifts; save anything → success appears with zero delay. The app
genuinely feels like a native app despite being a web PWA.

### Phase 2B — Team invites + role-based access (~1.5 hours)

After 2A's snappy foundation, this is fast to build and inherits the feel.

1. Migration `0003_team_invites.sql` — new `org_invites` table (org_id,
   email, role, invited_by, created_at, unique on org_id+email). Update
   `handle_new_user` trigger: before creating a new org, check for a
   matching pending invite; if yes, attach the new profile to that invite's
   org with the invite's role and delete the invite row.
2. `/settings/team` page — current members list (name, role, "Remove"),
   pending invites list ("Revoke", "Resend"), invite form (email + role).
   Owner-only access via `current_org_role()` check.
3. Server actions:
   - `inviteMember(email, role)` — owner-only, inserts into `org_invites`.
     Use Supabase Auth's `inviteUserByEmail()` to send the magic link.
   - `revokeInvite(inviteId)` — owner-only delete.
   - `removeMember(profileId)` — owner-only; set `profiles.org_id = null`.
   - `changeRole(profileId, role)` — owner-only.
4. Role-based UI gates — for v1, only gate `/settings/team` to Owner.
   Everyone else in the org can do everything (split Admin/Staff later).
5. Clean up orphan test orgs from Phase 1 multi-tenant testing (via
   Supabase dashboard → Authentication → Users).

### Phase 2C — Offline-first (~3-4 hours)

**Critical for Indian small business reality.** Pitampura shops have patchy
4G. Pankaj needs to draft a quote at a customer's home (no signal) and have
it sync when he's back near a tower.

1. IndexedDB persistence of the TanStack Query cache via
   `@tanstack/query-sync-storage-persister`.
2. **Mutation queue** — when offline, save mutations to IndexedDB.
   When back online, sync to server in order.
3. **Sync status badges** — "Synced ✓" / "Will sync when online ↻" on
   rows that haven't reached the server yet.
4. **Service worker intercept** — when offline, API calls return cached
   data; when online, fall through to network.
5. **Conflict resolution** — last-write-wins for v1 (simple); proper
   merge strategy later if needed.

After this Pankaj can write quotes in his customer's home, in the basement
parking, on the metro — works everywhere. Syncs the moment connectivity
returns.

### Phase 2D — Native wrapper (Capacitor) (~2 hours)

**Goal: App Store / Play Store distribution + native APIs**

Defer until clients ask. PWA install-to-home already covers 90% of the
"feels like an app" win. Build this only when:
- Pankaj or another client wants to publish on Play Store
- A feature needs native camera/notifications

When the time comes:
1. Wrap with **Capacitor** (CLI: `npm install @capacitor/core @capacitor/cli`).
2. **Native camera** plugin → product photos, customer GST certificate
   capture, signed-quote scans.
3. **Push notifications** plugin → "Invoice paid", "Quote accepted",
   "Daily summary" — wire to Supabase Realtime triggers.
4. Build APK → upload to Play Store (one-time ₹1,800 dev fee).
5. iOS — defer unless a client has iOS customers (Apple Dev Program is
   ₹8,300/year).

### Phase 2E — Multi-tenant template (~2-3 hours)

**Goal: clone for next client in 30 minutes, not 30 hours.**

Only build this when client #2 signs on. Premature abstraction is the
enemy. When ready:

1. **Theme system** — brand color, logo, tagline, accent fonts pulled
   from `orgs` table → applied to UI + PDF dynamically. Already half-done
   (`brand_color` exists; needs theme wiring).
2. **Subdomain routing** (requires owning a domain like `bizops.in`) —
   Pankaj at `siddhi.bizops.in`, next client at `<their-name>.bizops.in`.
   Each org sees their own data + brand. Use Next 16 middleware (proxy)
   for the routing.
3. **Self-serve onboarding** — `bizops.in/signup` → Google sign-in → org
   created → 3-step wizard → live. No manual setup per new client.
4. **Feature flags table** — per-tenant toggles for industry-specific
   features (interior decorator vs salon vs photographer). Tenants only
   see the features relevant to them.
5. **White-label option** — hide "Powered by SmallBiz Ops" footer for
   premium-tier clients.

Revenue math after this:
- ₹2,000/month per client × 10 clients = ₹20K/month recurring
- × 50 clients = ₹100K/month
- Each client's data fully isolated (existing RLS handles this)
- Ship one update → all clients benefit instantly

### Execution order (recommended)

| Phase | Effort | When |
|---|---|---|
| 2A — Data layer refactor | 4-6 h | **NEXT SESSION — DO FIRST.** Foundation everything else inherits. |
| 2B — Team invites | 1.5 h | Session after 2A. Quick + high operational value. |
| 2C — Offline-first | 3-4 h | After Pankaj uses the app 2-3 weeks and confirms patchy-data pain. |
| 2D — Native wrapper | 2 h | When ready to publish on Play Store. Could be months. |
| 2E — Multi-tenant template | 2-3 h | When client #2 signs on. Don't build until needed. |

**Total: ~12-15 hours across multiple sessions.** Each phase ships
independently and adds value. At the end Arnav has a real multi-tenant
ops platform he can resell.

### Notes for the Claude that picks up Phase 2A

- Read this whole CLAUDE.md first — every Phase 1 convention still applies.
- The architectural shift is significant: Server Component data fetching →
  Client Component data fetching with TanStack Query. Don't break the auth
  pattern though — `proxy.ts` + Server Component auth check stays.
- TanStack Query setup: install `@tanstack/react-query` + `@tanstack/react-query-devtools`. Create a `QueryClientProvider` wrapper in the root layout (Client Component).
- Server Components still wrap layouts/auth gating; data hooks (`useQuery`,
  `useMutation`) live in Client Components inside those Server pages.
- For mutations, use Supabase JS browser client directly + TanStack Query's
  optimistic update API. The existing zod schemas can be reused on the
  client (they're just functions).
- Skip rebuilding the PDF/Sonner toast/etc. — those work fine in client
  components already.
- Service worker upgrade: switch `public/sw.js` from no-op to a real
  stale-while-revalidate cache for the app shell. Use Workbox if it's
  faster than writing by hand.
- Don't migrate everything at once — start with `/customers` list as a
  pilot, validate the pattern works, then propagate to products, quotes,
  invoices.
