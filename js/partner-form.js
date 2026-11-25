/* The partner form on partners.html: one question a screen, a progress
   bar across the top, in the same sheet as the dog profile modal
   (profile.js, styled by home.css). Every [data-partner-open] button
   opens it; the answers are posted to /api/partner, which stores them in
   Supabase. Nothing goes to Loops.

   Built on the native <dialog>, so focus trapping, Escape and the inert
   page behind come for free. It can be closed at any point; nothing is
   saved until the last screen. Without scripting, or where <dialog> is
   unsupported, the buttons keep their link: an email to the team.

   Analytics go through track() in landing.js (partner_form_open,
   _step, _skip, _back, _abandon, _complete and _error), which also
   sends them to /api/event. */
(function () {
  const dialog = document.getElementById('partner-form');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const report = (name, props) => {
    if (typeof track === 'function') track(name, props);
  };

  const form = dialog.querySelector('[data-partner-form]');
  const done = dialog.querySelector('[data-partner-done]');
  const steps = Array.from(form.querySelectorAll('[data-step]'));
  const bar = dialog.querySelector('[data-partner-bar]');
  const backBtn = form.querySelector('[data-partner-back]');
  const skipBtn = form.querySelector('[data-partner-skip]');
  const nextBtn = form.querySelector('[data-partner-next]');
  const formError = form.querySelector('[data-partner-error]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  // By selector: form.name would be the form's own name, not the field.
  const field = (name) => form.querySelector('[name="' + name + '"]');

  const MESSAGES = {
    name: 'Please tell us your name.',
    email: 'Please enter a valid email address.',
    phone: 'Please enter a valid phone number, or skip this one.',
    consent: 'Please tick the box so we know we can get in touch.',
  };

  let index = 0;
  let source = '';
  let completed = false;
  let openedAt = 0;
  const stepName = () => steps[index].dataset.step;

  /* ---- the current step ------------------------------------------ */

  function controlsOf(step) {
    return Array.from(step.querySelectorAll('input:not([type="hidden"]), .chip'));
  }

  function show(i, direction) {
    index = Math.max(0, Math.min(steps.length - 1, i));
    const step = steps[index];
    const last = index === steps.length - 1;

    steps.forEach((el, n) => { el.hidden = n !== index; });
    dialog.dataset.activeStep = step.dataset.step;
    if (direction && !reduced.matches) {
      step.classList.remove('is-entering', 'is-entering-back');
      void step.offsetWidth; // restart the animation
      step.classList.add(direction === 'back' ? 'is-entering-back' : 'is-entering');
    }

    bar.style.width = ((index + 1) / steps.length * 100) + '%';
    backBtn.hidden = index === 0;
    skipBtn.hidden = !step.hasAttribute('data-optional');
    nextBtn.textContent = last ? 'Submit' : 'Next';
    formError.textContent = '';
    const error = step.querySelector('[data-step-error]');
    if (error) error.textContent = '';

    // The dialog is announced by the question on screen.
    dialog.setAttribute('aria-labelledby', step.querySelector('.profile__question').id);
    // Typing steps focus their field; on the choice steps focus stays
    // off the chips so a phone does not light the first one up.
    const input = step.querySelector('input:not([type="checkbox"])');
    if (input) input.focus({ preventScroll: true });
    else if (direction) nextBtn.focus({ preventScroll: true });

    report('partner_form_step', { step: step.dataset.step, index: index + 1, form: source });
  }

  // Native constraint checks on the visible step only; the message goes
  // under the field rather than in the browser's bubble.
  function validate(step) {
    const error = step.querySelector('[data-step-error]');
    for (const control of step.querySelectorAll('input')) {
      if (control.checkValidity()) continue;
      if (error) error.textContent = MESSAGES[step.dataset.step] || control.validationMessage;
      control.focus();
      return false;
    }
    // type="tel" accepts anything: hold it to what a phone number is.
    if (step.dataset.step === 'phone') {
      const phone = field('phone').value.trim();
      const digits = phone.replace(/\D/g, '').length;
      if (phone && (!/^[0-9+()\-.\s]+$/.test(phone) || digits < 6 || digits > 15)) {
        error.textContent = MESSAGES.phone;
        field('phone').focus();
        return false;
      }
    }
    return true;
  }

  function clear(step) {
    step.querySelectorAll('input:not([type="checkbox"])').forEach((control) => { control.value = ''; });
    step.querySelectorAll('.chip').forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
  }

  /* ---- choices ------------------------------------------------------ */

  // "How many extra bookings" takes one answer, a second tap on it
  // takes it back; "how do you take bookings" takes any number.
  form.querySelectorAll('[data-chips]').forEach((group) => {
    const multiple = group.hasAttribute('data-multiple');
    group.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const pressed = chip.getAttribute('aria-pressed') !== 'true';
        if (!multiple) group.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
        chip.setAttribute('aria-pressed', String(pressed));
      });
    });
  });
  const chipValues = (name) => Array.from(
    form.querySelectorAll('[data-chips="' + name + '"] .chip[aria-pressed="true"]'),
    (chip) => chip.dataset.chip
  );

  /* ---- events ------------------------------------------------------ */

  backBtn.addEventListener('click', () => {
    report('partner_form_back', { step: stepName(), form: source });
    show(index - 1, 'back');
  });
  skipBtn.addEventListener('click', () => {
    report('partner_form_skip', { step: stepName(), form: source });
    clear(steps[index]);
    if (index < steps.length - 1) show(index + 1, 'next'); else form.requestSubmit();
  });

  // Enter in a field submits the form, which here means "Next".
  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    if (nextBtn.disabled) return;
    if (!validate(steps[index])) return;
    if (index < steps.length - 1) {
      show(index + 1, 'next');
      return;
    }

    const payload = Object.assign(
      {
        name: field('name').value.trim(),
        email: field('email').value.trim(),
        phone: field('phone').value.trim(),
        bookingsPerWeek: chipValues('bookings')[0] || '',
        bookingMethods: chipValues('methods'),
        consent: field('consent').checked,
        hp_field: field('hp_field').value,
        form: source,
      },
      typeof attributionForSubmit === 'function' ? attributionForSubmit() : {}
    );
    // landing.js always sends the page the visit landed on; the function
    // refuses a post without it, so a storage-less browser still has one.
    if (!payload.landingPage) payload.landingPage = window.location.pathname;

    nextBtn.disabled = true;
    nextBtn.textContent = 'Sending…';
    formError.textContent = '';
    try {
      if (typeof turnstileEnabled === 'function' && turnstileEnabled()) {
        payload.turnstileToken = await turnstileToken();
        if (!payload.turnstileToken) {
          report('partner_form_error', { form: source, reason: 'turnstile' });
          turnstileRetry();
          throw new Error('Something went wrong — please try again.');
        }
      }

      const res = await fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Something went wrong — please try again.');

      completed = true;
      bar.style.width = '100%';
      form.hidden = true;
      done.hidden = false;
      dialog.setAttribute('aria-labelledby', 'partner-done-title');
      done.querySelector('[data-partner-close]').focus();
      report('partner_form_complete', {
        form: source,
        seconds: Math.round((Date.now() - openedAt) / 1000),
        bookings: payload.bookingsPerWeek || 'skipped',
        methods: payload.bookingMethods.length,
        phone: Boolean(payload.phone),
      });
    } catch (err) {
      formError.textContent = err.message || 'Something went wrong — please try again.';
      if (!formError.textContent.includes('Too many')) report('partner_form_error', { form: source, step: stepName() });
    } finally {
      // A token is single-use: have the next one ready.
      if (typeof turnstileRefresh === 'function') turnstileRefresh();
      nextBtn.disabled = false;
      nextBtn.textContent = 'Submit';
    }
  });

  /* ---- the page behind, and the keyboard ---------------------------
     As in profile.js: opening locks the page's scroll (restored on
     close), and on a phone the sheet is sized and offset to the visual
     viewport while the keyboard is up, so the field and the button sit
     right above the keys. */
  const viewport = window.visualViewport;
  let pageScrollY = 0;

  function fitToKeyboard() {
    if (!viewport || !dialog.open) return;
    const keyboardUp = window.innerHeight - viewport.height > 120;
    dialog.classList.toggle('is-keyboard', keyboardUp);
    dialog.style.setProperty('--visible', keyboardUp ? viewport.height + 'px' : '');
    dialog.style.transform = keyboardUp ? 'translateY(' + viewport.offsetTop + 'px)' : '';
    if (keyboardUp) dialog.scrollTop = 0;
  }
  if (viewport) {
    viewport.addEventListener('resize', fitToKeyboard);
    viewport.addEventListener('scroll', fitToKeyboard);
  }

  function lockPage() {
    pageScrollY = window.scrollY;
    document.body.style.top = -pageScrollY + 'px';
    document.body.classList.add('profile-open');
  }
  function unlockPage() {
    document.body.classList.remove('profile-open');
    document.body.style.top = '';
    window.scrollTo(0, pageScrollY);
    dialog.classList.remove('is-keyboard');
    dialog.style.removeProperty('--visible');
    dialog.style.transform = '';
  }

  function open(from) {
    source = from || '';
    completed = false;
    openedAt = Date.now();
    form.reset();
    steps.forEach(clear);
    form.hidden = false;
    done.hidden = true;
    if (!dialog.open) {
      lockPage();
      dialog.showModal();
    }
    // Cloudflare's script is only fetched once someone opens the form.
    if (typeof startTurnstile === 'function') startTurnstile();
    report('partner_form_open', { form: source });
    show(0);
    fitToKeyboard();
  }

  // Closed by ×, Escape or a tap outside: if nothing was sent, that is
  // an abandon at this step.
  dialog.addEventListener('close', () => {
    unlockPage();
    if (completed) return;
    report('partner_form_abandon', {
      step: stepName(),
      index: index + 1,
      form: source,
      seconds: Math.round((Date.now() - openedAt) / 1000),
    });
  });

  dialog.querySelectorAll('[data-partner-close]').forEach((btn) => {
    btn.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', (evt) => {
    if (evt.target === dialog) dialog.close();
  });

  document.querySelectorAll('[data-partner-open]').forEach((link) => {
    // Warm Turnstile as the pointer arrives, so a token is ready by the
    // last question.
    const warm = () => { if (typeof startTurnstile === 'function') startTurnstile(); };
    link.addEventListener('pointerenter', warm, { once: true });
    link.addEventListener('touchstart', warm, { once: true, passive: true });
    link.addEventListener('click', (evt) => {
      if (evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.button !== 0) return;
      evt.preventDefault();
      open(link.dataset.partnerOpen);
    });
  });
})();
