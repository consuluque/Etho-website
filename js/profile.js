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

  // The breed list and the day/month options are filled here rather
  // than shipped in the markup, which keeps index.html readable.
  const breedList = dialog.querySelector('#breed-list');
  (window.ETHO_BREEDS || []).forEach((breed) => {
    const option = document.createElement('option');
    option.value = breed;
    breedList.append(option);
  });
  const dayInput = form.querySelector('[name="dogBirthdayDay"]');
  const monthInput = form.querySelector('[name="dogBirthdayMonth"]');
  for (let d = 1; d <= 31; d += 1) dayInput.append(new Option(String(d), String(d)));
  MONTHS.forEach((name, i) => monthInput.append(new Option(name, String(i + 1))));

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
    return Array.from(step.querySelectorAll('input, select, .chip'));
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
    for (const control of step.querySelectorAll('input, select')) {
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
        (day ? monthInput : dayInput).focus();
        return false;
      }
    }
    return true;
  }

  function clear(step) {
    step.querySelectorAll('input, select').forEach((control) => { control.value = ''; });
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
