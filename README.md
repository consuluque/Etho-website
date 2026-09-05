# Etho — Marketing Site

Pre-launch marketing site for Etho. Plain static HTML/CSS/JS, no backend, no build step.

## Structure

```
index.html     — home page
partners.html  — providers and brands page (/partners)
home-v1.html   — the previous home page, kept for reference (noindex)
shop.html      — shop page ("coming soon")
privacy.html, terms.html
css/styles.css   — shared tokens, hero, nav, footer
css/landing.css  — the home and partners sections
js/main.js       — hero video, reveal-on-scroll, fixed nav, v1 waitlist form
js/landing.js    — email forms, logo marquee, sticky CTA, analytics
assets/images/ — drop product/lifestyle photos here (see below)
```

## Going back to the previous home page

The home page was replaced in September 2026. The old one is kept two ways:

- **`home-v1.html`** — the same file, live at `/home-v1` but held out of search
  so it never competes with the home page. To restore it, copy it back over
  `index.html`. It only needs `css/styles.css` and `js/main.js`, both unchanged.
- **Commit `4a207e4`** — the last commit before the change, if an exact
  rollback of the whole site is wanted: `git checkout 4a207e4`. Worth tagging
  so it stays easy to find:

  ```
  git tag -a home-v1 4a207e4 -m "Home page before the landing redesign"
  git push origin home-v1
  ```

## Landing page notes

Two things are still placeholders on the home page:

- **Provider and brand logos** are invented — plain SVG wordmarks in one house
  style, standing in for the real partners. Replace them in the `.logo-set`
  block of `index.html`.
- **Analytics** has no vendor wired up. `track()` in `js/landing.js` pushes
  `page_view`, `form_start`, `form_submit`, `form_success` / `form_error`,
  `section_view` and `scroll_depth` to `window.dataLayer`, calls `gtag` or
  `plausible` if either is on the page, and re-dispatches each one as an
  `etho:analytics` DOM event. Set `window.ETHO_DEBUG_ANALYTICS = true` in the
  console to watch them fire.

Both landing pages post their email forms to FormSubmit; each names its own
`_subject` and `data-form-name`, so signups and partner applications arrive
separately and report separately.

## Assets still needed

The original design referenced a hero photo and a decorative gradient background that
weren't included in the export, so the site currently ships with clean fallbacks instead
(a neutral background behind the hero, a CSS gradient behind the About section). To match
the original design exactly, add:

- `assets/images/hero-dog.jpg` — hero shot of a dog wearing the collar (referenced by `index.html`; falls back to a solid background if missing)
- `assets/images/gradient-b.png` — the "Gradient B" background used behind the About section's CTA (referenced by `css/styles.css`; falls back to a CSS gradient approximation if missing)

## Local preview

Any static file server works, e.g.:

```
npx serve .
```

## Deploying

Static site with no framework — Vercel (or any static host) can deploy it with zero config.
