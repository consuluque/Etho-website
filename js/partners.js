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
