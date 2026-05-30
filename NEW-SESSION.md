# Paste this to start a new session

---

You are picking up development on **SmallBiz Ops**, an existing, deployed
mobile-first PWA for Indian small businesses (GST invoicing + ops). The repo is
this folder.

**First, before doing anything else:**
1. Read `CLAUDE.md` in this folder top-to-bottom — it's the full, current context
   (stack, schema/migrations 0001–0009, routes, conventions, gotchas, secrets).
2. Don't trust assumptions about the live database — there's no migration
   tracking. If your task touches the schema, verify the relevant tables/columns
   actually exist on the live Supabase project (`hjlbxbymovuyuklzbfxu`) first.
3. Note: secrets (a Supabase PAT, GitHub PAT, service-role key) were exposed in
   the previous build and may have been rotated — if a token-based action fails,
   ask me for a fresh one.

**How to work on this codebase:**
- Match the nearest existing implementation — every list, CRUD, and share-link
  follows the same template. Stay consistent; don't re-architect.
- **Verify changes in the running app**, not just by reading code — start the dev
  server, sign in with the "Dev sign-in" button (`dev@local.test`), and actually
  exercise the change before saying it's done.
- **Never run `next build` while `next dev` is running** (it corrupts
  `.next` generated types). Stop dev first.
- Deploying = `git push` to `main` (Vercel auto-deploys). Ask me before pushing
  to production.
- Watch the known traps in CLAUDE.md §10: hydration (no `new Date()`/random ids
  during client render), the service worker (static-only), the preview's
  first-compile navigation bounce.

**My task for this session:**
> <describe what you want — e.g. "Fix the bug where …", or "Build feature X
> from the 'known gaps' list in CLAUDE.md §12", or "Audit the leads Won/Lost +
> delete buttons which weren't click-tested.">

Start by reading `CLAUDE.md`, then tell me your plan before changing code.
