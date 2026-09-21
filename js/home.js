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
  const slides = [...root.querySelectorAll('[data-showcase-slide]')];
  const texts = [...root.querySelectorAll('[data-showcase-text]')];
  const triggers = [...root.querySelectorAll('[data-showcase-trigger]')];
  const films = slides.map((s) => s.querySelector('video'));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const inView = new Set();
  const loading = new Set();
  let active = -1;

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
    if (!film || reduced.matches) return;
    try { film.currentTime = 0; } catch (e) { /* not yet loaded */ }
    const played = film.play();
    if (played) played.catch(() => film.classList.remove('is-playing'));
  };

  const setActive = (i) => {
    if (i === active) return;
    active = i;
    root.dataset.showcaseActive = String(i);
    slides.forEach((slide, k) => slide.classList.toggle('is-active', k === i));
    texts.forEach((t) => t.classList.toggle('is-active', Number(t.dataset.showcaseText) === i));
    films.forEach((film, k) => { if (k !== i) stop(film); });
    load(i);
    start(films[i]);
    load(i + 1);
    if (typeof track === 'function') track('showcase_state', { state: i + 1 });
  };

  const settle = () => {
    let top = 0;
    inView.forEach((k) => { if (k > top) top = k; });
    setActive(top);
  };

  if (!('IntersectionObserver' in window)) {
    setActive(0);
    return;
  }

  // The first chapter is on from the moment the stage pins; each later
  // one takes over as its trigger's top edge enters the viewport.
  new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const k = Number(entry.target.dataset.showcaseTrigger);
        if (entry.isIntersecting) inView.add(k); else inView.delete(k);
      });
      settle();
    },
    { threshold: 0 }
  ).observe(triggers[0]);
  triggers.slice(1).forEach((t) => {
    new IntersectionObserver(
      ([entry]) => {
        const k = Number(entry.target.dataset.showcaseTrigger);
        if (entry.isIntersecting) inView.add(k); else inView.delete(k);
        settle();
      },
      { threshold: 0 }
    ).observe(t);
  });

  // Warm the first film a screen before the section arrives, so it is
  // ready to run the moment the stage pins.
  new IntersectionObserver(
    ([entry], obs) => {
      if (!entry.isIntersecting) return;
      load(0);
      obs.disconnect();
    },
    { rootMargin: '100% 0px' }
  ).observe(root);

  // Pause whatever is running if the whole section leaves the screen,
  // and pick it back up on return.
  new IntersectionObserver(
    ([entry]) => {
      const film = films[active];
      if (!film) return;
      if (entry.isIntersecting) start(film); else stop(film);
    },
    { threshold: 0 }
  ).observe(root.querySelector('.showcase__stage'));

  reduced.addEventListener('change', () => {
    if (reduced.matches) films.forEach(stop); else start(films[active]);
  });

  setActive(0);
}

document.querySelectorAll('[data-showcase]').forEach(initShowcase);
