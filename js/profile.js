/* The dog profile modal: one question a screen, a progress bar across
   the top. It opens on the etho:signup event landing.js fires the moment
   an email is submitted, so there is nothing to wait for, and closes
   again on etho:signup-failed. Built on the native <dialog>, so focus
   trapping, Escape and the inert page behind come for free. It can be
   closed at any point; the email is saved regardless.
   Analytics deliberately not wired yet. */
(function () {
  const dialog = document.getElementById('dog-profile');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const form = dialog.querySelector('[data-profile-form]');
  const done = dialog.querySelector('[data-profile-done]');
  const steps = Array.from(form.querySelectorAll('[data-step]'));
  const emailInput = form.querySelector('[name="email"]');
  const nameInput = form.querySelector('[name="dogName"]');
  const bar = dialog.querySelector('[data-profile-bar]');
  const count = form.querySelector('[data-profile-count]');
  const backBtn = form.querySelector('[data-profile-back]');
  const skipBtn = form.querySelector('[data-profile-skip]');
  const nextBtn = form.querySelector('[data-profile-next]');
  const formError = form.querySelector('[data-profile-error]');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let index = 0;
  let signupForm = '';

  /* ---- pickers ------------------------------------------------------
     One list component for the breed field and the two birthday
     fields: it opens under its trigger at the trigger's width, closes
     on Escape, blur or a choice, and takes ArrowUp/Down and Enter. The
     breed's trigger is the text field itself, filtered as you type
     and free to hold anything typed; the day and month triggers are
     buttons over a hidden input. */
  function createPicker(root, options) {
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
      setActive(selected >= 0 ? selected : (typed && !query ? -1 : 0));
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
      (window.ETHO_BREEDS || []).map((b) => ({ value: b, label: b }))),
    day: createPicker(form.querySelector('[data-picker="day"]'),
      Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))),
    month: createPicker(form.querySelector('[data-picker="month"]'),
      MONTHS.map((name, i) => ({ value: String(i + 1), label: name }))),
  };
  const dayInput = form.querySelector('[name="dogBirthdayDay"]');
  const monthInput = form.querySelector('[name="dogBirthdayMonth"]');

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
    return Array.from(step.querySelectorAll('input:not([type="hidden"]), .profile__select, .chip'));
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
    count.textContent = (index + 1) + ' of ' + steps.length;
    backBtn.hidden = index === 0;
    skipBtn.hidden = !step.hasAttribute('data-optional');
    nextBtn.textContent = last ? (dogName() ? 'Done for ' + dogName() : 'Done') : 'Next';
    formError.textContent = '';
    const error = step.querySelector('[data-step-error]');
    if (error) error.textContent = '';

    // Only the visible step can take focus; a legend's aria-labelledby
    // keeps the dialog announced by the current question.
    dialog.setAttribute('aria-labelledby', step.querySelector('legend').id || 'profile-title');
    const first = controlsOf(step)[0];
    if (first) first.focus({ preventScroll: true });
  }

  // Native constraint checks on the visible step only; the message goes
  // under the field rather than in the browser's bubble.
  function validate(step) {
    const error = step.querySelector('[data-step-error]');
    for (const control of step.querySelectorAll('input:not([type="hidden"])')) {
      if (control.checkValidity()) continue;
      if (error) {
        error.textContent = control.validity.valueMissing
          ? (step.dataset.step === 'ownerName' ? 'Please tell us your name.' : 'Please tell us your dog’s ' + (step.dataset.step === 'dogBreed' ? 'breed.' : 'name.'))
          : (step.dataset.step === 'dogAge' ? 'Please enter an age between 0 and 30.' : control.validationMessage);
      }
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
    step.querySelectorAll('[data-picker]').forEach((root) => pickers[root.dataset.picker].set(''));
    step.querySelectorAll('.chip').forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
  }

  /* ---- events ------------------------------------------------------ */

  form.querySelectorAll('[data-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    });
  });
  const chipValues = (group) => Array.from(
    form.querySelectorAll('[data-chip-group="' + group + '"][aria-pressed="true"]'),
    (chip) => chip.dataset.chip
  );

  // Give each legend an id once so the dialog can point at it.
  steps.forEach((step, n) => { step.querySelector('legend').id = 'profile-question-' + n; });

  backBtn.addEventListener('click', () => show(index - 1, 'back'));
  skipBtn.addEventListener('click', () => {
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
      dogBreed: form.dogBreed.value.trim(),
      dogAge: form.dogAge.value,
      dogBirthdayDay: dayInput.value,
      dogBirthdayMonth: monthInput.value,
      ownerName: form.ownerName.value.trim(),
      loves: chipValues('loves'),
      struggles: chipValues('struggles'),
      form: signupForm,
    };

    nextBtn.disabled = true;
    formError.textContent = '';
    try {
      const res = await fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Request failed');

      bar.style.width = '100%';
      done.querySelectorAll('[data-dog-name]').forEach((el) => { el.textContent = payload.dogName; });
      form.hidden = true;
      done.hidden = false;
      dialog.setAttribute('aria-labelledby', 'profile-done-title');
      done.querySelector('.btn-solid').focus();
    } catch (err) {
      formError.textContent = err.message || 'Something went wrong — please try again.';
    } finally {
      nextBtn.disabled = false;
    }
  });

  function open(email, fromForm) {
    signupForm = fromForm || '';
    form.reset();
    steps.forEach(clear);
    emailInput.value = email;
    form.hidden = false;
    done.hidden = true;
    if (!dialog.open) dialog.showModal();
    show(0);
  }

  dialog.querySelectorAll('[data-profile-close]').forEach((btn) => {
    btn.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', (evt) => {
    if (evt.target === dialog) dialog.close();
  });

  document.addEventListener('etho:signup', (evt) => {
    if (evt.detail && evt.detail.email) open(evt.detail.email, evt.detail.form);
  });
  // The signup behind the modal failed: the person needs to see that.
  document.addEventListener('etho:signup-failed', () => {
    if (dialog.open && !form.hidden) dialog.close();
  });
})();
