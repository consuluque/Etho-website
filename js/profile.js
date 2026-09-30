/* The dog profile modal: one question a screen, a progress bar across
   the top. It opens on the etho:signup event landing.js fires the moment
   an email is submitted, so there is nothing to wait for, and closes
   again on etho:signup-failed. Built on the native <dialog>, so focus
   trapping, Escape and the inert page behind come for free. It can be
   closed at any point; the email is saved regardless.

   Analytics go through track() in landing.js, so they reach whatever
   the page reports to: waitlist_profile_open, waitlist_profile_step (each question as
   it shows), waitlist_profile_skip, waitlist_profile_back, waitlist_profile_abandon (closed
   before Done, with the step it was on), waitlist_profile_complete and
   waitlist_profile_error. */
(function () {
  const dialog = document.getElementById('dog-profile');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const report = (name, props) => {
    if (typeof track === 'function') track(name, props);
  };

  const form = dialog.querySelector('[data-profile-form]');
  const done = dialog.querySelector('[data-profile-done]');
  const steps = Array.from(form.querySelectorAll('[data-step]'));
  const emailInput = form.querySelector('[name="email"]');
  const nameInput = form.querySelector('[name="dogName"]');
  const bar = dialog.querySelector('[data-profile-bar]');
  const mixInput = form.querySelector('[data-breed-mix]');
  const backBtn = form.querySelector('[data-profile-back]');
  const skipBtn = form.querySelector('[data-profile-skip]');
  const nextBtn = form.querySelector('[data-profile-next]');
  const formError = form.querySelector('[data-profile-error]');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let index = 0;
  let signupForm = '';
  let completed = false;
  let openedAt = 0;
  const stepName = () => steps[index].dataset.step;
  // The signup answers with a token for the email; the profile cannot
  // be saved without it. It arrives while the questions are being
  // answered, so submit waits for it briefly if it has not yet.
  let token = null;
  let tokenReady = null;
  let tokenResolve = null;

  /* ---- pickers ------------------------------------------------------
     One list component for the breed field and the two birthday
     fields: it opens under its trigger at the trigger's width, closes
     on Escape, blur or a choice, and takes ArrowUp/Down and Enter. The
     breed's trigger is the text field itself, filtered as you type
     and free to hold anything typed; the day and month triggers are
     buttons over a hidden input. */
  const MIXED = 'Mixed';

  function createPicker(root, options, pinned) {
    const trigger = root.querySelector('[data-picker-trigger]');
    const list = root.querySelector('[data-picker-list]');
    const hidden = root.querySelector('input[type="hidden"]');
    const label = root.querySelector('[data-picker-label]');
    const typed = trigger.tagName === 'INPUT';
    const placeholder = label ? label.textContent : '';
    let items = [];
    let active = -1;

    const value = () => (typed ? trigger.value.trim() : hidden.value);
    const isOpen = () => !list.hidden;

    function render(query) {
      const q = (query || '').trim().toLowerCase();
      items = q
        ? options.filter((o) => o.label.toLowerCase().includes(q))
            .sort((a, b) => rank(a, q) - rank(b, q))
        : options.slice();
      // A pinned option always heads the list, whatever is typed.
      if (pinned && !items.some((o) => o.value === pinned.value)) items.unshift(pinned);
      list.replaceChildren();
      items.forEach((o, i) => {
        const li = document.createElement('li');
        li.className = 'picker__option';
        li.id = list.id + '-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(o.value === value()));
        li.textContent = o.label;
        li.addEventListener('mousedown', (evt) => evt.preventDefault()); // keep focus on the trigger
        li.addEventListener('click', () => choose(i));
        list.append(li);
      });
      return items.length;
    }
    // Exact match first, then names that start with the text, then the rest.
    function rank(o, q) {
      const l = o.label.toLowerCase();
      return l === q ? 0 : l.startsWith(q) ? 1 : 2;
    }

    function open(query) {
      if (!render(query)) { close(); return; }
      list.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const selected = items.findIndex((o) => o.value === value());
      // With text typed, the first real match is highlighted, not the
      // pinned option above it.
      const first = pinned && query && items.length > 1 ? 1 : 0;
      setActive(selected >= 0 ? selected : (typed && !query ? -1 : first));
    }
    function close() {
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      active = -1;
    }
    function setActive(i) {
      active = i;
      Array.from(list.children).forEach((li, n) => li.classList.toggle('is-active', n === i));
      if (i >= 0) {
        trigger.setAttribute('aria-activedescendant', list.children[i].id);
        list.children[i].scrollIntoView({ block: 'nearest' });
      } else {
        trigger.removeAttribute('aria-activedescendant');
      }
    }
    function choose(i) {
      const o = items[i];
      if (!o) return;
      set(o.value, o.label);
      close();
      trigger.focus();
      trigger.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function set(val, text) {
      if (typed) {
        trigger.value = text || val || '';
      } else {
        hidden.value = val || '';
        label.textContent = val ? (text || val) : placeholder;
        root.classList.toggle('is-empty', !val);
      }
    }

    trigger.addEventListener('click', () => {
      if (typed) { if (!isOpen()) open(trigger.value); return; }
      if (isOpen()) close(); else open();
    });
    if (typed) {
      trigger.addEventListener('input', () => open(trigger.value));
      trigger.addEventListener('focus', () => open(trigger.value));
    }
    trigger.addEventListener('blur', close);
    trigger.addEventListener('keydown', (evt) => {
      if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
        evt.preventDefault();
        if (!isOpen()) { open(typed ? trigger.value : ''); return; }
        const step = evt.key === 'ArrowDown' ? 1 : -1;
        setActive((active + step + items.length) % items.length);
      } else if (evt.key === 'Enter' || (evt.key === ' ' && !typed)) {
        if (isOpen() && active >= 0) {
          // Enter on text that already is the highlighted breed means
          // "next", not "pick it again": close and let the form submit.
          if (typed && items[active].label.toLowerCase() === trigger.value.trim().toLowerCase()) { close(); return; }
          evt.preventDefault();
          choose(active);
        } else if (!typed) {
          evt.preventDefault();
          open();
        }
        // Enter on the text field with nothing highlighted falls through
        // to the form, which means Next.
      } else if (evt.key === 'Escape' && isOpen()) {
        // Ours, not the dialog's.
        evt.preventDefault();
        evt.stopPropagation();
        close();
      } else if (evt.key === 'Tab') {
        close();
      }
    });

    return { set: set, root: root };
  }

  const pickers = {
    breed: createPicker(form.querySelector('[data-picker="breed"]'),
      (window.ETHO_BREEDS || []).map((b) => ({ value: b, label: b })),
      { value: MIXED, label: MIXED }),
    day: createPicker(form.querySelector('[data-picker="day"]'),
      Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))),
    month: createPicker(form.querySelector('[data-picker="month"]'),
      MONTHS.map((name, i) => ({ value: String(i + 1), label: name }))),
  };
  const dayInput = form.querySelector('[name="dogBirthdayDay"]');
  const monthInput = form.querySelector('[name="dogBirthdayMonth"]');

  const breedInput = form.querySelector('[name="dogBreed"]');
  const isMixed = () => breedInput.value.trim().toLowerCase() === MIXED.toLowerCase();
  function syncMixField(focusIt) {
    const mixed = isMixed();
    if (!mixed) mixInput.value = '';
    mixInput.hidden = !mixed;
    if (mixed && focusIt) mixInput.focus();
  }
  breedInput.addEventListener('input', () => syncMixField(false));
  breedInput.addEventListener('change', () => syncMixField(true));

  /* ---- the current step ------------------------------------------ */

  const dogName = () => nameInput.value.trim();

  // Every question after the first speaks about the dog by name.
  function syncQuestions() {
    const name = dogName() || 'your dog';
    form.querySelectorAll('[data-question]').forEach((legend) => {
      legend.textContent = legend.dataset.question.replace('{dog}', name);
    });
  }

  function controlsOf(step) {
    return Array.from(step.querySelectorAll('input:not([type="hidden"]):not([hidden]), .profile__select, .chip'));
  }

  function show(i, direction) {
    index = Math.max(0, Math.min(steps.length - 1, i));
    const step = steps[index];
    const last = index === steps.length - 1;

    steps.forEach((el, n) => { el.hidden = n !== index; });
    if (direction && !reduced.matches) {
      step.classList.remove('is-entering', 'is-entering-back');
      void step.offsetWidth; // restart the animation
      step.classList.add(direction === 'back' ? 'is-entering-back' : 'is-entering');
    }

    syncQuestions();
    bar.style.width = ((index + 1) / steps.length * 100) + '%';
    backBtn.hidden = index === 0;
    skipBtn.hidden = !step.hasAttribute('data-optional');
    nextBtn.textContent = last ? 'Done' : 'Next';
    formError.textContent = '';
    const error = step.querySelector('[data-step-error]');
    if (error) error.textContent = '';

    // Only the visible step can take focus; a legend's aria-labelledby
    // keeps the dialog announced by the current question.
    dialog.setAttribute('aria-labelledby', step.querySelector('.profile__question').id || 'profile-title');
    const first = controlsOf(step)[0];
    if (first) first.focus({ preventScroll: true });

    report('waitlist_profile_step', { step: step.dataset.step, index: index + 1, form: signupForm });
  }

  const MESSAGES = {
    dogName: 'Please tell us your dog’s name.',
    dogBreed: 'Please tell us your dog’s breed.',
    ownerName: 'Please tell us your name.',
    dogAge: 'Please enter an age between 0 and 30.',
  };

  // Native constraint checks on the visible step only; the message goes
  // under the field rather than in the browser's bubble.
  function validate(step) {
    const error = step.querySelector('[data-step-error]');
    for (const control of step.querySelectorAll('input:not([type="hidden"]):not([hidden])')) {
      if (control.checkValidity()) continue;
      if (error) error.textContent = MESSAGES[step.dataset.step] || control.validationMessage;
      control.focus();
      return false;
    }
    // Birthday: both parts or neither, and a real date.
    if (step.dataset.step === 'dogBirthday') {
      const day = Number(dayInput.value);
      const month = Number(monthInput.value);
      const daysIn = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if ((day || month) && !(day && month && day <= daysIn[month - 1])) {
        error.textContent = 'Please choose a real day and month, or skip this one.';
        (day ? pickers.month : pickers.day).root.querySelector('[data-picker-trigger]').focus();
        return false;
      }
    }
    return true;
  }

  function clear(step) {
    step.querySelectorAll('input').forEach((control) => { control.value = ''; });
    step.querySelectorAll('[data-breed-mix], [data-other-for]').forEach((extra) => { extra.hidden = true; });
    step.querySelectorAll('[data-picker]').forEach((root) => pickers[root.dataset.picker].set(''));
    step.querySelectorAll('.chip').forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
  }

  /* ---- events ------------------------------------------------------ */

  form.querySelectorAll('[data-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const pressed = chip.getAttribute('aria-pressed') !== 'true';
      chip.setAttribute('aria-pressed', String(pressed));
      // An "Other" chip has a text field for what it stands for.
      const other = form.querySelector('[data-other-for="' + chip.dataset.chipGroup + '"]');
      if (other && chip.dataset.chip === 'other') {
        other.hidden = !pressed;
        if (pressed) other.focus(); else other.value = '';
      }
    });
  });
  const chipValues = (group) => Array.from(
    form.querySelectorAll('[data-chip-group="' + group + '"][aria-pressed="true"]'),
    (chip) => chip.dataset.chip
  );

  // Each question gets an id so the dialog and its group can point at it.
  steps.forEach((step, n) => {
    const question = step.querySelector('.profile__question');
    question.id = question.id || 'profile-question-' + n;
    step.setAttribute('aria-labelledby', question.id);
  });

  backBtn.addEventListener('click', () => {
    report('waitlist_profile_back', { step: stepName(), form: signupForm });
    show(index - 1, 'back');
  });
  skipBtn.addEventListener('click', () => {
    report('waitlist_profile_skip', { step: stepName(), form: signupForm });
    clear(steps[index]);
    if (index < steps.length - 1) show(index + 1, 'next'); else form.requestSubmit();
  });

  // Enter in a field submits the form, which here means "Next".
  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const step = steps[index];
    if (!validate(step)) return;
    if (index < steps.length - 1) {
      show(index + 1, 'next');
      return;
    }

    const payload = {
      email: emailInput.value,
      dogName: dogName(),
      dogBreed: isMixed() && mixInput.value.trim()
        ? MIXED + ' (' + mixInput.value.trim() + ')'
        : breedInput.value.trim(),
      dogAge: form.dogAge.value,
      dogBirthdayDay: dayInput.value,
      dogBirthdayMonth: monthInput.value,
      ownerName: form.ownerName.value.trim(),
      loves: chipValues('loves'),
      struggles: chipValues('struggles'),
      strugglesOther: form.strugglesOther.value.trim(),
      form: signupForm,
    };

    nextBtn.disabled = true;
    formError.textContent = '';
    try {
      // The signup normally answered long ago; give it a few seconds if not.
      payload.token = token || await Promise.race([
        tokenReady,
        new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      if (!payload.token) throw new Error('We couldn’t confirm your signup — please try again.');

      const res = await fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Request failed');

      completed = true;
      bar.style.width = '100%';
      done.querySelectorAll('[data-dog-name]').forEach((el) => { el.textContent = payload.dogName; });
      form.hidden = true;
      done.hidden = false;
      dialog.setAttribute('aria-labelledby', 'profile-done-title');
      done.querySelector('[data-profile-close]').focus();
      report('waitlist_profile_complete', {
        form: signupForm,
        seconds: Math.round((Date.now() - openedAt) / 1000),
        loves: payload.loves.length,
        struggles: payload.struggles.length,
        mixed: isMixed(),
      });
    } catch (err) {
      formError.textContent = err.message || 'Something went wrong — please try again.';
      report('waitlist_profile_error', { form: signupForm, message: err.message || 'Request failed' });
    } finally {
      nextBtn.disabled = false;
    }
  });

  /* ---- the page behind, and the keyboard ---------------------------
     Opening locks the page's scroll (restored on close). On a phone the
     keyboard covers the lower part of the screen; iOS does not shrink
     the layout viewport for it, so the sheet is sized and offset to
     the visual viewport, the part actually on screen, whenever that is
     clearly shorter than the window. Everything then fits above the
     keyboard and nothing has to scroll into view. */
  const viewport = window.visualViewport;
  let pageScrollY = 0;

  function fitToKeyboard() {
    if (!viewport || !dialog.open) return;
    const keyboardUp = window.innerHeight - viewport.height > 120;
    dialog.style.height = keyboardUp ? viewport.height + 'px' : '';
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
    dialog.style.height = '';
    dialog.style.transform = '';
  }

  function open(email, fromForm) {
    signupForm = fromForm || '';
    completed = false;
    openedAt = Date.now();
    token = null;
    tokenReady = new Promise((resolve) => { tokenResolve = resolve; });
    form.reset();
    steps.forEach(clear);
    emailInput.value = email;
    form.hidden = false;
    done.hidden = true;
    if (!dialog.open) {
      lockPage();
      dialog.showModal();
    }
    report('waitlist_profile_open', { form: signupForm });
    show(0);
    fitToKeyboard();
  }

  // Closed by ×, Escape, a tap outside or a failed signup: if the
  // profile was not saved, that is an abandon at this step.
  dialog.addEventListener('close', () => {
    unlockPage();
    if (completed) return;
    report('waitlist_profile_abandon', {
      step: stepName(),
      index: index + 1,
      form: signupForm,
      seconds: Math.round((Date.now() - openedAt) / 1000),
    });
  });

  dialog.querySelectorAll('[data-profile-close]').forEach((btn) => {
    btn.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', (evt) => {
    if (evt.target === dialog) dialog.close();
  });

  document.addEventListener('etho:signup', (evt) => {
    if (evt.detail && evt.detail.email) open(evt.detail.email, evt.detail.form);
  });
  document.addEventListener('etho:signup-confirmed', (evt) => {
    if (!evt.detail || evt.detail.email !== emailInput.value) return;
    token = evt.detail.token || null;
    if (tokenResolve) tokenResolve(token);
  });
  // The signup behind the modal failed: the person needs to see that.
  document.addEventListener('etho:signup-failed', () => {
    if (tokenResolve) tokenResolve(null);
    if (dialog.open && !form.hidden) dialog.close();
  });
})();
