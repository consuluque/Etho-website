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
