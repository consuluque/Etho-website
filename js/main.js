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

function initIntroParallax() {
  const frame = document.querySelector('.intro-frame--photo');
  const img = frame && frame.querySelector('.intro-bg img');
  if (!frame || !img) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const maxShift = 70;
  let ticking = false;

  function update() {
    ticking = false;
    const stuckRange = frame.offsetHeight - window.innerHeight;
    if (stuckRange <= 0) return;
    const rect = frame.getBoundingClientRect();
    const progress = Math.min(Math.max(-rect.top / stuckRange, 0), 1);
    img.style.transform = 'scale(1.15) translateY(' + (progress * maxShift) + 'px)';
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  update();
}

initIntroParallax();
