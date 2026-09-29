/* The dog profile modal: opens on the etho:signup event landing.js fires
   after a successful waitlist submit, and posts the profile to
   /api/profile against that email. Built on the native <dialog>, so
   focus trapping, Escape and the inert page behind come for free. It
   can be closed at any point; the email is already saved by then.
   Analytics deliberately not wired yet. */
(function () {
  const dialog = document.getElementById('dog-profile');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const form = dialog.querySelector('[data-profile-form]');
  const done = dialog.querySelector('[data-profile-done]');
  const emailInput = form.querySelector('[name="email"]');
  const nameInput = form.querySelector('[name="dogName"]');
  const submitBtn = form.querySelector('[data-profile-submit]');
  const errorLine = form.querySelector('[data-profile-error]');
  const dayInput = form.querySelector('[name="dogBirthdayDay"]');
  const monthInput = form.querySelector('[name="dogBirthdayMonth"]');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  // The breed list and the day/month options are filled here rather
  // than shipped in the markup, which keeps index.html readable.
  const breedList = dialog.querySelector('#breed-list');
  (window.ETHO_BREEDS || []).forEach((breed) => {
    const option = document.createElement('option');
    option.value = breed;
    breedList.append(option);
  });
  for (let d = 1; d <= 31; d += 1) dayInput.append(new Option(String(d), String(d)));
  MONTHS.forEach((name, i) => monthInput.append(new Option(name, String(i + 1))));

  // "Done" becomes "Done for Milo" once there is a Milo.
  const syncSubmitLabel = () => {
    const name = nameInput.value.trim();
    submitBtn.textContent = name ? 'Done for ' + name : 'Done';
  };
  nameInput.addEventListener('input', syncSubmitLabel);

  // Chips: a button per option, pressed state is the selection.
  form.querySelectorAll('[data-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    });
  });
  const chipValues = (group) => Array.from(
    form.querySelectorAll('[data-chip-group="' + group + '"][aria-pressed="true"]'),
    (chip) => chip.dataset.chip
  );

  const setError = (text) => { errorLine.textContent = text; };

  let signupForm = '';

  function open(email, fromForm) {
    signupForm = fromForm || '';
    form.reset();
    form.querySelectorAll('[data-chip]').forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
    emailInput.value = email;
    setError('');
    syncSubmitLabel();
    form.hidden = false;
    done.hidden = true;
    dialog.showModal();
    nameInput.focus();
  }

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    setError('');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const payload = {
      email: emailInput.value,
      dogName: nameInput.value.trim(),
      dogBreed: form.dogBreed.value.trim(),
      dogAge: form.dogAge.value,
      dogBirthdayDay: dayInput.value,
      dogBirthdayMonth: monthInput.value,
      ownerName: form.ownerName.value.trim(),
      loves: chipValues('loves'),
      struggles: chipValues('struggles'),
      form: signupForm,
    };

    submitBtn.disabled = true;
    try {
      const res = await fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Request failed');

      done.querySelectorAll('[data-dog-name]').forEach((el) => { el.textContent = payload.dogName; });
      form.hidden = true;
      done.hidden = false;
      done.querySelector('[data-profile-close]').focus();
    } catch (err) {
      setError(err.message || 'Something went wrong — please try again.');
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Close on the × buttons and on a tap on the backdrop. Escape is native.
  dialog.querySelectorAll('[data-profile-close]').forEach((btn) => {
    btn.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', (evt) => {
    if (evt.target === dialog) dialog.close();
  });

  document.addEventListener('etho:signup', (evt) => {
    if (evt.detail && evt.detail.email) open(evt.detail.email, evt.detail.form);
  });
})();
