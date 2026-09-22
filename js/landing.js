/* The landing pages — the home page, the holding page at 404.html and
   the archived partners page. main.js still carries the hero video, the
   reveal animation and the fixed wordmark, which the landing pages reuse
   as-is; the holding page loads only this file. */

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
   First-touch attribution

   Kept in localStorage until a form sends it: the utm_* parameters on
   the URL, the page that linked in, and the page that was landed on.
   The first visit is recorded whatever it carries, so an untagged
   arrival still has its referrer and landing page. A record without
   UTMs is provisional: the first later visit that arrives by a tagged
   link replaces it. A record with UTMs is the first touch, and nothing
   overwrites it. If storage is unavailable the current visit stands in
   at submit time.
   --------------------------------------------------------------- */
const ATTRIBUTION_STORAGE_KEY = 'etho:attribution';
const UTM_FIELDS = ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent'];
const ATTRIBUTION_FIELDS = UTM_FIELDS.concat(['referrer', 'landingPage']);

function hasUtms(attribution) {
  return UTM_FIELDS.some((key) => typeof attribution[key] === 'string' && attribution[key] !== '');
}

function currentAttribution() {
  const params = new URLSearchParams(window.location.search);
  const pick = (key) => (params.get(key) || '').trim().slice(0, 200);

  // Only another site counts as a referrer; a hop between our own pages
  // says nothing about where the visit came from.
  let referrer = '';
  try {
    if (document.referrer && new URL(document.referrer).origin !== window.location.origin) {
      referrer = document.referrer.slice(0, 500);
    }
  } catch (_) { /* an unparsable referrer is no referrer */ }

  // The landing page keeps its query, less the flag the no-JS form
  // comes back with, which is ours rather than the campaign's.
  params.delete('joined');
  const query = params.toString();
  const landingPage = (window.location.pathname + (query ? '?' + query : '')).slice(0, 500);

  return {
    utmSource: pick('utm_source'),
    utmMedium: pick('utm_medium'),
    utmCampaign: pick('utm_campaign'),
    utmContent: pick('utm_content'),
    referrer: referrer,
    landingPage: landingPage,
    capturedAt: new Date().toISOString(),
  };
}

function storedAttribution() {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function captureAttribution() {
  const stored = storedAttribution();
  if (stored && hasUtms(stored)) return;

  const current = currentAttribution();
  if (stored && !hasUtms(current)) return;

  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(current));
  } catch (_) { /* private mode, storage full, or blocked: fall back at submit */ }
}

// Just the fields Loops has properties for, and only the ones with a value.
function attributionForSubmit() {
  const source = storedAttribution() || currentAttribution();
  const out = {};
  ATTRIBUTION_FIELDS.forEach((key) => {
    if (typeof source[key] === 'string' && source[key]) out[key] = source[key];
  });
  return out;
}

/* ---------------------------------------------------------------
   Waitlist form

   The markup ships a working form that posts to /api/waitlist; this
   upgrades it to a fetch so the page never navigates away. The
   function serialises the whole form — email and honeypot — adds the
   stored attribution and the form's name, and sends it as JSON. The
   form stays on the page afterwards, cleared, so another address can
   go in.
   --------------------------------------------------------------- */
const DONE_MESSAGE = "You're in! Add another email?";
const ERROR_MESSAGE = 'Something went wrong — please try again.';

function statusFor(form) {
  const slot = form.parentElement;
  return slot ? slot.querySelector('[data-form-status]') : null;
}

function setStatus(status, text, state) {
  if (!status) return;
  status.textContent = text;
  status.classList.toggle('is-error', state === 'error');
  status.classList.toggle('is-done', state === 'done');
}

function initAccessForm(form) {
  const status = statusFor(form);
  const input = form.querySelector('input[type="email"]');
  const submitBtn = form.querySelector('button[type="submit"]');
  if (!input || !submitBtn) return;

  const submitLabel = submitBtn.textContent;
  // The endpoint lives in the markup's action, so it is written once.
  const endpoint = form.getAttribute('action') || '/api/waitlist';
  // Each form names itself, so the events say which one converted.
  const name = form.dataset.formName || 'waitlist';
  let started = false;

  const markStarted = () => {
    if (started) return;
    started = true;
    track('form_start', { form: name });
  };
  input.addEventListener('focus', markStarted);
  input.addEventListener('input', markStarted);

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    markStarted();
    track('form_submit', { form: name });

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    setStatus(status, '', null);

    const payload = Object.assign(
      Object.fromEntries(new FormData(form)),
      attributionForSubmit(),
      { form: name }
    );
    payload.email = String(payload.email || '').trim();

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Request failed with ' + res.status);

      form.reset();
      setStatus(status, form.dataset.doneMessage || DONE_MESSAGE, 'done');
      track('form_success', { form: name });
    } catch (err) {
      setStatus(status, ERROR_MESSAGE, 'error');
      track('form_error', { form: name });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
    }
  });
}

/* With scripting off the form posts natively and the function sends the
   browser back here with ?joined=1 (or 0). Once scripting is on again,
   the first form shows the outcome and the flag leaves the URL. */
function showJoinedFlag() {
  const params = new URLSearchParams(window.location.search);
  const joined = params.get('joined');
  if (joined === null) return;

  const form = document.querySelector('.access-form');
  if (form) {
    const done = joined === '1';
    setStatus(statusFor(form), done ? DONE_MESSAGE : ERROR_MESSAGE, done ? 'done' : 'error');
  }

  params.delete('joined');
  const query = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
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

captureAttribution();
trackPageView();
initScrollDepth();
initSectionViews();
document.querySelectorAll('.access-form').forEach(initAccessForm);
showJoinedFlag();
document.querySelectorAll('[data-logo-track]').forEach(initLogoMarquee);
document.querySelectorAll('[data-sticky-cta]').forEach(initStickyCta);
