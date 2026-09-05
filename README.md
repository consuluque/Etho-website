# Etho — Marketing Site

Pre-launch marketing site for Etho. Plain static HTML/CSS/JS, no backend, no build step.

## Structure

```
index.html   — landing page (live)
preview.html — candidate landing page, not yet live (noindex)
shop.html    — shop page ("coming soon")
css/styles.css   — shared tokens, hero, nav, footer
css/preview.css  — the preview's own sections, layered on styles.css
js/main.js       — hero video, reveal-on-scroll, fixed nav, waitlist form
js/preview.js    — preview only: early-access form, logo marquee, sticky CTA, analytics
assets/images/ — drop product/lifestyle photos here (see below)
```

## preview.html

A candidate replacement for the landing page, kept alongside the live one so the
two can be compared. It reuses `css/styles.css` unchanged and adds its own file,
so nothing in it can affect `index.html`.

Two things to swap before it goes live:

- **Provider and brand logos** are invented placeholders — plain SVG wordmarks in
  one house style, standing in for the real partners. Replace them in the
  `.logo-set` block of `preview.html`.
- **Analytics** has no vendor wired up. `track()` in `js/preview.js` pushes
  `page_view`, `form_start`, `form_submit`, `form_success` / `form_error`,
  `section_view` and `scroll_depth` to `window.dataLayer`, calls `gtag` or
  `plausible` if either is on the page, and re-dispatches each one as an
  `etho:analytics` DOM event. Set `window.ETHO_DEBUG_ANALYTICS = true` in the
  console to watch them fire.

Remove the `noindex` meta tag when it replaces `index.html`.

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
