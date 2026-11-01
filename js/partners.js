/* partners.html only. The hero's photo panels take turns: each shows a
   service with the add-ons Etho suggests beside it, and every few
   seconds the next one fades in and its cards slide up in turn
   (partners.css). Under prefers-reduced-motion the first one holds. */
function initPanels(root) {
  const panels = [...root.querySelectorAll('[data-panel]')];
  if (panels.length < 2) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = 0;
  setInterval(() => {
    panels[i].classList.remove('is-active');
    i = (i + 1) % panels.length;
    panels[i].classList.add('is-active');
  }, 4800);
}

document.querySelectorAll('.b2b-panels').forEach(initPanels);

/* The value cards stack (partners.css): as the next card rises over a
   pinned one, the pinned one shrinks back and dims a touch. --cover
   runs 0 to 1 over the next card's last stretch before it pins. */
function initStack(cards) {
  if (cards.length < 2) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let queued = false;
  const place = () => {
    queued = false;
    const vh = window.innerHeight;
    cards.forEach((card, i) => {
      const next = cards[i + 1];
      if (!next) return;
      const pin = parseFloat(getComputedStyle(next).top) || 0;
      const gap = next.getBoundingClientRect().top - pin;
      const f = Math.min(1, Math.max(0, 1 - gap / (vh * 0.7)));
      card.style.setProperty('--cover', f.toFixed(3));
    });
  };
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(place);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  place();
}

initStack([...document.querySelectorAll('[data-stack]')]);
