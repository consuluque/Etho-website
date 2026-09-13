# Etho — Marketing Site

Pre-launch marketing site for Etho. Plain static HTML/CSS/JS, no backend, no build step.

## Structure

The site is currently a holding page. Everything else is kept in the repo
but redirected to it — see "Putting the site back" below.

```
index.html     — the holding page ("Coming soon"), all that is served
404.html       — a copy of it, so unknown URLs read the same
vercel.json    — the redirects that point every other page at /
css/coming-soon.css  — self-contained; shares nothing with the pages below

home-v2.html   — the landing page that was live before the holding page
home-v1.html   — the original home page, before that
partners.html  — providers and brands page
shop.html      — shop page ("coming soon")
privacy.html, terms.html
css/styles.css   — shared tokens, hero, nav, footer (used by the above)
css/landing.css  — the home and partners sections
js/main.js       — hero video, reveal-on-scroll, fixed nav, v1 waitlist form
js/landing.js    — email forms, logo marquee, sticky CTA, analytics
assets/images/ — drop product/lifestyle photos here (see below)
```

The Commission Factory verification file is deliberately **not** redirected:
it is a domain-ownership proof read by a machine, not a page, and it has to
keep serving its token at its own URL.

## Putting the site back

Nothing was deleted, so restoring is two steps:

1. Copy the version you want over `index.html` — `home-v2.html` for the
   landing page that was live most recently, `home-v1.html` for the
   original.
2. Delete the redirects from `vercel.json` (or the whole file) so the other
   pages serve again.

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

Any static file server works, e.g.:

```
npx serve .
```

## Deploying

Static site with no framework — Vercel (or any static host) can deploy it with zero config.
