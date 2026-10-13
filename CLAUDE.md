# CLAUDE.md — Etho marketing site (etho.pet)

Pre-launch waitlist site for Etho, a dog-wellbeing app (Australia). README.md
is the long-form reference; this file covers what you must not get wrong.
Where README and this file disagree, this file is newer (README has stale
bits; see "Known doc drift").

## Stack

- Static HTML/CSS/JS. **No build, no framework, no package.json, no npm deps.**
  Don't add any without asking.
- 4 Vercel serverless functions in `api/` (CommonJS, Node global `fetch`,
  zero config). `api/_lib/` is shared code; the underscore stops Vercel from
  deploying it as a function.
- Supabase (via PostgREST + service-role key, no SDK) and Loops (email).
- Local: `npx serve .` (pages only) or `npx vercel dev` (pages + functions;
  needs `vercel link` + `vercel env pull` first).
- No tests, no linter, no CI. Verify in a browser at phone and desktop widths.

## What's live

Only `index.html` (hero + waitlist, word-by-word paragraph, pinned-phone
product story, footer, dog-profile modal), `404.html` (old "coming soon"
holding page, self-contained, uses `css/coming-soon.css`), the API, and the
Commission Factory file. Everything else is archived and 307-redirected to `/`
by `vercel.json`.

## Data flow (don't break the chain)

1. Form → `POST /api/waitlist`: honeypot check (`hp_field`), Loops
   `contacts/find`; **new** contact created with `source=website`,
   `userGroup=lead`, UTMs, both mailing lists; **existing** contact left
   untouched. Then best-effort upsert into Supabase `waitlist_leads`
   (failure logged, never fails signup). Returns `{ok, token}` where token =
   HMAC-SHA256(email, `LOOPS_SYNC_SECRET`). No-JS fallback redirects to
   `/?joined=1|0`.
2. Profile modal (`js/profile.js`) opens immediately on submit, waits up to
   8s for the token, → `POST /api/profile` → merges into the lead row
   (Supabase only).
3. Supabase Database Webhook (INSERT/UPDATE on `waitlist_leads`) →
   `POST https://etho.pet/api/loops-sync` with header
   `x-etho-webhook-secret` → one Loops `contacts/update`. Supabase is the
   source of truth after signup. Loops never gets source/UTMs/lists after
   signup, and deletions are not mirrored.
4. `track()` in `landing.js` → `dataLayer` always; only `waitlist_*` events
   are also posted to `/api/event` → `analytics_events`. No vendor, no
   cookies, per-visit random `session_id`.

## Things that break if changed carelessly

**Env vars** (Vercel, Production + Preview; redeploy after any change):
`LOOPS_API_KEY`, `LOOPS_LIST_FRIENDS`, `LOOPS_LIST_DEALS`, `SUPABASE_URL`
(bare `https://<ref>.supabase.co`), `SUPABASE_SERVICE_ROLE_KEY`,
`LOOPS_SYNC_SECRET`. Read-only: `VERCEL_ENV` (non-production responses
include error `detail`).
- `LOOPS_SYNC_SECRET` does double duty: webhook auth header **and** profile
  token signing. Rotating it means updating the Supabase webhook header too.
- Signup requires both list IDs; missing one = every signup 500s.

**Supabase** — it is the **app's** project, shared with the app:
- `supabase/migrations/20260929_waitlist_leads.sql` installs trigger
  `on_auth_user_confirmed` on **`auth.users`** (security definer) that links
  leads to accounts. If you rename/drop `waitlist_leads` or its columns
  without updating `link_waitlist_lead()`, **app email confirmations fail.**
- `analytics_events.source` is checked `in ('website','app')`; the app writes
  `app_*` events here too. Coordinate schema changes with the app.
- RLS on, no policies, by design. Only the service role touches these tables.
- Migrations are run by hand in the SQL editor; no migration tooling wired up.
- Adding a synced column: add column → add one line to `toLoops()` in
  `api/loops-sync.js` → create the custom property in Loops first (Loops
  rejects unknown properties).
- Chip values in `index.html` must match `LOVES`/`STRUGGLES` in
  `api/profile.js`; unknown values are silently dropped.

**Loops**: custom properties must already exist: `utmSource`, `utmMedium`,
`utmCampaign`, `utmContent`, `referrer`, `landingPage`, `dogName`,
`dogBreed`, `dogAge` (number), `dogBirthday` ("MM-DD"), `appSignupDate`
(date), plus `userGroup`, `userId`, `source`.

**Vercel / redirects**:
- Redirects are `permanent: false` (307) on purpose so archived pages can
  come back. Keep one rule per line in `vercel.json`.
- **Never add `cleanUrls`/`trailingSlash`** and never redirect
  `/commission-factory-b519c7f452734cc2af8581d5591c7564.html`: it is the
  Commission Factory (affiliate network) domain-verification token and must
  serve verbatim at that URL. That file is the only affiliate artefact in this
  repo; affiliate links live in the app.
- Webhook URL is hard-coded to `etho.pet`; a domain move needs the Supabase
  webhook updated.

**Front-end gotchas** (each was a real bug):
- `html { overflow-x: clip }` — never `hidden` (breaks `position: sticky`).
- Inputs stay ≥16px (iOS zooms on focus).
- `.hero__media` videos are removed from the DOM by `main.js` if autoplay is
  refused (stops iOS's play button). The poster/still must carry the section.
- MP4s must be faststart (moov atom first), muted, no audio. Stills as WebP q85.
- Product-story films are `preload="none"`; `home.js` controls fetching.
  Nothing plays under `prefers-reduced-motion`.
- Forms ship in markup and work with JS off; `.js` class on `<html>` gates
  reveal/scroll effects so the page is readable without scripts.
- Profile modal locks body scroll (`position: fixed`) and positions content
  against the visual viewport for the iOS keyboard. Steps use `h2` in a
  `role="group"`, **not** `<fieldset>/<legend>` (Safari layout bug).
- Honeypot must stay named `hp_field` (`website` gets autofilled).
- **Cache busting:** bump `?v=YYYYMMDD` on every `css/` and `js/` reference,
  on all pages, in any release touching those dirs. Linux:
  `sed -i 's/?v=2026[0-9]*/?v=NEWDATE/g' *.html` (README's `sed -i ''` is
  macOS-only, and its pattern also clobbers the favicons' `?v=3`).

## Design system

- Tokens on `:root` in `css/styles.css`. Page `#F7F5F0`, ink `#323031`.
- Type: **Soyuz Grotesk Bold** (self-hosted, bold-only) for the display
  headline/wordmark only, 0 tracking. **Manrope** (Google Fonts) for
  everything else; story paragraph -2%.
- Every text size comes from a token: `--type-display`, `--type-title`,
  `--type-lead-lg`, `--type-lead`, `--type-body`, `--type-small`. No literal
  font-sizes; add a token if you need a new size.
- Frosted-glass pills (fill + shadow, no rim/stroke) for the waitlist form
  and profile sheet.
- Contrast is measured: body ≥4.5:1, large ≥3:1 over video/photos.
- CSS layering for index: `styles.css` → `landing.css` → `home.css`.
  `coming-soon.css` shares nothing on purpose.

## Copy conventions

- Australian/British English (personalised, wellbeing, "on lead").
- Curly quotes/apostrophes (’ “ ”) in visible copy.
- Brand: "Etho" in prose; wordmark/logo is lowercase "etho".
- Waitlist button: **"Join waitlist"**. Email placeholder: `you@email.com`.
- Success: "You're in! Add another email?" Generic error:
  "Something went wrong — please try again."
- Warm, plain, dog-first tone; questions in the modal address the dog by name
  (`{dog}`).
- Mixed breeds are stored as `Mixed (Kelpie x Border Collie)`.
- Commit messages: imperative subject, prose body explaining *why*, no
  conventional-commit prefixes. Match the existing history.

## Deprecated — don't build on these

- `home-v1.html`, `home-v2.html`, `partners.html`, `shop.html` (archived,
  redirected). `home-v3` was deleted; only its redirect remains.
- `initShopConfigurator` in `js/main.js`, logo marquee and `.sticky-cta__btn`
  path in `landing.js`, home-v2 sections in `landing.css`.
- `gtag`/`plausible` hooks in `track()` — no vendor is installed.
- FormSubmit (replaced by `/api/waitlist`); native datalist/select pickers
  (replaced by the custom picker in `profile.js`).
- `hero--v3` / `hero-content--v3` class names are leftovers from home-v3 but
  ARE live — don't rename without updating CSS.
- Unreferenced assets: `DogBed.png`, `FishOil.png`, `Doggie1–5.png`,
  `Doggie3.jpg`, `etho logo white.png`, `etho-logo-black_cyrillic.png`
  (old mark), `gradient-b.png`, `hero-dog.jpg`.
- Stale comments: `js/breeds.js` says "datalist"; `initStickyCta` in
  `landing.js` says phone-only (it's pinned at every width via `home.css`).

## Open issues / flags (verify before acting)

- **Privacy & terms are redirected to `/`** (commit 193bfd6) while the site
  collects emails, profiles and funnel analytics, and those pages were
  originally published for Google OAuth consent-screen verification. Likely
  needs restoring (remove their redirects + add footer links).
- **Footer email `maria@etho.pet`** — commit 065d727 says etho.pet had no MX
  records; legal pages use `hello@ethopethealth.com`. Confirm which receives.
- **Profile token is weak protection:** `/api/waitlist` issues a token for
  *any* submitted email, so anyone can sign up someone else's address and
  then overwrite that lead's profile. Tokens never expire.
- **Attribution divergence:** for an existing contact, `recordLead()` still
  upserts the new visit's UTMs and `form` into Supabase (merge-duplicates),
  while Loops keeps first touch. Supabase UTMs ≠ first touch.
- Preview deployments use the same env vars → preview signups likely land in
  the production Supabase/Loops (unconfirmed whether Preview has separate
  values).
- Hero subtitle is commented out in `index.html` ("held back for now").
- Profile copy promises "early member perks" though earlier copy work removed
  "member" language — check intent.
- Stale open PR consuluque/Etho-website#11 (hero sub-line sizing) predates the
  subtitle being hidden; probably close.
- README `git tag home-v1 4a207e4` suggestion — unknown if done.

## Known doc drift in README

Says "one serverless function" (there are four), "three environment
variables" under Deploying (there are six), `_lib` shared by "two functions",
`supabase/` holds "the migration" (there are two).
