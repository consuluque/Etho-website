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

function initInlineWaitlist(button) {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const slot = button.closest('.waitlist-slot');
    if (!slot) return;

    const form = document.createElement('form');
    form.className = 'waitlist-form';
    form.innerHTML =
      '<input type="email" name="email" class="waitlist-input" placeholder="you@example.com" required autofocus>' +
      '<button type="submit" class="btn-solid waitlist-submit">Join</button>';

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
        submitBtn.textContent = 'Join';
        status.textContent = "Something went wrong — please try again.";
        status.classList.add('is-error');
      }
    });
  });
}

document.querySelectorAll('.waitlist-btn').forEach(initInlineWaitlist);
