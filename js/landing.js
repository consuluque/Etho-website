/* The landing pages — the home page and the partners page. main.js still
   carries the hero video, the reveal animation and the fixed wordmark,
   which both reuse as-is. */

/* ---------------------------------------------------------------
   Analytics

   No vendor is wired up yet, so every event is pushed to dataLayer and
   re-dispatched as a DOM event; whichever tag manager or script is
   dropped in later can read it without touching this file. gtag and
   plausible are called directly when present.
   --------------------------------------------------------------- */
function track(name, params) {
  const props = params || {};
  const payload = Object.assign({ event: name }, props);

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);

  if (typeof window.gtag === 'function') window.gtag('event', name, props);
  if (typeof window.plausible === 'function') window.plausible(name, { props: props });

  document.dispatchEvent(new CustomEvent('etho:analytics', { detail: payload }));

  // Set window.ETHO_DEBUG_ANALYTICS = true in the console to watch events.
  if (window.ETHO_DEBUG_ANALYTICS) console.log('[etho]', name, props);
}

function trackPageView() {
  track('page_view', {
    page_path: window.location.pathname,
    page_title: document.title,
    referrer: document.referrer || '(direct)',
  });
}

/* Fires once per threshold, at the deepest one crossed, so a fast fling
   down the page does not report a dozen events. */
function initScrollDepth() {
  const thresholds = [25, 50, 75, 100];
  let sent = 0;
  let queued = false;

  const measure = () => {
    queued = false;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const percent = ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100;

    thresholds.forEach((mark) => {
      if (mark > sent && percent >= mark) {
        sent = mark;
        track('scroll_depth', { percent: mark });
      }
    });

    if (sent === 100) window.removeEventListener('scroll', onScroll);
  };

  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(measure);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  measure();
}

/* One event the first time each section comes into view. */
function initSectionViews() {
  const sections = document.querySelectorAll('[data-section]');
  if (!sections.length || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        track('section_view', { section: entry.target.dataset.section });
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.35 }
  );

  sections.forEach((section) => observer.observe(section));
}

/* ---------------------------------------------------------------
   Early-access form

   The markup ships a working form that posts to FormSubmit; this
   upgrades it to a fetch so the page never navigates away.
   --------------------------------------------------------------- */
function initAccessForm(form) {
  const slot = form.closest('.access-slot');
  const status = slot ? slot.querySelector('.waitlist-status') : null;
  const input = form.querySelector('.waitlist-input');
  const submitBtn = form.querySelector('.waitlist-submit');
  const submitLabel = submitBtn.textContent;
  // The address lives in the markup's action, so it is written once.
  const endpoint = form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');
  // Each page names its own form, so the events say which one converted.
  const name = form.dataset.formName || 'early_access';
  const subject = form.querySelector('[name="_subject"]');
  let started = false;

  const markStarted = () => {
    if (started) return;
    started = true;
    track('form_start', { form: name });
  };
  input.addEventListener('focus', markStarted);
  input.addEventListener('input', markStarted);

  const setStatus = (text, isError) => {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle('is-error', Boolean(isError));
  };

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const email = input.value.trim();
    if (!email || !form.checkValidity()) {
      form.reportValidity();
      return;
    }

    markStarted();
    track('form_submit', { form: name });

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    setStatus('', false);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: email,
          _subject: subject ? subject.value : 'New Etho signup',
        }),
      });
      if (!res.ok) throw new Error('Request failed');

      form.remove();
      setStatus(form.dataset.doneMessage || "You're on the list — we'll be in touch.", false);
      if (status) status.classList.add('waitlist-status--done');
      track('form_success', { form: name });
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
      setStatus('Something went wrong — please try again.', true);
      track('form_error', { form: name });
    }
  });
}

/* ---------------------------------------------------------------
   Logo wall — the marquee needs a second copy of the row so the
   -50% shift lands exactly where it started. The clone is hidden by
   CSS at tablet and up, where the wall is a static grid.
   --------------------------------------------------------------- */
function initLogoMarquee(track_) {
  const set = track_.querySelector('[data-logo-set]');
  if (!set || track_.querySelector('[data-logo-clone]')) return;

  const clone = set.cloneNode(true);
  clone.setAttribute('data-logo-clone', '');
  clone.setAttribute('aria-hidden', 'true');
  // The originals already announce themselves; the copy must not repeat
  // them, and nothing inside it should be reachable by keyboard.
  clone.querySelectorAll('[role="img"]').forEach((el) => {
    el.removeAttribute('role');
    el.removeAttribute('aria-label');
  });
  track_.append(clone);

  const mobile = window.matchMedia('(max-width: 740px)');
  const sync = () => track_.classList.toggle('is-marquee', mobile.matches);
  sync();
  mobile.addEventListener('change', sync);
}

/* ---------------------------------------------------------------
   Sticky mobile CTA — shown once the hero has scrolled away. It is
   display:none above 760px, so this only ever matters on a phone.
   --------------------------------------------------------------- */
function initStickyCta(bar) {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const link = bar.querySelector('.sticky-cta__btn');
  if (link) {
    link.addEventListener('click', () => track('cta_click', { location: 'sticky_mobile' }));
  }

  if (!('IntersectionObserver' in window)) {
    bar.classList.add('is-visible');
    return;
  }

  new IntersectionObserver(
    ([entry]) => bar.classList.toggle('is-visible', !entry.isIntersecting),
    { threshold: 0 }
  ).observe(hero);
}

trackPageView();
initScrollDepth();
initSectionViews();
document.querySelectorAll('.access-form').forEach(initAccessForm);
document.querySelectorAll('[data-logo-track]').forEach(initLogoMarquee);
document.querySelectorAll('[data-sticky-cta]').forEach(initStickyCta);
