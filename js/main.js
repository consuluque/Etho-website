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

// The hero video is a backdrop. iOS paints its own start-playback button
// over any video it has refused to autoplay — in Low Power Mode it refuses
// every time — and neither CSS nor opacity reliably suppresses that
// control. So a video that will not play is taken out of the document
// entirely: with no element there is no button, and the hero's background
// still frame carries the section. A later tap puts it back and plays it.
function initHeroVideo(video) {
  const hero = video.parentElement;
  const anchor = video.nextSibling;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let detached = false;

  const detach = () => {
    if (detached) return;
    detached = true;
    video.classList.remove('is-playing');
    video.remove();
  };

  const attach = () => {
    if (!detached) return;
    detached = false;
    hero.insertBefore(video, anchor);
  };

  const tryPlay = () => {
    if (reduced.matches) {
      detach();
      return;
    }
    attach();
    if (!video.paused) return;
    const played = video.play();
    // A rejection is the browser refusing outright, which is exactly the
    // case that would draw the button.
    if (played) played.catch(detach);
  };

  // Only reveal the element once frames are actually running.
  video.addEventListener('playing', () => video.classList.add('is-playing'));
  video.addEventListener('pause', () => video.classList.remove('is-playing'));
  video.addEventListener('error', detach);

  // A first play() can be refused while the file is still buffering, so ask
  // again as it becomes playable, and once more on the first interaction —
  // that gesture satisfies browsers that hold autoplay back entirely.
  video.addEventListener('loadeddata', tryPlay);
  video.addEventListener('canplay', tryPlay);
  ['pointerdown', 'touchstart', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, tryPlay, { once: true, passive: true });
  });

  // Nothing running shortly after load means autoplay was declined without
  // rejecting the promise; drop the element rather than leave it showing.
  setTimeout(() => {
    if (!detached && video.paused) detach();
  }, 2500);

  tryPlay();
  reduced.addEventListener('change', tryPlay);
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
