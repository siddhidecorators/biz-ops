# Deploy SmallBiz Ops to Vercel

A one-time setup that takes ~15 minutes. After this, every `git push` to
the `main` branch auto-deploys.

---

## 1. Push the project to GitHub

```bash
cd C:\Users\ARNAV\OneDrive\Desktop\smallbiz-ops

# If the repo isn't already a git repo
git init
git add .
git commit -m "Initial SmallBiz Ops"

# Create a NEW PRIVATE GitHub repo (this keeps your .env.local off the public
# internet even if you accidentally commit it). Use the GitHub website or:
gh repo create smallbiz-ops --private --source=. --remote=origin --push
```

Check `.gitignore` includes `.env.local` (it should — Next ships that by default).

---

## 2. Link to Vercel

1. Go to https://vercel.com/new
2. Click **Import** next to your `smallbiz-ops` repo
3. Vercel auto-detects Next.js — accept the defaults
4. **Before clicking Deploy**, click **Environment Variables** and add the
   two values from your local `.env.local`:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://hjlbxbymovuyuklzbfxu.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (copy from `.env.local`) |

   Apply to **Production, Preview, and Development**.

5. Click **Deploy**. First build takes ~2-3 minutes.

You'll get a URL like `https://smallbiz-ops-abc123.vercel.app`. Note it down
— call it `PROD_URL` below.

> **Tip**: in Project Settings → Domains, you can set a stable production URL
> like `smallbiz-ops.vercel.app` (no random hash). Use that as `PROD_URL`.

---

## 3. Tell Supabase about the new URL

1. Open https://supabase.com/dashboard/project/hjlbxbymovuyuklzbfxu/auth/url-configuration
2. **Site URL**: paste `PROD_URL` (e.g. `https://smallbiz-ops.vercel.app`)
3. **Redirect URLs**: add three entries (one per line):
   ```
   http://localhost:3000/**
   PROD_URL/**
   https://*.vercel.app/**
   ```
   The third covers preview deployments for branches/PRs.
4. Click **Save**.

---

## 4. Tell Google about the new URL

1. Open https://console.cloud.google.com/apis/credentials?project=siddhi-ops
2. Click into the **SmallBiz Ops Web** OAuth client
3. Under **Authorised JavaScript origins**, add:
   ```
   https://smallbiz-ops.vercel.app
   ```
   (Use whatever PROD_URL Vercel gave you. Keep `http://localhost:3000`.)
4. Under **Authorised redirect URIs** — already correct from the original
   setup, but verify it still contains:
   ```
   https://hjlbxbymovuyuklzbfxu.supabase.co/auth/v1/callback
   ```
5. Click **Save**. Wait 1-2 minutes for Google to propagate the change.

---

## 5. Verify

1. Open `PROD_URL` in a fresh browser window.
2. You should land on the sign-in screen with terracotta button + Fraunces.
3. Click **Sign in with Google** → pick Pankaj's account → consent screen
   (only the first time) → back to the home dashboard.
4. Open `/customers/new` → make a test customer → save → toast fires →
   customer appears in the list.

If sign-in lands you back on `/sign-in?error=auth_failed`, the OAuth origin
or Supabase redirect URL is wrong. Re-check steps 3 and 4.

---

## 6. Install to phone (Pankaj's daily driver)

### Android (Chrome)

1. Visit `PROD_URL` on the phone.
2. Tap the kebab menu (⋮) → **Install app** (or "Add to Home screen").
3. Confirm. The SmallBiz icon (terracotta tile with serif **S**) appears on
   the home screen.
4. Tap the icon — opens in standalone mode (no browser chrome).

### iOS (Safari)

1. Visit `PROD_URL` on the phone.
2. Tap the Share button → **Add to Home Screen**.
3. The icon goes on the home screen. iOS will use a screenshot of the page
   as the icon unless we ship a proper PNG (Phase 2 polish).

### Updating the installed app

Vercel auto-deploys on push. Open the installed app → pull-to-refresh
(or close and reopen). The service worker version-bumps and serves fresh.

---

## Recurring workflow after this

```bash
# Make a change
git add .
git commit -m "describe the change"
git push

# Vercel auto-builds and deploys to production. Pankaj sees the update
# on the next time he opens the app.
```

Preview deployments for branches:

```bash
git checkout -b feature/whatever
git push -u origin feature/whatever
```

Vercel posts a preview URL (e.g. `https://smallbiz-ops-git-feature-whatever-...vercel.app`)
where you can test before merging to `main`.

---

## Troubleshooting

**"Application error" on first load** — Vercel build succeeded but env vars
didn't get into the runtime. Check Vercel → Project → Settings → Environment
Variables and confirm both `NEXT_PUBLIC_*` keys are set for Production.

**"Sign-in failed" loop** — Supabase Site URL doesn't match the URL the user
typed. Set Site URL to the exact `PROD_URL`.

**Install banner doesn't appear on Android** — visit the site twice (Chrome's
heuristic). Or open DevTools → Application → Manifest to see install
diagnostics.

**Service worker not registering** — check DevTools → Application → Service
workers. The SW only runs in production builds (skipped in `next dev`).
