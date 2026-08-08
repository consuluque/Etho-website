# Etho — Marketing Site

Pre-launch marketing site for Etho. Plain static HTML/CSS/JS, no backend, no build step.

## Structure

```
index.html   — landing page
shop.html    — shop page ("coming soon")
css/styles.css
js/main.js   — shop color/finish picker interactivity
assets/images/ — drop product/lifestyle photos here (see below)
```

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
