@AGENTS.md

# SmallBiz Ops — full project context (handoff for any new session)

Read this top-to-bottom before changing anything. It is the single source of
truth for how this app is built, deployed, and operated. It supersedes any
older notes. **Last fully reconciled: 2026-05-31** (after the world-class
UI/UX redesign + features below).

---

## 0. What just happened (the redesign session — READ FIRST)

A large UI/UX redesign + feature pass shipped to **production** this session.
All of it lives on branch **`redesign/foundation`**, which has been pushed to
**`main`** (so prod = the redesign). HEAD/main = commit **`c04871f`**.

What changed (detail in the sections below):
- **Design-system foundation** — refined warm tokens, semantic colours, elevation,
  a motion system, upgraded primitives, a `Badge` status pill, and a new
  searchable **`PickerField`** (bottom-sheet select).
- **New navigation** — bottom nav `Home · Customers · [＋ Create] · Quotes ·
  Invoices` with a centre **Create** bottom-sheet. Products moved off the nav.
- **Flagship Home** — money-first dashboard ("You're owed ₹…" hero + needs-
  attention + Manage), de-duplicated from the nav.
- **Flagship Invoice "get-paid" screen** — balance-due hero + payment-progress
  bar + record/share + paid-in-full celebration.
- **Direct invoice creation** — `/invoices/new` (previously invoices only came
  from converting a quote).
- **Delete business** — owner-only Settings danger zone + `delete_org()` RPC
  (migration **0010**, already applied to prod).
- **PDF rework** — simpler line table + tax summary, status watermark, page
  numbers, "Original for Recipient", etc.
- **Perf** — server-hydrated list pages, lighter font payload, no backdrop-blur
  on the bars.
- **Share** — one **Share** button that sends the *actual PDF* via the OS share
  sheet (replaced the WhatsApp-link + copy buttons).

Open follow-ups are in §13. **Two secrets were pasted in chat this session and
should be rotated: a GitHub PAT (`ghp_…`) and a Supabase PAT (`sbp_…`).**

---

## 1. What this is

A **mobile-first PWA for Indian small businesses** to run their billing/ops:

> sign in → add customer → add product/service → make a quote → send it →
> customer views & accepts → convert to a GST invoice (or bill directly) →
> record payments → share/remind → see reports → track leads.

First/primary user: **Siddhi Decorators** (Pankaj Garg, interior-decor atelier,
Pitampura Delhi — 14 crafts, B2B+B2C, project-based, 50% advance + balance).
Single-tenant today, but **every domain row carries `org_id`** so it is
multi-tenant-ready (Arnav, the builder/owner, intends to resell it to other
Delhi small businesses).

Builder context: **Arnav** — freelance digital marketer, not a deep engineer.
Wants fast, high-quality, *flagship* results; values working features + clean,
smooth UX. He tests on his phone and is sensitive to any jank.

---

## 2. Stack

- **Next.js 16.2.6** — App Router, **Turbopack**, React 19.2.4. **NOT Next 15.**
  See `AGENTS.md` + §11 gotchas. Async `cookies()/headers()/params/searchParams`;
  middleware is **`proxy.ts`**; `'use cache'` replaces `unstable_cache`; viewport
  is its own export; PWA manifest is `src/app/manifest.ts`.
- **Supabase** — Postgres + Auth (Google OAuth) + Storage. `@supabase/ssr`.
- **TanStack Query v5** (+ persist-client + async-storage-persister + idb-keyval)
  — list/data reads are client-side, cached, IndexedDB-persisted, offline-first.
  **List pages now also server-hydrate the first paint** (see §7).
- **Tailwind v4** + **shadcn/ui on Base UI** (`@base-ui/react`, style "base-nova").
- **@react-pdf/renderer** — client-side PDF, lazy-loaded. **Roboto** bundled in
  `public/fonts` (has the ₹ glyph). *(No serif bundled — see §13.)*
- **zod**, **sonner**, **lucide-react**, **Fraunces** (serif display, h1/h2 +
  `font-heading`) + **Geist** (body). **Geist Mono was removed this session**
  (was unused; `--font-mono` is now a system stack).
- **next-themes** is installed but **no `ThemeProvider` is wired** — dark-mode
  tokens exist in `globals.css` but are dormant (light is the only active theme).

---

## 3. Where it lives (deploy + branch state)

- **Live URL:** https://biz-ops-kohl.vercel.app  (production = `main`)
- **GitHub:** https://github.com/siddhidecorators/biz-ops (private, Pankaj-owned).
  Push to `main` → **Vercel auto-deploys**. Region `bom1` (`vercel.json`).
- **Supabase ref:** `hjlbxbymovuyuklzbfxu` (ap-south-1 Mumbai).
- All clouds under **siddhidecoratorsdelhi@gmail.com** (Pankaj).
- Local folder: `C:\Users\ARNAV\OneDrive\Desktop\smallbiz-ops`

**Branch/commit state (important):**
- Active branch **`redesign/foundation`** = **`main`** = prod, both at **`c04871f`**.
  The whole redesign is live. A new session can keep working on `redesign/foundation`
  (and keep fast-forwarding `main`), or treat `main` as the trunk.
- **Git auth:** the stored credential is `arnavgg12`, which **lacks push access**
  to the Pankaj-owned repo (403). Pushes this session used an **inline token URL**:
  `git -c credential.helper= push https://<GH_PAT>@github.com/siddhidecorators/biz-ops.git <src>:<dst>`.
  This does **not** update local tracking refs (so `git status` may show "ahead"
  falsely — the commits ARE on GitHub). **Recommended: `gh auth login` once.**
  A token action failing = ask Arnav for a fresh PAT.

Session commit history (newest first): `c04871f` flicker fix · `1c3224e` /
`24d87be` / `da06fa8` sheet-animation iterations · `259cc36` Share-PDF button ·
`c90e986` remove quote DRAFT watermark · `154ed6b` delete-business · `fae45db`
state-picker order · `33ccca9` dropdowns-show-name + lag · `4de9e88` perf ·
`1aa2258` the big redesign.

---

## 4. Database — schema & migrations

Migrations live in `supabase/migrations/`. **CRITICAL: there is no migration
tracking.** They are applied ad-hoc via the Supabase Management API (§6), not
the CLI. As of 2026-05-31 **0001–0010 ARE applied** to the live DB; **0011 is
written but NOT yet applied** (see below — apply it before the advance-billing
feature works). If you add a migration you must apply it yourself AND ideally set
up the CLI.

> A real bug happened because a migration existed in the repo but was never
> applied — always verify the live schema matches the repo; don't assume.

**Tables** (all RLS-enabled, scoped by `current_org_id()`):
`orgs`, `profiles`, `customers`, `product_templates`, `quotes`, `quote_lines`,
`invoices`, `invoice_lines`, `payments`, `org_invites`, `leads`.

**Migrations:**
- **0001_init** — core 9 tables, ENUMs, helpers (`set_updated_at`, `current_fy`,
  `current_org_id` SECURITY DEFINER), `handle_new_user` trigger (creates
  org+profile on first sign-in), `next_invoice_number`/`next_quote_number` RPCs,
  payment-recalc trigger `recalc_invoice_payment_status`, `org-assets` bucket.
  **Indexes already cover** `org_id` on every table + `customers(lower(name))`,
  `customers(phone)`, `quotes(status)`, `invoices(payment_status)`, FK columns,
  line `*_id` cols — so the DB is well-indexed (no perf migration needed).
- **0002_service_categories** — service line-item `craft` enum values.
- **0003_get_dashboard_counts** — `get_dashboard_counts()` RPC.
- **0004_team_invites** — `org_invites`, `current_org_role()`, invite attach.
- **0005_prevent_self_privilege_escalation** — block self role/org change.
- **0006_quote_share_links** — `quotes.share_token` + `get_shared_quote` +
  `respond_to_shared_quote` (anon).
- **0007_invoice_share_and_outstanding** — `invoices.share_token` +
  `get_shared_invoice`; recreates `get_dashboard_counts()` to add `outstanding`.
  Returns: `customers, products, unverified, open_quotes, unpaid_invoices,
  outstanding`.
- **0008_customer_statements** — `customers.share_token` + `get_customer_statement`.
- **0009_leads** — `leads` table + `lead_status` enum + RLS.
- **0010_delete_org** *(NEW, applied to prod this session)* — `delete_org()`
  SECURITY DEFINER RPC: owner-only, atomic, FK-safe wipe of the caller's org —
  deletes payments → invoice_lines → invoices → quote_lines → quotes →
  product_templates → customers → leads → org_invites → profiles → org → then the
  member **auth.users** rows. Granted to `authenticated`. **Not runtime-tested**
  (would destroy data) — first real use should be a throwaway business.
- **0011_invoice_milestones** *(NEW — written, NOT yet applied as of this handoff)* —
  `invoice_milestones` (id, invoice_id FK cascade, label, percent, amount,
  due_date, sort_order). An OPTIONAL payment schedule layered on an invoice
  ("50% advance, balance on completion"). It does NOT change GST/totals/payments —
  milestones are settled *greedily* by the invoice's cumulative `amount_paid`
  (logic in `src/lib/milestones.ts`). RLS scoped through the parent invoice, like
  `invoice_lines`. **Apply this before using advance billing.**

**Key FK on-delete notes (matter for delete/cascade):** `profiles.org_id` and
`quotes/invoices.customer_id` are **ON DELETE RESTRICT**; `customers/products/
quotes/invoices.org_id` are CASCADE; `profiles.id → auth.users` is CASCADE.
That's why `delete_org()` deletes in explicit order rather than a bare
`delete from orgs`.

**Other column notes:** `invoices` amount_paid/due/payment_status maintained by
the payments trigger; `quote_lines`/`invoice_lines` have generated `amount,
tax_amount, line_total` (don't write them); `customers.phone` is NOT NULL;
`orgs` has `brand_color`, bank/upi, `terms_text`, `signatory_name` (used by the
PDF + public pages). There is **no `orgs.tagline` column** (the PDF tagline is an
optional prop, currently unused — see §13).

**RLS pattern:** every domain table has org-scoped policies. Public share access
is via SECURITY DEFINER `get_shared_*`/`get_customer_statement` taking an
unguessable `share_token`. **Never** add a broad `anon` RLS policy.

---

## 5. Routes

**Authed app** (`src/app/(app)/`, AppBar + bottom nav):
- `/` — dashboard (money hero + needs-attention + Manage)
- `/customers` (+ `/new`, `/[id]`, `/[id]/statement`)
- `/products` (+ `/new`, `/[id]`)
- `/quotes` (+ `/new`, `/[id]`, `/[id]/edit`)
- `/invoices` (+ `/new` ← NEW direct-create, `/[id]`)
- `/leads` (+ `/new`, `/[id]`)
- `/reports`
- `/settings` (+ `/settings/team`, owner-only). Settings reuses `OnboardingForm`
  and now has an owner-only **Delete business** danger zone.

**Public** (no auth — prefixes listed in `proxy-helper.ts` `PUBLIC_PATHS`):
`/sign-in`, `/auth/callback`, `/onboarding`, `/q/[token]`, `/i/[token]`,
`/s/[token]`. Add new public prefixes there.

**Bottom nav = Home / Customers / [＋ Create] / Quotes / Invoices.** The centre
**＋** opens a bottom-sheet (`create-menu.tsx`): New quote / New invoice / New
customer / New lead / New product. Products / Leads / Reports / Settings are
reached from the dashboard ("Manage") / detail pages.

---

## 6. How to apply a migration (no CLI set up)

POST the SQL to the Management API with a **Supabase account PAT**
(create at https://supabase.com/dashboard/account/tokens):

```
POST https://api.supabase.com/v1/projects/hjlbxbymovuyuklzbfxu/database/query
Authorization: Bearer <SUPABASE_PAT>
Content-Type: application/json
body: { "query": "<sql>" }
```

200/201 = success. Anon/service-role keys **cannot** run DDL — only a PAT (or the
dashboard SQL editor). **Gotcha (PowerShell):** `ConvertTo-Json` mangled the SQL;
build the JSON body with manual escaping (`\` → `\\`, `"` → `\"`, strip `\r`,
`\n` → `\n`), ASCII-clean any em-dashes, and send as **UTF-8 bytes**
(`[System.Text.Encoding]::UTF8.GetBytes`). That's how 0010 was applied. Always
verify the change landed.

---

## 7. Conventions (follow these)

- **Server actions** in `actions.ts` (`'use server'`): `(prev, formData) =>
  Promise<State>`; `.bind(null, id)` per-instance; zod-parse
  `Object.fromEntries(formData)`; on success `revalidatePath()` +
  `redirect('/x?saved=<key>')`. New: `invoices/actions.ts` `createInvoice` mirrors
  `createQuote` + the quote→invoice GST split.
- **Toasts + cache sync:** `(app)/_components/toast-from-query.tsx` reads
  `?saved=`, toasts, and invalidates TanStack keys. Add a `MESSAGES` + (if needed)
  `INVALIDATIONS` entry for new `?saved=` values.
- **Lists are client components** (`useQuery` + browser Supabase client). **NEW:
  list pages now server-hydrate.** Query fetchers take an **optional
  `SupabaseClient`** (`fetchInvoicesList(client?)`, `fetchCustomersList(q, client?)`,
  etc.); the server `page.tsx` calls the fetcher with the **server** client and
  passes the result as **`initialData`** to the client list, so the first paint
  shows real rows (no skeleton), then the client revalidates. For keyed lists
  (customers/products) `initialData` is gated to the initial term/filter.
- **Selects → use `PickerField`** (`components/ui/picker-field.tsx`), NOT Base UI
  `Select`, for new forms. It's a searchable bottom-sheet that shows the **label**
  (Base UI `Select.Value` was showing the raw id/code — that bug is why the
  customer/quote/product/lead/onboarding selects were migrated). Form mode:
  `name` + `defaultValue` (renders a hidden input); controlled: `value` +
  `onValueChange`. Supports `options` or grouped `groups`, `searchable`.
  **Still on Base UI Select (NOT migrated):** payment **mode** (in the
  record-payment dialog — left to avoid a sheet-in-dialog) and team **role**.
- **Status pills → `Badge`** (`components/ui/badge.tsx`): variants neutral / brand
  / success / warning / danger / outline. Map payment/quote/lead status → variant.
- **Sharing → `ShareButton`** (`quotes/_components/share-button.tsx`): builds the
  real PDF and calls `navigator.share({ files:[pdf], text, title })` (OS sheet →
  WhatsApp / Mail / anything), with the public link in the caption; falls back to
  copy-link where Web Share files aren't supported. Used on quote + invoice detail.
  *(WhatsApp/web cannot auto-attach a PDF to a specific contact — only the paid
  Business API can; this is the realistic best.)*
- **Money:** `src/lib/format.ts` — `formatINR` (₹), `formatINRPlain` (grouped, no
  symbol), `formatINRForPdf`, dates, `currentFY`, `round2`, `amountInIndianWords`.
  GST split: CGST+SGST intra-state, IGST inter-state (org.state vs place_of_supply).
- **Animated figures:** `src/lib/use-count-up.ts` — `useCountUp` (0→target entrance,
  e.g. dashboard hero) and `useTween` (smooth in-place change, e.g. invoice balance).
  Both honour `prefers-reduced-motion`.
- **Optimistic mutations** (deletes; record/delete payment) — snapshot in
  `onMutate`, revert in `onError`, invalidate in `onSettled`. Mirror an existing one.
- **Public share pattern** (quotes/invoices/statements): `share_token` + a
  token-scoped SECURITY DEFINER RPC granted to `anon` + a `/q`,`/i`,`/s` route.
- **PDF:** `quotes/_components/quote-pdf.tsx` (shared by quotes & invoices), built
  from a `QuotePdfData` object via `buildPdfData`/`buildInvoicePdfData` on the
  detail pages. Roboto only.
- **Payment schedules (advance billing):** an invoice can carry optional
  `invoice_milestones` (e.g. "Advance 50% / Balance 50%"). Pure logic lives in
  `src/lib/milestones.ts` — `settleMilestones` greedily allocates `amount_paid`
  across installments; `resolveAmounts` makes the LAST installment absorb the
  rounding remainder so the schedule always ties to the total. The shared
  `PaymentPlanEditor` (`invoices/_components/payment-plan-editor.tsx`) is used by
  both the create form and the detail-page **Edit-plan dialog**
  (`payment-schedule.tsx` → `setInvoiceSchedule` action, which re-checks org
  ownership). The schedule is a display/tracking overlay only — it never touches
  GST, totals, or the payments ledger; the PDF renders it via
  `QuotePdfData.payment_schedule`.
- **UI:** mobile-first, `max-w-md` lists/detail, `max-w-2xl` forms. One primary
  action per screen; quiet secondary; Edit/Delete demoted to small links. Don't
  re-clutter. **Copy the nearest existing implementation** — the codebase is
  intentionally consistent.

---

## 8. Design system (the redesign — `globals.css` + primitives)

- **Surfaces:** warm paper background (`--background` ≈ `#FBF7F2`), pure-white
  **cards** that float on it with a soft, clay-tinted **shadow scale**
  (`--shadow-xs…xl`, overrides Tailwind defaults). Radius base `0.7rem`.
- **Colour tokens** (`:root` + dormant `.dark`): brand terracotta
  (`--brand`/`--primary` ≈ deep clay), `--brand-tint`/`--brand-strong`, plus
  **semantic** `--success / --warning / --destructive / --info` each with
  `-foreground`, `-tint`, `-strong`. Mapped in `@theme inline` so utilities like
  `bg-success-tint text-success-strong` exist. **All key pairs verified WCAG AA**
  (body 16:1, muted 6.4:1, white-on-primary 4.98:1, badges ≥5.2:1). Branded chart
  palette (`--chart-1…5`).
- **Type:** Fraunces (`font-heading`, also auto on h1/h2) for display/money;
  Geist for body. Utilities: `.text-overline` (uppercase tracked label),
  `.tabular` (tabular figures for money columns).
- **Motion:** easing tokens `--ease-out-expo`/`--ease-out-back`; keyframes
  `rise`, `pop`, `draw-check`, `sheen`; utilities `.animate-rise` (staggered
  entrance via inline `animationDelay`), `.animate-pop`, `.press` (tap
  scale-feedback). All gated by `prefers-reduced-motion`.
- **Primitives:** `Button`/`Input`/`Select`/`Textarea` bumped to ≥40–44px touch
  targets; `Card` got `shadow-sm` + hairline ring; new **`Badge`** and
  **`PickerField`**; `celebration.tsx` (`Confetti`, `SuccessCheck`).
- **Nav:** `bottom-nav.tsx` (4 tabs + centre `CreateMenu` FAB), `create-menu.tsx`
  (bottom-sheet). **App bar + bottom nav are solid `bg-background` (no
  backdrop-blur)** — blur caused mobile scroll jank.
- **Sheets** (Create menu + PickerField) animate with a **blur backdrop + a plain
  200ms slide** (`data-open:slide-in-from-bottom-6`). NOTE: adding `will-change` +
  an extra fade on top of the slide caused a **close flicker** — keep the sheet
  animation simple (this was reverted in `c04871f`).

---

## 9. Features implemented (all live in prod)

Auth (Google + dev sign-in) · onboarding wizard · Customers CRUD · Products/
services CRUD · Quotes (multi-line, templates, statuses, edit, delete) ·
**Quote→Invoice conversion** AND **direct invoice creation** (`/invoices/new`) ·
Invoices (read-only + payments ledger + record-payment, optimistic) · branded GST
**PDF** with real ₹ · **Share** (sends the actual PDF via the OS share sheet) ·
PWA + offline-first · team invites + roles · dashboard (money hero, counts,
outstanding) · **share links** (`/q`,`/i`,`/s`) · payment reminders (now folded
into Share) · **Reports** (sales, GST summary + CSV, receivables aging) · **Leads**
pipeline · search · **Delete business** (owner-only, guarded).

Flagship screens: **Home** (`_components/home-dashboard.tsx`) and **Invoice
get-paid** (`invoices/_components/invoice-money-hero.tsx` → `InvoiceMoneyHero` +
`InvoiceActions`).

**Built this session, PENDING deploy:** advance / milestone billing — an optional
payment schedule on invoices (advance + balance or custom), a milestone-aware
get-paid hero ("Next: Advance ₹X due …"), record-payment prefilled to the next
installment, the schedule on the PDF, and an Edit-plan dialog on any invoice
(covers quote-converted ones). Goes live once migration **0011** is applied + a
deploy. Build-verified (21 routes) + `tsc` clean.

---

## 10. Dev workflow

- **Run:** the preview tool reads the **workspace** launch config at
  `C:\Users\ARNAV\OneDrive\Desktop\claude code work\.claude\launch.json` (NOT the
  per-project `.claude/launch.json`). The `smallbiz-ops` entry now runs
  **`npm run dev -- -p 3001`** → **http://localhost:3001**.
- **Dev sign-in:** `/sign-in` shows a "Dev sign-in" button when
  `NODE_ENV=development` + `.env.local` has `NEXT_PUBLIC_DEV_TEST_EMAIL/PASSWORD`
  (`dev@local.test`). Dead-code-eliminated in prod builds.
- **Build:** `npm run build`. **STOP the dev server first** (`next dev` + `next
  build` together corrupts `.next/dev/types`). `tsc --noEmit` is a fast,
  dev-safe type check (doesn't touch `.next`).
- **Deploy:** push to `main` (see §3 for the inline-token method). **Ask Arnav
  before pushing to production** — though this session he repeatedly said "make
  it live", so confirm intent.
- **Verification reality:** this environment **cannot render the PDF headlessly
  or see live animation** — verify PDFs by downloading one in the app, and judge
  motion/perf on the **deployed** site, not dev.

---

## 11. Gotchas & hard-won lessons (READ before debugging)

- **The dev server is NOT representative of performance.** `localhost` dev
  (Turbopack, unminified, React dev double-render) is choppy, and the **first
  open of any route/menu compiles on demand** → a one-off hitch that feels like
  "stuck"/"lag". Always judge smoothness on **prod** (`biz-ops-kohl.vercel.app`).
  Much of the "jittery/laggy" feedback this session was the dev server.
- **Sheet animation:** keep it simple (blur backdrop + plain slide). `will-change`
  + stacked fade/slide caused a **close flicker**. Don't re-add them.
- **`backdrop-blur` on fixed/sticky bars** janks mobile scroll — the app bar +
  bottom nav are deliberately solid now.
- **Hydration:** never compute `new Date()`/random ids during a client render
  (server/client mismatch). Compute on the server + pass as props; deterministic
  ids for initially-rendered lists. The count-up/tween are safe because they only
  animate client-side after data loads.
- **Service worker** (`public/sw.js`, `smallbiz-ops-v3`): caches ONLY
  `/_next/static`, never HTML/RSC. After a deploy users may need a refresh; the
  SW self-heals (purges old caches on activate).
- **Base UI `Select`:** `Select.Value` can show the raw value (id/code) instead of
  the label — that's why selects were migrated to `PickerField`. Its hidden
  `<input>` also won't accept synthetic value-setting (real clicks only).
- **Preview/dev nav quirk:** a hard `window.location` nav to a first-compiling
  route can bounce to `/`; use client `Link` clicks or retry once warm.
- **`.single()` + org-wide RLS:** filter by `id = auth.uid()` for "my own row"
  (the team policy returns all org rows).
- **Tailwind v4:** the h1/h2 serif rule lives **outside** `@layer base` in
  `globals.css` (the compiler dropped it inside the layer).
- **Git LF→CRLF** warnings on Windows are harmless.

---

## 12. Security & secrets (action needed)

- **Rotate the secrets pasted in chat this session:** the **GitHub PAT** (`ghp_…`)
  and the **Supabase account PAT** (`sbp_…`). Also reset the service-role key
  (in `.env.local`, currently unused). Prefer `gh auth login` for future pushes.
- `delete_org()` is owner-gated **inside** the function (not just RLS) and atomic.
  Public `get_shared_*`/`get_customer_statement` RPCs stay token-scoped + sanitized
  — never widen them or add broad anon RLS.
- `/settings/team` owner-gated server-side + RLS; `0005` blocks self role/org change.
- Phase-2 multi-tenant hardening (column-level grants) still light — review before
  onboarding untrusted tenants.

---

## 13. Known gaps / good next steps

- **Finish the PickerField rollout:** migrate the remaining Base UI selects —
  payment **mode** (record-payment dialog) and team **role** — if they show codes.
- **PDF serif masthead:** the masthead is Roboto. To use a Fraunces-like serif,
  drop a **static** serif `.ttf` into `public/fonts`, `Font.register` it in
  `quote-pdf.tsx`, and apply to the org name + doc title (keep ₹ amounts in
  Roboto). Couldn't fetch a font this session (no outbound network for it).
- **Delete-business variant:** current `delete_org()` deletes the org **and** all
  member auth accounts (clean full removal). If Arnav wants "keep my login, just
  wipe the data", that's a different RPC + a re-onboard path for a profile-less user.
- **Online payments + auto-reminders** (Razorpay/Cashfree "Pay Now" + auto-
  reconcile; scheduled WhatsApp reminders) — highest-value next feature.
- ~~Advance/milestone billing~~ — **built this session** (apply 0011 + deploy to
  ship). Remaining follow-ups: quote-side payment-terms carry-through on
  conversion, milestone-aware reporting, and showing the schedule on the public
  `/i/[token]` page (the shared PDF already carries it).
- **Expenses/purchases register → profit per project** (+ GST input credit).
- **Product photos → visual quotes** (decor differentiator).
- **Reports visualisation** (charts), **credit notes / invoice cancellation**
  (GST-compliant), **migration tracking** (Supabase CLI), **Hindi/bilingual**.
- **Dark mode** is dormant (tokens exist, no provider) — wire `next-themes` or
  remove the dead tokens.
- **Polish bugs noted:** dashboard "Review" badge wording on the (now-removed)
  Invoices card; initials "R(" for "(walk-in)" names; invoice "Billed to" showing
  a bare state code when no address.

---

## 14. Map of the source

```
src/
├── app/
│   ├── (app)/                      authed group (bottom nav)
│   │   ├── _components/            app-bar, bottom-nav, create-menu (NEW),
│   │   │                           home-dashboard (redesigned), toast-from-query,
│   │   │                           network-status-badge
│   │   ├── page.tsx                dashboard shell
│   │   ├── customers/  products/  quotes/  leads/   (list/new/[id] + _components
│   │   │                           + actions.ts each; lists server-hydrate)
│   │   ├── invoices/               list + [id] + new/ + actions.ts (createInvoice,
│   │   │                           setInvoiceSchedule)
│   │   │   └── _components/         invoices-list, invoice-money-hero (hero + actions,
│   │   │                           milestone-aware), invoice-form, record-payment-dialog,
│   │   │                           payments-ledger, payment-plan-editor (NEW),
│   │   │                           payment-schedule (NEW: tracker + edit dialog)
│   │   ├── quotes/_components/      quote-form, quote-pdf, pdf-download-button,
│   │   │                           share-button (NEW), quote-actions, delete-button
│   │   ├── reports/                + _components/reports-view
│   │   └── settings/               + _components/delete-business (NEW); + settings/team
│   ├── q/[token]/  i/[token]/  s/[token]/    PUBLIC token pages
│   ├── sign-in/ (shows ?deleted=1 note)  onboarding/  auth/callback/
│   ├── layout.tsx                  fonts (Geist + Fraunces), QueryProvider, Toaster, SW
│   ├── manifest.ts                 globals.css
├── components/
│   ├── ui/                         button, card, input, textarea, select, label,
│   │                               checkbox, dialog, sonner, badge (NEW), picker-field (NEW)
│   ├── celebration.tsx             Confetti + SuccessCheck (NEW)
│   ├── query-provider.tsx          sw-register.tsx
├── lib/
│   ├── supabase/                   server.ts (async), browser.ts, proxy-helper.ts
│   ├── queries/                    customers, products, quotes, invoices, payments,
│   │                               dashboard, reports, statements, leads, team
│   │                               (fetchers now accept an optional SupabaseClient)
│   ├── enums.ts  india.ts  format.ts  use-count-up.ts  milestones.ts (NEW: schedule logic)  utils.ts
├── proxy.ts                        auth refresh + public-path bypass
public/fonts/Roboto-*.ttf           (no serif yet) · public/sw.js (v3)
supabase/migrations/0001..0011.sql  (0010 delete_org applied; 0011 invoice_milestones NOT yet applied)
```

When in doubt, copy the nearest existing implementation of the same shape — the
codebase is intentionally consistent (every list, share link, CRUD, and now every
picker/sheet follows the same template).
