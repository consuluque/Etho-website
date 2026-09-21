# Etho — Marketing Site

Pre-launch marketing site for Etho. Plain static HTML/CSS/JS, no backend, no build step.

## Structure

The site root is the landing page: a hero with the waitlist form, one
paragraph that darkens word by word as it is read, and the footer, with
the form pinned to the foot of the screen once the hero has scrolled
away. The privacy and terms pages serve alongside it; everything else is
kept in the repo but redirected to the root — see "Putting the site back"
below.

```
index.html     — the landing page
404.html       — the old holding page, so unknown URLs still read as Etho
vercel.json    — the redirects that point the archived pages at /
css/home.css   — what is specific to index.html; sits on the two below
css/styles.css — shared tokens, hero, nav, waitlist glass, legal pages
css/landing.css — the access form, the pinned bar, the home-v2 sections
css/coming-soon.css — the holding page's own stylesheet; shares nothing
js/home.js     — the word-by-word paragraph

home-v2.html   — the landing page that was live before the hero-only cut
home-v1.html   — the original home page, before that
partners.html  — providers and brands page
shop.html      — shop page ("coming soon")
privacy.html, terms.html — linked from the footer
js/main.js       — hero video, reveal-on-scroll, fixed nav, v1 waitlist form
js/landing.js    — email forms, logo marquee, sticky CTA, analytics
assets/images/ — product/lifestyle photos (see below)
```

Waitlist signups post to FormSubmit and arrive at the address in each
form's `action`. Both forms on the landing page — the hero's and the
pinned one — carry a `data-form-name`, so the analytics events say which
one converted.

## Type scale

Every size of running text on the landing page comes from one of five
tokens on `:root` in `css/styles.css`, so a change there moves the page
together rather than one rule at a time:

```
--type-display   the hero headline (Soyuz Grotesk, 0% tracking)
--type-lead-lg   the story paragraph
--type-lead      the hero subtitle and the footer line
--type-body      the form field and the footer links
--type-small     the form button and its status line
```

`--type-lead-lg` is one step up from `--type-lead` on a wide screen and
meets it at 18px on a phone, so the paragraph reads at the subtitle's size
there. Add a new size only by adding a token here.

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

Any static file server works, e.g.:

```
npx serve .
```

## Deploying

Static site with no framework — Vercel (or any static host) can deploy it with zero config.
