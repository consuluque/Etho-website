function initShopConfigurator(root) {
  const swatches = root.querySelectorAll('.swatch');
  const finishes = root.querySelectorAll('.finish');
  const types = root.querySelectorAll('.type-option');
  const sizes = root.querySelectorAll('.size-option');
  const stage = root.querySelector('.shop-stage');
  const collarEl = root.querySelector('.shop-collar');
  const deviceEl = root.querySelector('.shop-device');
  const collarValueEl = root.querySelector('[data-collar-value]');
  const deviceValueEl = root.querySelector('[data-device-value]');
  const sizeValueEl = root.querySelector('[data-size-value]');
  const typeBadgeEl = root.querySelector('[data-type-badge]');

  swatches.forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.style.background;
      const name = btn.getAttribute('aria-label');
      swatches.forEach((s) => s.classList.remove('selected'));
      btn.classList.add('selected');
      if (collarEl) collarEl.style.background = color;
      if (collarValueEl) collarValueEl.textContent = name;
    });
  });

  finishes.forEach((btn) => {
    btn.addEventListener('click', () => {
      const swatch = btn.querySelector('.finish-swatch');
      const color = swatch ? swatch.style.background : '';
      const label = btn.querySelector('.finish-label').textContent;
      const stageColor = btn.dataset.stage;
      finishes.forEach((f) => f.classList.remove('selected'));
      btn.classList.add('selected');
      if (deviceEl) deviceEl.style.background = color;
      if (deviceValueEl) deviceValueEl.textContent = label;
      if (stage && stageColor) stage.style.background = stageColor;
    });
  });

  types.forEach((btn) => {
    btn.addEventListener('click', () => {
      types.forEach((t) => t.classList.remove('selected'));
      btn.classList.add('selected');
      if (typeBadgeEl) typeBadgeEl.textContent = btn.querySelector('.type-option-name').textContent;
    });
  });

  sizes.forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.querySelector('.size-option-name').textContent;
      const range = btn.querySelector('.size-option-range').textContent;
      sizes.forEach((s) => s.classList.remove('selected'));
      btn.classList.add('selected');
      if (sizeValueEl) sizeValueEl.textContent = name + ' neck ' + range;
    });
  });
}

document.querySelectorAll('[data-shop-configurator]').forEach(initShopConfigurator);

function initSizingGuide(toggle) {
  const panel = document.querySelector('[data-sizing-guide-panel]');
  if (!panel) return;
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    toggle.textContent = open ? 'Hide sizing guide' : 'Sizing guide';
  });
}

document.querySelectorAll('[data-sizing-guide-toggle]').forEach(initSizingGuide);

function initNavToggle(toggle) {
  const nav = toggle.parentElement.querySelector('nav.links');
  if (!nav) return;

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 760) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

document.querySelectorAll('.nav-toggle').forEach(initNavToggle);

function initIntroShrink() {
  const wrap = document.querySelector('.intro-hero-wrap');
  const card = document.querySelector('.intro-hero-card');
  const content = document.querySelector('.intro-hero-card .intro-content');
  const cue = document.querySelector('.intro-hero-card .scroll-cue');
  const logo = document.querySelector('.intro-hero-card .intro-hero-logo');
  if (!wrap || !card) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const inset = 20;
  // Short on purpose: the whole shrink finishes within well under one
  // screen of scrolling, not a full pinned screen like a first attempt at
  // this effect did.
  const shrinkDistance = () => window.innerHeight * 0.4;
  const maxHeight = () => window.innerHeight - inset * 2;
  const minHeight = () => window.innerHeight * 0.16;

  let ticking = false;

  function update() {
    ticking = false;
    const raw = Math.min(Math.max(window.scrollY / shrinkDistance(), 0), 1);
    const max = maxHeight();
    const min = minHeight();
    const height = max - raw * (max - min);

    wrap.style.height = (height + inset * 2) + 'px';
    card.style.height = height + 'px';
    // Pinned to the viewport while shrinking; once the shrink finishes,
    // hand it back to normal document flow so it scrolls away like any
    // other section instead of staying stuck on screen forever.
    card.style.position = raw >= 1 ? 'absolute' : 'fixed';

    // Faded out well before the shrinking card's edge could reach the
    // revealed content below it, so the two never visibly overlap.
    const fadeT = Math.min(raw / 0.32, 1);
    const fadeOpacity = String(1 - fadeT);
    if (content) content.style.opacity = fadeOpacity;
    if (cue) cue.style.opacity = fadeOpacity;
    if (logo) logo.style.opacity = fadeOpacity;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
}

initIntroShrink();
