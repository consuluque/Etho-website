# Etho — Marketing Site

Pre-launch marketing site for Etho. Plain static HTML/CSS/JS with no build
step, plus one Vercel serverless function that puts waitlist signups into
Loops (see "Waitlist" below).

## Structure

The site root is the landing page: a hero with the waitlist form, one
paragraph that darkens word by word as it is read, a product story told
through one pinned phone over three chapters, and the footer, with the
form pinned to the foot of the screen once the hero has scrolled away. Everything else is kept in the repo but redirected to the root —
see "Putting the site back" below.

```
index.html     — the landing page
privacy.html   — the privacy policy, served at /privacy (a rewrite in vercel.json)
terms.html     — the terms of service, served at /terms (likewise)
404.html       — the old holding page, so unknown URLs still read as Etho
api/waitlist.js — the serverless function behind every waitlist form
api/profile.js  — the function behind the dog profile modal
api/loops-sync.js — the Supabase webhook target that updates Loops
api/event.js    — first-party analytics events into Supabase
api/_lib/       — what the two functions share (not deployed as a function)
supabase/       — the migration for the waitlist_leads table
.vercelignore  — keeps this README and supabase/ out of the deployment
vercel.json    — the redirects that point the archived pages at /, and
                 the /privacy and /terms rewrites
css/home.css   — what is specific to index.html; sits on the two below
css/styles.css — shared tokens, hero, nav, waitlist glass, legal pages
css/landing.css — the access form, the pinned bar, the home-v2 sections
css/coming-soon.css — the holding page's own stylesheet; shares nothing
css/consent.css — the cookie banner, loaded by index.html and 404.html
js/meta-pixel.js — the Meta Pixel and its consent banner
js/home.js     — the word-by-word paragraph and the product story

home-v2.html   — the landing page that was live before the hero-only cut
home-v1.html   — the original home page, before that
partners.html  — providers and brands page
shop.html      — shop page ("coming soon")
js/main.js       — hero video, reveal-on-scroll, fixed nav
js/landing.js    — waitlist forms, attribution, logo marquee, sticky CTA, analytics
js/profile.js    — the dog profile modal; js/breeds.js is its breed list
assets/images/ — product/lifestyle photos (see below), and the tab and
                 home-screen icons (favicon-32/64, apple-touch-icon)
```

## Waitlist

Every waitlist form — the hero's, the pinned one, and the holding
page's — posts to `/api/waitlist`, a Vercel serverless function in
`api/waitlist.js` that creates the contact in [Loops](https://loops.so).
The function is dependency-free (Node's global `fetch`), so there is
still no `package.json` and no install step. Each form carries a
`data-form-name`, so the analytics events and the function's logs say
which one converted.

What the function does with a submission:

- Validates the email; drops any request whose honeypot field
  (`hp_field`, kept off-screen by CSS) has a value, while still answering
  as if it worked.
- Drops, the same quiet way, any request that did not come from one of
  the site's forms: it must name a known form (`form`, sent by
  `landing.js` and by a hidden input for no-JS posts) and carry an
  `Origin` (or `Referer`) from the host the function is served on.
  Scripts that post straight to the function, skipping the page, fail
  both. Logged as `[waitlist] dropped, not from a site form`. A new form
  needs its name added to `KNOWN_FORMS` in `api/waitlist.js`.
- Limits each connection (IP address) to 3 signups an hour
  (`RATE_LIMIT` in `api/waitlist.js`). Past that it answers 429 with a
  "try again later" message, which the form shows. Attempts are
  counted in the `waitlist_attempts` table, keyed by a hash of the IP,
  never the IP itself; create it with
  `supabase/migrations/20261111_waitlist_attempts.sql`. Until that table
  exists, or if Supabase errors, the limit is skipped and signups go
  through (logged as `[waitlist] rate limit skipped`).
- Looks the email up in Loops. A **new** contact is created with
  `source: website`, `userGroup: lead`, the attribution properties below,
  and a subscription to both mailing lists. An **existing** contact is
  left untouched: nothing overwrites its source, UTMs, user group or list
  subscriptions.
- Answers JSON to the fetch in `landing.js`. With scripting off, the form
  posts natively (urlencoded) and is sent back to `/?joined=1` (or
  `/?joined=0` on failure), which the page turns into the same message.

Every signup also writes a row to the `waitlist_leads` table in the
Supabase project the app uses (email, which form, attribution), best
effort: a Supabase failure is logged and does not fail the signup.

After a successful signup, `profile.js` opens the dog profile modal (a
native `<dialog>` in `index.html`) and posts it to `/api/profile`, which
merges the profile into that lead's row in Supabase and nothing else.
The signup's response carries a token (an HMAC of the email under
`LOOPS_SYNC_SECRET`); the profile is accepted only with it, so a profile
cannot be written against someone else's address. The breed
autocomplete is the list in `js/breeds.js`; "Other" among the struggles
opens a text field whose words are stored in the list in its place.

### Keeping Loops in step

Supabase is the source of truth after the signup. A Database Webhook on
`waitlist_leads` (INSERT and UPDATE) calls `/api/loops-sync`, which maps
the row to the contact in one `contacts/update`:

```
owner_name                        → firstName
dog_name, dog_breed, dog_age      → dogName, dogBreed, dogAge
dog_birthday_day/month            → dogBirthday ("MM-DD")
user_id                           → userId, and userGroup: user (null → lead)
converted_at                      → appSignupDate
```

Only set columns are sent, so a partial row never blanks a property.
Every insert or update syncs, so to re-sync a contact by hand, touch its
row: `update waitlist_leads set updated_at = now() where email = '…'`.
Source, the UTMs and the mailing lists are never touched after the
signup. To sync a new
column later, add it to the table and one line to `toLoops()`. The
custom properties `dogName`, `dogBreed`, `dogAge` (number),
`dogBirthday` and `appSignupDate` (date) have to exist in Loops.

Set the webhook up in Supabase under Database → Webhooks: table
`waitlist_leads`, events Insert and Update, HTTP request, POST to
`https://etho.pet/api/loops-sync`, with an HTTP header
`x-etho-webhook-secret` set to the same value as `LOOPS_SYNC_SECRET` on
Vercel, and a timeout of at least 5 seconds to allow for a cold start.

### Leads and users

`supabase/migrations/20260929_waitlist_leads.sql` creates the table.
A lead is a row whose `user_id` is null. When the same email signs up
in the app and confirms it, a trigger on `auth.users` fills `user_id`
with the account id and stamps `converted_at`, and the row is a user
from then on. Row level security is on with no policies, so only the
service role, which the functions use, can read or write it.

### Analytics

The only third-party vendor is the Meta Pixel (below). `track()` in `landing.js` pushes every
event to `dataLayer`, and every event named `waitlist_*` is also posted
to `/api/event`, which stores it in the `analytics_events` table in
Supabase (`supabase/migrations/20261001_analytics_events.sql`): `source`
(`website` here; the app uses `app` with `app_*` names), `event`, `props`,
a random `session_id` for the page visit, `page` and `created_at`. No
cookie, nothing that follows a person between visits.

The signup reports `waitlist_signup_start`, `waitlist_signup_submit`,
`waitlist_signup_success` and `waitlist_signup_error`, each with `form`
(`hero`, `sticky` or `holding`).

The modal reports through the same `track()` as the signup: `waitlist_profile_open`,
`waitlist_profile_step` (step name and 1-based index, on every question shown),
`waitlist_profile_skip`, `waitlist_profile_back`, `waitlist_profile_abandon` (closed before Done, with
the step and seconds open), `waitlist_profile_complete` (seconds, chip counts,
whether the breed is Mixed) and `waitlist_profile_error`. Every event carries
`form`, the signup form it followed.

Two queries to start with, in the SQL editor:

```sql
-- The funnel, last 7 days: visits reaching each step of the profile
select props->>'step' as step, count(distinct session_id) as visits
from public.analytics_events
where event = 'waitlist_profile_step' and created_at > now() - interval '7 days'
group by 1 order by 2 desc;

-- Where people give up
select props->>'step' as step, count(*) as abandons
from public.analytics_events
where event = 'waitlist_profile_abandon' and created_at > now() - interval '7 days'
group by 1 order by 2 desc;
```

### Meta Pixel

`js/meta-pixel.js` runs the Meta Pixel (ID `1125074893823259`) on
`index.html`, `partners.html`, `privacy.html`, `terms.html` and `404.html`, the pages a visitor can reach. It is
opt-in: the script shows a cookie banner and fetches nothing from Meta
until the visitor chooses Allow. The answer is kept in `localStorage`
under `etho:consent:marketing`; a browser sending Global Privacy Control
is treated as a no and never asked. "Cookie settings" in the footer (any
element with `data-consent-settings`) reopens the banner, and a later
"No thanks" revokes the pixel and clears its `_fbp`/`_fbc` cookies.
Meta's `<noscript>` image is left out, since it cannot ask first.

With consent the pixel sends one `PageView` per page load and a `Lead`
(`content_name` is the form: `hero`, `sticky` or `holding`) on
`waitlist_signup_success`, which fires only once `/api/waitlist` has
answered OK. It listens for that on the `etho:analytics` DOM event, so
`landing.js` itself is unchanged. To check it, set
`window.ETHO_DEBUG_ANALYTICS = true` or use Meta's Pixel Helper
extension; to ask again, clear `etho:consent:marketing` in localStorage.

`landing.js` records first-touch attribution — the `utm_source`,
`utm_medium`, `utm_campaign`, `utm_content` and `utm_term` parameters, the referring
site, and the page landed on — in `localStorage` under
`etho:attribution`, and sends it with the email. The first visit is
recorded whatever it carries. A record without UTMs is provisional and
is replaced by the first later visit that arrives by a tagged link; a
record with UTMs is never overwritten.

### Environment variables

Set these in the Vercel project (Production and Preview) — none are read
from the repo, and the API key must never reach the browser:

```
LOOPS_API_KEY              — from Loops → Settings → API
LOOPS_LIST_FRIENDS         — the ID of the "Friends of etho" mailing list
LOOPS_LIST_DEALS           — the ID of the "Deals & Promotions" mailing list
SUPABASE_URL               — the Project URL from Supabase → Project Settings →
                             Data API: https://<ref>.supabase.co, nothing else
SUPABASE_SERVICE_ROLE_KEY  — the service_role key from the same page.
                             Server-side only; it bypasses row level security.
LOOPS_SYNC_SECRET          — any long random string: the site's secret. The
                             Supabase webhook sends it in x-etho-webhook-secret,
                             and the signup signs each email with it so only
                             that browser can save a profile for the email
```

A variable takes effect on the next build, not when it is saved, so
redeploy after adding or changing one. Mailing list IDs are in Loops
under Audience → Mailing lists (or from `GET /api/v1/lists`). The custom contact properties the function writes —
`utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `referrer`,
`landingPage` — have to exist in Loops first, or Loops rejects the
request. `utm_term` is the exception: it goes to the `utm_term` column in
Supabase only (`supabase/migrations/20261103_waitlist_leads_utm_term.sql`),
never to Loops, so no Loops property is needed for it. Until that
migration has run, the lead row is written without it rather than lost.

### Meta ads URL parameters

Every Meta ad should carry these URL parameters (Ads Manager → the ad →
Tracking → URL parameters), so each signup records which campaign, ad
set and ad it came from:

```
utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}
```

The paid growth reports in the app repo (`growth/` in `consuluque/Etho`)
join these to Meta's spend.

### Local preview with the function

`npx serve .` serves the pages but not the function. To run both:

```
npx vercel link          # once, ties the folder to the Vercel project
npx vercel env pull      # writes .env.local (git-ignored)
npx vercel dev
```

## Cache busting

Every `<script src="js/…">` and `<link href="css/…">` carries `?v=<date>`.
Browsers that reuse a cached copy of a script or stylesheet have no other
signal that it changed, so bump the value (all pages at once) in any
release that touches a file in `js/` or `css/`:

```
sed -i '' 's/?v=[0-9]*/?v=20261101/g' *.html
```

## Search and AI discoverability

```
robots.txt   — every crawler allowed except /api/; points at the sitemap
sitemap.xml  — the canonical, indexable URLs (/, /partners, /privacy, /terms)
llms.txt     — a plain summary of Etho for AI assistants (optional; no
               guarantee any engine reads it)
```

- **New page?** Give it a `<link rel="canonical">` on `https://etho.pet/…`
  (no `.html`, no `www`), its own title, description and Open Graph tags,
  and add it to `sitemap.xml`. Update a page's `<lastmod>` when its content
  changes.
- **Structured data** (JSON-LD in each page's `<head>`) must match what the
  page shows. The FAQPage on `partners.html` repeats the FAQ answers word
  for word: change the two together. No invented ratings, prices or address.
- **`*.vercel.app` hosts** get `X-Robots-Tag: noindex` (`vercel.json`), so
  only etho.pet is indexed.
- **Share images** are `assets/images/og-home.jpg` and `og-partners.jpg`
  (1200×630).
- **Fonts** are all self-hosted in `assets/fonts/` (no Google Fonts
  request): Soyuz Grotesk, and Manrope as the variable font Google serves,
  declared at the top of `css/styles.css` and `css/coming-soon.css`.
- **Caching** (`vercel.json`): fonts are cached for a year (rename a font
  file to change it); images, videos, CSS and JS for a day, then
  revalidated in the background. CSS and JS still need the `?v=` bump below.

## Type scale

Every size of running text on the landing page comes from one of five
tokens on `:root` in `css/styles.css`, so a change there moves the page
together rather than one rule at a time:

```
--type-display   the hero headline (Soyuz Grotesk, 0% tracking)
--type-title     the product story's chapter titles
--type-lead-lg   the story paragraph
--type-lead      the hero subtitle, the chapter copy and the footer line
--type-body      the form field and the footer links
--type-small     the form button and its status line
```

`--type-lead-lg` is one step up from `--type-lead` on a wide screen and
meets it at 18px on a phone, so the paragraph reads at the subtitle's size
there. Add a new size only by adding a token here.

## Product story assets

Each chapter of the product story has a still and a film, named by
chapter and looked up at these paths:

```
assets/images/Web_Image_1.webp  assets/videos/Web_Video_1.mp4
assets/images/Web_Image_2.webp  assets/videos/Web_Video_2.mp4
assets/images/Web_Image_3.webp  assets/videos/Web_Video_3.mp4
```

The stills are WebP at quality 85, encoded from the supplied PNGs, which
took them from about 2.2MB each to under 140KB. The still is what shows
first; the film fades in over it once it is actually running, and never shows at all under prefers-reduced-motion.
A missing film leaves the still up, so a chapter degrades to its photo.

The Commission Factory verification file is deliberately **not** redirected:
it is a domain-ownership proof read by a machine, not a page, and it has to
keep serving its token at its own URL.

## Putting the site back

Nothing was deleted, so bringing an archived page back is two steps:

1. To swap the landing page, copy the version you want over `index.html`
   — `home-v2.html` for the earlier landing page, `home-v1.html` for the
   original.
2. Delete its redirects from `vercel.json` (or the whole file) so the page
   serves again at its own URL.

The redirects are temporary (307), not permanent, so no browser or crawler
caches them as final — the old URLs start working again the moment the
config is removed.

Earlier versions are also in git: commit `4a207e4` is the site before the
landing redesign. Worth tagging so it stays easy to find:

```
git tag -a home-v1 4a207e4 -m "Home page before the landing redesign"
git push origin home-v1
```

## Local preview

Any static file server works for the pages themselves, e.g.:

```
npx serve .
```

The waitlist form needs the function too — see "Waitlist" above.

## Deploying

No framework and no build: Vercel deploys the pages as static files and
`api/waitlist.js` as a serverless function with zero config. The three
environment variables under "Waitlist" have to be set on the project
before the form can reach Loops.
