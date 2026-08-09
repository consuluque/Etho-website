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

function initIntroStack() {
  const stack = document.querySelector('.intro-stack');
  const layer = document.querySelector('.intro-hero-layer');
  const card = document.querySelector('.intro-hero-card');
  const content = document.querySelector('.intro-hero-card .intro-content');
  const cue = document.querySelector('.intro-hero-card .scroll-cue');
  const logo = document.querySelector('.intro-hero-card .intro-hero-logo');
  if (!stack || !layer || !card) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const minScale = 0.32;
  let ticking = false;

  function update() {
    ticking = false;
    const scrollRange = stack.offsetHeight - window.innerHeight;
    if (scrollRange <= 0) return;
    const rect = stack.getBoundingClientRect();
    const raw = Math.min(Math.max(-rect.top / scrollRange, 0), 1);

    const shrink = Math.min(raw / 0.5, 1);
    const scale = 1 - shrink * (1 - minScale);
    card.style.transform = 'scale(' + scale + ')';
    // Stay fully opaque while shrinking (so the card only reveals what's
    // behind it around its shrinking edges, not through it), then fade
    // the remaining small card away at the very end of the shrink.
    const cardFade = Math.min(Math.max((shrink - 0.75) / 0.25, 0), 1);
    card.style.opacity = String(1 - cardFade);

    const fade = Math.min(raw / 0.28, 1);
    const fadeOpacity = String(1 - fade);
    if (content) content.style.opacity = fadeOpacity;
    if (cue) cue.style.opacity = fadeOpacity;
    if (logo) logo.style.opacity = fadeOpacity;

    layer.style.pointerEvents = shrink >= 0.98 ? 'none' : 'auto';
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

initIntroStack();
