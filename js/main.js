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

const WAITLIST_EMAIL = 'consuluque@gmail.com';

// The markup ships a plain link as the no-JS fallback; here it is swapped
// for the real email form, which posts to FormSubmit.co.
function initWaitlist(slot) {
  const form = document.createElement('form');
  form.className = 'waitlist-form';
  form.innerHTML =
    '<input type="email" name="email" class="waitlist-input" placeholder="goodhuman@mail.com" required>' +
    '<button type="submit" class="btn-solid waitlist-submit">Join waitlist</button>';

  const status = document.createElement('p');
  status.className = 'waitlist-status';
  status.setAttribute('aria-live', 'polite');

  slot.replaceChildren(form, status);
  slot.classList.add('is-active');

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const input = form.querySelector('.waitlist-input');
    const submitBtn = form.querySelector('.waitlist-submit');
    const email = input.value.trim();
    if (!email) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    status.textContent = '';
    status.classList.remove('is-error');

    try {
      const res = await fetch('https://formsubmit.co/ajax/' + WAITLIST_EMAIL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, _subject: 'New Etho waitlist signup' }),
      });
      if (!res.ok) throw new Error('Request failed');

      slot.replaceChildren();
      const done = document.createElement('p');
      done.className = 'waitlist-status waitlist-status--done';
      done.textContent = "You're on the list — we'll be in touch.";
      slot.append(done);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Join waitlist';
      status.textContent = 'Something went wrong — please try again.';
      status.classList.add('is-error');
    }
  });
}

document.querySelectorAll('.waitlist-slot').forEach(initWaitlist);

// Some browsers ignore the autoplay attribute, so ask explicitly and let a
// refusal pass — the poster frame stands in. Reduced motion holds on the
// poster instead of playing.
function initHeroVideo(video) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const tryPlay = () => {
    if (reduced.matches || !video.paused) return;
    const played = video.play();
    if (played) played.catch(() => {});
  };

  const apply = () => {
    if (reduced.matches) {
      video.pause();
      video.currentTime = 0;
    } else {
      tryPlay();
    }
  };

  // A first play() can be refused while the file is still buffering, so ask
  // again as it becomes playable, and once more on the first interaction —
  // that gesture satisfies browsers that hold autoplay back entirely.
  video.addEventListener('loadeddata', tryPlay);
  video.addEventListener('canplay', tryPlay);
  ['pointerdown', 'touchstart', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, tryPlay, { once: true, passive: true });
  });

  apply();
  reduced.addEventListener('change', apply);
}

document.querySelectorAll('.hero__media').forEach(initHeroVideo);

// Fade each headline, paragraph and card in once, staggered within its
// group. The transform is dropped under prefers-reduced-motion by CSS.
function initReveal() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach((t) => t.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const group = [...entry.target.parentElement.querySelectorAll('[data-reveal]')];
        const step = Math.max(0, group.indexOf(entry.target));
        entry.target.style.transitionDelay = step * 70 + 'ms';
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.05 }
  );
  targets.forEach((t) => observer.observe(t));
}

initReveal();

// The fixed wordmark is cream over the hero video and has to darken once
// it is over the light page below.
function initFixedNav(nav) {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  if (!('IntersectionObserver' in window)) {
    nav.classList.add('is-past-hero');
    return;
  }

  new IntersectionObserver(
    ([entry]) => nav.classList.toggle('is-past-hero', !entry.isIntersecting),
    { rootMargin: '-80px 0px 0px 0px', threshold: 0 }
  ).observe(hero);
}

document.querySelectorAll('.site-nav').forEach(initFixedNav);
