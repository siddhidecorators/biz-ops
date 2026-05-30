@AGENTS.md

# SmallBiz Ops — full project context (handoff for any new session)

Read this top-to-bottom before changing anything. It is the single source of
truth for how this app is built, deployed, and operated. It supersedes any
older notes. Last fully reconciled: 2026-05-30.

---

## 1. What this is

A **mobile-first PWA for Indian small businesses** to run their billing/ops:

> sign in → add customer → add product/service → make a quote → WhatsApp it →
> customer views & accepts → convert to a GST invoice → record payments →
> send payment reminders → see reports → track leads.

First/primary user: **Siddhi Decorators** (Pankaj Garg, interior-decor atelier,
Pitampura Delhi — 14 crafts, B2B+B2C, project-based, 50% advance + balance).
Single-tenant today, but **every domain row carries `org_id`** so it is
multi-tenant-ready (Arnav, the builder/owner, intends to resell it to other
Delhi small businesses).

Builder context: **Arnav** — freelance digital marketer, not a deep engineer.
Wants fast, high-quality results; values working features + clean UX over
internal elegance. The "best product for small businesses" is the goal.

---

## 2. Stack

- **Next.js 16.2.6** — App Router, **Turbopack**, React 19.2.4. **NOT Next 15.**
  See `AGENTS.md` + §10 gotchas. Key differences: `cookies()/headers()/params/
  searchParams` are **async** (await them); middleware is **`proxy.ts`** (file +
  exported `proxy` fn); `'use cache'` replaces `unstable_cache`; viewport is its
  own export; PWA manifest is `src/app/manifest.ts`.
- **Supabase** — Postgres + Auth (Google OAuth) + Storage. `@supabase/ssr`.
- **TanStack Query v5** (+ persist-client + async-storage-persister + idb-keyval)
  — all list/data reads are client-side, cached, IndexedDB-persisted, offline-first.
- **Tailwind v4** + **shadcn/ui built on Base UI** (`@base-ui/react`).
- **@react-pdf/renderer** — client-side PDF, lazy-loaded. **Roboto** bundled in
  `public/fonts` (it has the ₹ glyph; the built-in Helvetica/Times do not).
- **zod** (validation), **sonner** (toasts), **lucide-react** (icons),
  **Fraunces** (serif display) + **Geist** (body) fonts.

---

## 3. Where it lives (deploy + accounts)

- **Live URL:** https://biz-ops-kohl.vercel.app
- **GitHub:** https://github.com/siddhidecorators/biz-ops (private, Pankaj-owned).
  Push to `main` → **Vercel auto-deploys**.
- **Vercel team:** `siddhidecorators-projects` (hobby tier). `vercel.json` pins
  `regions: ["bom1"]` (Mumbai, near Supabase).
- **Supabase project ref:** `hjlbxbymovuyuklzbfxu` (region ap-south-1 Mumbai).
  Dashboard: https://supabase.com/dashboard/project/hjlbxbymovuyuklzbfxu
- All clouds sit under **siddhidecoratorsdelhi@gmail.com** (Pankaj).
- Local folder: `C:\Users\ARNAV\OneDrive\Desktop\smallbiz-ops`

---

## 4. Database — schema & migrations

Migrations live in `supabase/migrations/`. **CRITICAL: there is no migration
tracking.** They have been applied ad-hoc via the Supabase Management API, not
the Supabase CLI. As of 2026-05-30 **all of 0001–0009 ARE applied** to the live
DB (verified). If you add a migration, you must apply it yourself (see §6) AND
ideally set up the CLI workflow so this stops being manual.

> A real bug happened because `0002` existed in the repo but was never applied —
> always verify the live schema matches the repo, don't assume.

**Tables** (all RLS-enabled, scoped by `current_org_id()`):
`orgs`, `profiles`, `customers`, `product_templates`, `quotes`, `quote_lines`,
`invoices`, `invoice_lines`, `payments`, `org_invites`, `leads`.

**Migrations:**
- **0001_init** — core 9 tables, ENUMs (`customer_type, craft, unit_of_measure,
  org_role, quote_status, invoice_status, payment_status, payment_mode,
  gst_type`), helpers `set_updated_at`, `current_fy`, `current_org_id`
  (SECURITY DEFINER), trigger `handle_new_user` (creates org+profile on first
  sign-in), RPCs `next_invoice_number`/`next_quote_number`, payment-recalc
  trigger `recalc_invoice_payment_status`, storage bucket `org-assets`.
- **0002_service_categories** — adds service line-item types to the `craft` enum
  (`labour_charge, installation_charge, cartage_charge, stitching_charge,
  repair_charge, site_visit_charge, polish_charge, dismantling_charge`).
- **0003_get_dashboard_counts** — `get_dashboard_counts()` RPC (one round-trip
  for the home counts).
- **0004_team_invites** — `org_invites` table; `current_org_role()` (SECURITY
  DEFINER); rewires `handle_new_user` to attach a first-time sign-in to a
  matching pending invite; org-scoped `profiles` select + owner-update policies.
- **0005_prevent_self_privilege_escalation** — BEFORE UPDATE trigger on
  `profiles` blocking a user from changing their **own** `role`/`org_id`.
- **0006_quote_share_links** — `quotes.share_token` + `get_shared_quote(token)` +
  `respond_to_shared_quote(token, accept)` (SECURITY DEFINER, granted `anon`).
- **0007_invoice_share_and_outstanding** — `invoices.share_token` +
  `get_shared_invoice(token)`; **drops+recreates** `get_dashboard_counts()` to
  also return `outstanding` (sum of `amount_due` on unpaid/partial invoices).
- **0008_customer_statements** — `customers.share_token` +
  `get_customer_statement(token)` (returns the customer's invoices + total due +
  org pay details).
- **0009_leads** — `leads` table + `lead_status` enum
  (`new, contacted, quoted, won, lost`) + org-scoped RLS.

**Key column notes:**
- `invoices`: `subtotal, tax_total, round_off, total, amount_paid, amount_due,
  payment_status, status, gst_type, cgst_total, sgst_total, igst_total,
  place_of_supply_state, quote_id, share_token`. `amount_paid/due/payment_status`
  are maintained by the `recalc_invoice_payment_status` trigger on `payments`.
- `quote_lines`/`invoice_lines`: generated columns `amount, tax_amount,
  line_total` (don't write them).
- `customers.phone` is **NOT NULL** (empty string allowed).
- `leads`: `name, phone, email, source, note, status, customer_id`.

**RLS pattern:** every domain table has select/insert/update/delete policies
`org_id = public.current_org_id()`. Public share access is NOT via RLS — it's via
SECURITY DEFINER `get_shared_*` / `get_customer_statement` functions that take an
unguessable `share_token` and return only sanitized fields. **Never** add a broad
`anon` RLS policy.

---

## 5. Routes

**Authed app** (route group `src/app/(app)/`, has AppBar + bottom nav):
- `/` — dashboard (count cards via `get_dashboard_counts` + Leads/Reports links)
- `/customers` (+ `/new`, `/[id]` = edit, `/[id]/statement`)
- `/products` (+ `/new`, `/[id]`)
- `/quotes` (+ `/new`, `/[id]`, `/[id]/edit`)
- `/invoices` (+ `/[id]`)
- `/leads` (+ `/new`, `/[id]`)
- `/reports`
- `/settings` (+ `/settings/team`, owner-only)

**Public** (no auth — reachable because `proxy-helper.ts` `PUBLIC_PATHS` lists
their prefixes): `/sign-in`, `/auth/callback`, `/onboarding`, `/q/[token]`
(quote), `/i/[token]` (invoice), `/s/[token]` (statement). If you add a public
route, add its prefix to `PUBLIC_PATHS`.

Bottom nav = Home / Customers / Products / Quotes (4 tabs). Invoices, Leads,
Reports, Settings are reached from the dashboard / detail pages.

---

## 6. How to apply a migration (no CLI set up)

POST the SQL to the Supabase Management API with a **Supabase account PAT**
(create one at https://supabase.com/dashboard/account/tokens):

```
POST https://api.supabase.com/v1/projects/hjlbxbymovuyuklzbfxu/database/query
Authorization: Bearer <SUPABASE_PAT>
Content-Type: application/json
body: { "query": "<sql>" }
```
200/201 = success. The anon key and service-role key **cannot** run DDL — only a
PAT (or the dashboard SQL editor) can. `ALTER TYPE ... ADD VALUE` works fine here
(Postgres 15). Always then verify the change landed.

---

## 7. Conventions (follow these)

- **Server actions** in `actions.ts` (`'use server'`). Signature
  `(prev, formData) => Promise<State>`; use `.bind(null, id)` for per-instance.
  zod-parse `Object.fromEntries(formData)`. On success `revalidatePath()` +
  `redirect('/x?saved=<key>')`.
- **Toasts + cache sync:** `(app)/_components/toast-from-query.tsx` reads `?saved=`,
  shows a sonner toast, and **invalidates the relevant TanStack keys**. When you
  add a `?saved=` value, add its `MESSAGES` entry and (if it changes cached data)
  its `INVALIDATIONS` entry.
- **Lists are client components** using `useQuery` + the **browser** Supabase
  client (`lib/supabase/browser`). RLS still enforces security. The server
  `page.tsx` is a thin auth shell that renders the client list. Query modules
  live in `src/lib/queries/<entity>.ts` with a key factory + fetchers.
- **Optimistic mutations** (delete on customers/products/quotes; record/delete
  payment): `useMutation` against the browser client, snapshot in `onMutate`,
  revert in `onError`, invalidate in `onSettled`. Mirror an existing one.
- **Public share-link pattern** (quotes/invoices/statements): a `share_token`
  column + a token-scoped SECURITY DEFINER RPC granted to `anon` + a public route
  under `/q`,`/i`,`/s` that calls the RPC with `@supabase/supabase-js` (anon key,
  no session) + a "Send on WhatsApp" button (`wa.me/<phone>?text=...`) on the
  authed detail page.
- **PDF:** `quotes/_components/quote-pdf.tsx` (shared by quotes & invoices). Uses
  bundled Roboto/Roboto-Bold (`Font.register`, `/fonts/...`). `formatINRForPdf()`
  (₹) in PDF; `formatINR()` (₹) in web.
- **Money math:** `src/lib/format.ts` (formatINR, round2, currentFY,
  amountInIndianWords). GST split: CGST+SGST intra-state, IGST inter-state,
  decided by `org.state === place_of_supply_state`.
- **Mutations are `networkMode: 'offlineFirst'`** (see `components/query-provider.tsx`)
  — they queue offline and resume on reconnect; `NetworkStatusBadge` shows status.
- **UI:** mobile-first, `max-w-md` lists/detail, `max-w-2xl` forms. Terracotta
  `#B8552A` primary, `--brand-tint` soft bg. AppBar pattern:
  `<AppBar title back={{href}} right={...} />`. Detail pages use a clear action
  hierarchy: one primary action, quiet secondary (single Download PDF), Edit/Delete
  demoted to small text links — **don't re-clutter them**.

---

## 8. Features implemented (everything works in prod unless noted)

Auth (Google + dev sign-in) · first-login onboarding wizard · Customers CRUD ·
Products/services CRUD (templates, service categories, grouped by craft) ·
Quotes (multi-line, templates, statuses draft→sent→accepted→converted, edit,
delete) · Quote→Invoice conversion (atomic numbering, GST split) · Invoices
(read-only + payments ledger + record-payment, all optimistic) · branded GST PDF
with real ₹ · PWA (manifest + service worker) · offline-first · team invites +
roles (owner-gated) · dashboard counts + ₹ outstanding · **share links** for
quotes (`/q`, with Accept/Decline), invoices (`/i`, with UPI/bank pay details),
and customer statements (`/s`) · **WhatsApp send + payment reminders** ·
**Reports** (`/reports`: sales, GST/GSTR-1 summary + CSV export, receivables
aging) · **Leads** (`/leads`: pipeline, filters, convert-to-quote) · search on
customers/quotes/invoices.

**Not yet click-tested (low risk, built on proven patterns):** Leads Won/Lost
buttons and Leads delete. Everything else this session was verified live.

---

## 9. Dev workflow

- **Run:** `npm run dev` (port 3000).
- **Sign in locally:** `/sign-in` shows a **"Dev sign-in"** button when
  `NODE_ENV=development` AND `.env.local` has `NEXT_PUBLIC_DEV_TEST_EMAIL` +
  `NEXT_PUBLIC_DEV_TEST_PASSWORD`. Current dev user: `dev@local.test` /
  `dev@local.test` (a Supabase auth user with its own throwaway org). The button
  is dead-code-eliminated in production builds.
- **.env.local** keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (present but **unused by any code path** now),
  `NEXT_PUBLIC_DEV_TEST_EMAIL/PASSWORD`. It is gitignored.
- **Build:** `npm run build`. **STOP the dev server first** — running `next dev`
  and `next build` together corrupts `.next/dev/types/routes.d.ts` ("Declaration
  or statement expected"). If it happens: stop dev, `rm -rf .next`, rebuild.
- **Deploy:** push to `main`. (Auth note in §11.)
- **Test data:** the dev org has throwaway rows (a "Cache Test User",
  "Rohit Sharma" lead/customer, a couple invoices/quotes). Disposable — Arnav has
  said losing dev data is fine. Pankaj's real org is separate (RLS-isolated).

---

## 10. Gotchas & hard-won lessons (READ before debugging)

- **Hydration mismatches:** never compute `new Date()`/locale dates or random ids
  during a client component's render — server and client disagree → React
  hydration error. Fix: compute on the server, pass as props (see quote form's
  `today`/`defaultValidUntil`), and use **deterministic** ids for initially-
  rendered lists (quote form line uids are `L0,L1…`; random only for items added
  after mount). This bit us twice.
- **Service worker** (`public/sw.js`, version `smallbiz-ops-v3`): caches ONLY
  `/_next/static`. It must NOT cache HTML/navigations/RSC — doing so served
  returning users a stale app bundle and broke interactions (add-customer,
  invites) after a deploy. `activate()` purges old caches so a bad SW self-heals.
- **Base UI `Select`:** submits via a hidden `<input name=...>`. Setting the
  hidden input's value synthetically (e.g. in a test harness) does NOT submit the
  selection — real user clicks do. The Select itself works fine for users.
- **Preview/dev navigation quirk:** a hard navigation to a route that is
  compiling for the first time can bounce back to `/`; the route is fine (`GET
  …200` in logs), it's just slow first-compile. Use client-side Link clicks or
  retry once the route is warm.
- **Migrations drift** (see §4) — verify, don't assume.
- **`.single()` + org-wide RLS:** a `.from('profiles').select().single()` with no
  `id` filter throws once an org has >1 member (the team policy returns all
  org rows). Always filter by `id = auth.uid()` for "my own row".
- **Tailwind v4:** `@layer base` rules with custom props can be silently dropped;
  the h1/h2 serif rule lives outside the layer in `globals.css`.

---

## 11. Security & secrets (action needed)

- **Tokens were pasted into chat history during this build and should be
  rotated/revoked:** the GitHub PAT(s) used for pushing, and the Supabase account
  PAT (`sbp_…`) used for migrations. Also reset the **service-role key** (it's in
  `.env.local`, now unused).
- **Git push auth:** pushes were done via an inline token URL
  (`git -c credential.helper= push https://<token>@github.com/...`), which does
  NOT update the local `origin/main` tracking ref (so `git status` may falsely
  show "ahead N" — the commits ARE on GitHub). **Recommended: run `gh auth login`
  once** so normal `git push` works and the ref stays correct.
- Public `get_shared_*` / `get_customer_statement` RPCs are token-scoped + return
  sanitized fields only — keep them that way; never widen them or add broad anon
  RLS.
- `/settings/team` is owner-gated server-side AND by RLS; `0005` blocks self
  role/org changes. Phase-2 multi-tenant hardening (column-level grants, etc.) is
  still light — review before onboarding untrusted tenants.

---

## 12. Known gaps / good next steps

- **Online payment collection** (Razorpay/Cashfree "Pay Now" + auto-reconcile) —
  highest-value next feature; needs Arnav's merchant account.
- **Auto / scheduled payment reminders** (only manual one-tap today).
- **Due dates on invoices** — aging currently measures from `issue_date`.
- **Credit notes / invoice cancellation** — GST-compliant correction is missing
  (invoices are currently immutable; you can't legally just delete a tax invoice).
- **Expenses / purchases register** — for profit + GST input credit.
- **Product photos** — strong fit for a visual decor business.
- **Migration tracking** (Supabase CLI) — stop applying migrations by hand.
- **Quote status transitions / record-payment** are still server-action (not
  optimistic) — fine, but could be made optimistic for consistency.
- Leads Won/Lost + delete need a quick manual sanity tap.

---

## 13. Map of the source

```
src/
├── app/
│   ├── (app)/                      authed group (AppBar + bottom nav)
│   │   ├── _components/            app-bar, bottom-nav, home-dashboard,
│   │   │                           toast-from-query, network-status-badge
│   │   ├── page.tsx                dashboard shell
│   │   ├── customers/  products/  quotes/  invoices/  leads/   (list/new/[id]
│   │   │                           + _components + actions.ts each)
│   │   ├── reports/                /reports + _components/reports-view
│   │   └── settings/               + settings/team
│   ├── q/[token]/  i/[token]/  s/[token]/    PUBLIC token pages
│   ├── sign-in/  onboarding/  auth/callback/
│   ├── layout.tsx                  fonts, QueryProvider, Toaster, SW register
│   ├── manifest.ts                 PWA manifest
│   └── globals.css
├── components/
│   ├── ui/                         shadcn/Base-UI wrappers
│   ├── query-provider.tsx          QueryClient + IDB persist + offlineFirst
│   └── sw-register.tsx
├── lib/
│   ├── supabase/                   server.ts (async), browser.ts, proxy-helper.ts
│   ├── queries/                    customers, products, quotes, invoices,
│   │                               payments, dashboard, reports, statements,
│   │                               leads, team  (key factories + fetchers)
│   ├── enums.ts                    mirrors Postgres enums + labels + groups
│   ├── india.ts                    states, GST validators, DEFAULT_CUSTOMER_STATE
│   └── format.ts                   formatINR, dates, currentFY, words, round2
├── proxy.ts                        auth refresh + public-path bypass
public/fonts/Roboto-*.ttf           bundled (₹ glyph) · public/sw.js (v3)
supabase/migrations/0001..0009.sql
```

When in doubt, copy the nearest existing implementation of the same shape — the
codebase is intentionally consistent (every list, every share link, every CRUD
follows the same template).
