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
404.html       — the old holding page, so unknown URLs still read as Etho
api/waitlist.js — the serverless function behind every waitlist form
vercel.json    — the redirects that point the archived pages at /
css/home.css   — what is specific to index.html; sits on the two below
css/styles.css — shared tokens, hero, nav, waitlist glass, legal pages
css/landing.css — the access form, the pinned bar, the home-v2 sections
css/coming-soon.css — the holding page's own stylesheet; shares nothing
js/home.js     — the word-by-word paragraph and the product story

home-v2.html   — the landing page that was live before the hero-only cut
home-v1.html   — the original home page, before that
partners.html  — providers and brands page
shop.html      — shop page ("coming soon")
privacy.html, terms.html
js/main.js       — hero video, reveal-on-scroll, fixed nav
js/landing.js    — waitlist forms, attribution, logo marquee, sticky CTA, analytics
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
- Looks the email up in Loops. A **new** contact is created with
  `source: website`, `userGroup: lead`, the attribution properties below,
  and a subscription to both mailing lists. An **existing** contact is
  left untouched: nothing overwrites its source, UTMs, user group or list
  subscriptions.
- Answers JSON to the fetch in `landing.js`. With scripting off, the form
  posts natively (urlencoded) and is sent back to `/?joined=1` (or
  `/?joined=0` on failure), which the page turns into the same message.

`landing.js` records first-touch attribution — the `utm_source`,
`utm_medium`, `utm_campaign` and `utm_content` parameters, the referring
site, and the page landed on — in `localStorage` under
`etho:attribution`, and sends it with the email. The first visit is
recorded whatever it carries. A record without UTMs is provisional and
is replaced by the first later visit that arrives by a tagged link; a
record with UTMs is never overwritten.

### Environment variables

Set these in the Vercel project (Production and Preview) — none are read
from the repo, and the API key must never reach the browser:

```
LOOPS_API_KEY        — from Loops → Settings → API
LOOPS_LIST_FRIENDS   — the ID of the "Friends of etho" mailing list
LOOPS_LIST_DEALS     — the ID of the "Deals & Promotions" mailing list
```

Mailing list IDs are in Loops under Audience → Mailing lists (or from
`GET /api/v1/lists`). The custom contact properties the function writes —
`utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `referrer`,
`landingPage` — have to exist in Loops first, or Loops rejects the
request.

### Local preview with the function

`npx serve .` serves the pages but not the function. To run both:

```
npx vercel link          # once, ties the folder to the Vercel project
npx vercel env pull      # writes .env.local (git-ignored)
npx vercel dev
```

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
