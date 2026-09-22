/* index.html only. main.js carries the hero video and the fixed wordmark,
   landing.js the forms and the pinned bar; this is what is left. */

/* ---------------------------------------------------------------
   The story paragraph

   Each word darkens in turn as the reader scrolls the paragraph up
   the screen, so the line reads as if it were being typed out under
   them. It is tied to scroll position rather than to a clock: scroll
   back up and the words dim again, and a reader who stops halfway sees
   exactly as much as they have read. With no script the paragraph is
   plain text in the ordinary ink colour.
   --------------------------------------------------------------- */
function initScrollWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  const spans = words.map((word, i) => {
    const span = document.createElement('span');
    span.className = 'story__word';
    span.textContent = word;
    el.append(span);
    if (i < words.length - 1) el.append(' ');
    return span;
  });

  let lit = -1;
  let queued = false;

  const measure = () => {
    queued = false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // Nothing lit while the top of the paragraph is still low on the
    // screen; everything lit by the time its last line is well above the
    // middle, so the reader never waits on the final words.
    const start = vh * 0.82;
    const end = vh * 0.38;
    const span = rect.height + start - end;
    const progress = span > 0 ? (start - rect.top) / span : 1;
    const count = Math.round(Math.max(0, Math.min(1, progress)) * spans.length);
    if (count === lit) return;
    lit = count;
    spans.forEach((s, i) => s.classList.toggle('is-lit', i < count));
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(measure);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  measure();
}

document.querySelectorAll('[data-scroll-words]').forEach(initScrollWords);

/* ---------------------------------------------------------------
   Product story — one phone, three chapters

   Three trigger blocks, one screen tall each, follow the sticky stage
   in flow. Whichever of them is furthest down the page and still in
   view names the active chapter, which reads the same forwards and
   backwards and settles at once however fast the scroll. Activating a
   chapter swaps the text, pauses and rewinds every other film, and
   starts this one from the top; its still is already showing, and the
   film is revealed only once frames are running, so there is never a
   blank or black screen. The next chapter's film starts loading as
   soon as the one before it is on screen. Under prefers-reduced-motion
   the films never play and the stills carry each chapter.
   --------------------------------------------------------------- */
function initShowcase(root) {
  const stage = root.querySelector('.showcase__stage');
  const slides = [...root.querySelectorAll('[data-showcase-slide]')];
  const texts = [...root.querySelectorAll('[data-showcase-text]')];
  const triggers = [...root.querySelectorAll('[data-showcase-trigger]')];
  const films = slides.map((s) => s.querySelector('video'));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const inView = new Set();
  const loading = new Set();
  let active = 0;
  // Nothing is fetched until the section is a screen away, and nothing
  // plays unless the stage is actually on screen.
  let near = false;
  let visible = false;

  films.forEach((film, i) => {
    if (!film) return;
    // Belt and braces: the attributes are in the markup, but a browser
    // that drops them on a re-parse still gets a silent, control-less
    // backdrop.
    film.muted = true;
    film.loop = true;
    film.controls = false;
    film.setAttribute('playsinline', '');
    film.addEventListener('playing', () => { if (i === active) film.classList.add('is-playing'); });
    film.addEventListener('pause', () => film.classList.remove('is-playing'));
    film.addEventListener('error', () => film.classList.remove('is-playing'));
  });

  const load = (i) => {
    const film = films[i];
    if (!film || loading.has(i) || reduced.matches) return;
    loading.add(i);
    film.preload = 'auto';
    film.load();
  };

  const stop = (film) => {
    if (!film) return;
    film.pause();
    film.classList.remove('is-playing');
    try { film.currentTime = 0; } catch (e) { /* not yet loaded: already at 0 */ }
  };

  const start = (film) => {
    if (!film || reduced.matches || !film.paused) return;
    const played = film.play();
    if (played) played.catch(() => film.classList.remove('is-playing'));
  };

  // The still holds the screen for this long before its film is asked
  // to play, however fast the film arrives. The film loads through the
  // hold, so it is ready to run the moment the hold ends.
  const HOLD_MS = 1500;
  let hold = 0;
  const clearHold = () => {
    if (!hold) return;
    clearTimeout(hold);
    hold = 0;
  };

  // Brings the films in line with the active chapter and where the
  // section is: every other film stopped and rewound, this chapter's
  // and the next one's fetched once the section is near, this one
  // running, after the hold, only while the stage is on screen.
  const sync = () => {
    films.forEach((film, k) => { if (k !== active) stop(film); });
    if (!near) { clearHold(); return; }
    load(active);
    load(active + 1);
    const film = films[active];
    if (!visible) {
      clearHold();
      stop(film);
    } else if (film && film.paused && !hold) {
      hold = setTimeout(() => { hold = 0; start(film); }, HOLD_MS);
    }
  };

  // The slide-up follows the scroll, inside the phone and beside it.
  // Through the last SLIDE_SPAN of each chapter's screen of scroll, the
  // next chapter's still travels from just below the screen to fully
  // in place, arriving exactly as its trigger enters view and the
  // chapter switches; in the same stretch the old title and copy rise
  // a short way and fade out, then the new ones rise into place and
  // fade in. The same run backwards takes them all out again. Under
  // reduced motion everything snaps at the switch.
  const SLIDE_SPAN = 0.45;
  // How far the text travels while it fades, in px.
  const TEXT_TRIP = 40;
  let queued = false;
  const placeSlides = () => {
    queued = false;
    const progress = -root.getBoundingClientRect().top / window.innerHeight;
    // How far chapter k has arrived, 0..1; the first is always in.
    const arrived = (k) => {
      if (k <= 0) return 1;
      if (k >= slides.length) return 0;
      if (reduced.matches) return k <= active ? 1 : 0;
      return Math.min(1, Math.max(0, (progress - (k - SLIDE_SPAN)) / SLIDE_SPAN));
    };
    slides.forEach((slide, k) => {
      if (k === 0) return;
      const f = arrived(k);
      slide.style.transform = f >= 1 ? 'none' : 'translateY(' + ((1 - f) * 100).toFixed(2) + '%)';
    });
    // A text rises in and fades in over the second half of its own
    // chapter's arrival, and rises on and fades out over the first
    // half of the next one's, so one is gone before the other comes.
    const trip = TEXT_TRIP;
    texts.forEach((t) => {
      const k = Number(t.dataset.showcaseText);
      const enter = Math.min(1, Math.max(0, (arrived(k) - 0.5) * 2));
      const leave = Math.min(1, Math.max(0, arrived(k + 1) * 2));
      const y = trip * (1 - enter) - trip * leave;
      const alpha = enter * (1 - leave);
      t.style.transform = Math.abs(y) < 0.5 ? 'none' : 'translateY(' + y.toFixed(1) + 'px)';
      t.style.opacity = alpha >= 1 ? '' : alpha.toFixed(3);
    });
  };
  const onScroll = () => {
    if (queued || !visible) return;
    queued = true;
    requestAnimationFrame(placeSlides);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  const setActive = (i) => {
    if (i === active && root.dataset.showcaseActive) return;
    active = i;
    root.dataset.showcaseActive = String(i);
    slides.forEach((slide, k) => slide.classList.toggle('is-active', k === i));
    texts.forEach((t) => t.classList.toggle('is-active', Number(t.dataset.showcaseText) === i));
    // Always from the top, and after the full hold, even on a return
    // to a chapter seen before.
    stop(films[i]);
    clearHold();
    sync();
    placeSlides();
    if (typeof track === 'function') track('showcase_state', { state: i + 1 });
  };

  const settle = () => {
    let top = 0;
    inView.forEach((k) => { if (k > top) top = k; });
    setActive(top);
  };

  if (!('IntersectionObserver' in window)) {
    near = true;
    visible = true;
    setActive(0);
    return;
  }

  // The first chapter is on from the moment the stage pins; each later
  // one takes over as its trigger's top edge enters the viewport.
  const onTrigger = (entries) => {
    entries.forEach((entry) => {
      const k = Number(entry.target.dataset.showcaseTrigger);
      if (entry.isIntersecting) inView.add(k); else inView.delete(k);
    });
    settle();
  };
  const triggerObserver = new IntersectionObserver(onTrigger, { threshold: 0 });
  triggers.forEach((t) => triggerObserver.observe(t));

  // A screen before the section arrives, fetch the first film so it is
  // ready to run the moment the stage pins.
  new IntersectionObserver(
    ([entry], obs) => {
      if (!entry.isIntersecting) return;
      near = true;
      sync();
      obs.disconnect();
    },
    { rootMargin: '100% 0px' }
  ).observe(root);

  // Run the active film only while the stage is on screen.
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      sync();
      if (visible) placeSlides();
    },
    { threshold: 0 }
  ).observe(stage);

  reduced.addEventListener('change', () => {
    if (reduced.matches) { clearHold(); films.forEach(stop); } else sync();
    placeSlides();
  });


  setActive(0);
}

document.querySelectorAll('[data-showcase]').forEach(initShowcase);
