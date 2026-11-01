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
      if (!reducedMotion) card.style.setProperty('--cover', f.toFixed(3));
      card.dataset.covered = f > 0.6 ? '1' : '';
    });
    syncScenes();
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

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------
   The value cards' animations: four short loops of Etho's UI, run by
   the homepage's scene engine (scenes.js) and drawn by
   partner-scenes.css. A scene plays while its card is on screen and
   not covered by the next one, and rewinds to its start otherwise.
   --------------------------------------------------------------- */

if (window.EthoScenes) {
  const S = window.EthoScenes;

  // 1 — Fill quiet periods. Two free Tuesday slots; the groomer turns on
  // a 30% offer, it reaches Cooper's parent as a pick for Cooper, they
  // book, and the slot is filled.
  S.define('p-capacity', {
    loopAt: 9200,
    script({ at, on, off, target, glide, tap }) {
      at(300, () => on('a'));
      at(1400, () => { on('cursor'); glide(target('offer'), 750, 0.5, 0.55); });
      at(2250, () => tap(target('offer'), () => on('offer')));
      at(3100, () => on('b'));
      at(4200, () => glide(target('book'), 750, 0.5, 0.55));
      at(5050, () => tap(target('book'), () => on('c')));
      at(5600, () => off('cursor'));
      at(6500, () => on('d'));
      at(8500, () => on('out'));
    },
    finalState({ on }) { on('a', 'offer', 'b', 'c', 'd'); },
  });

  // 2 — Get loyal customers. A five-session puppy school paid upfront;
  // four sessions in, graduation nears; the next masterclass is
  // reserved and a graduation morning added.
  S.define('p-retention', {
    loopAt: 12600,
    script({ at, on, off, target, glide, tap }) {
      at(300, () => on('a'));
      at(1200, () => { on('cursor'); glide(target('pay'), 750, 0.5, 0.55); });
      at(2050, () => tap(target('pay'), () => on('pay')));
      at(3000, () => { off('cursor'); on('b'); });
      at(5300, () => on('c'));
      at(6000, () => { on('cursor'); glide(target('reserve'), 700, 0.5, 0.55); });
      at(6800, () => tap(target('reserve'), () => on('reserve')));
      at(7500, () => on('d'));
      at(8300, () => glide(target('add'), 700, 0.5, 0.55));
      at(9100, () => tap(target('add'), () => on('add')));
      at(9700, () => { off('cursor'); on('e'); });
      at(11900, () => on('out'));
    },
    finalState({ on }) { on('a', 'pay', 'b', 'c', 'reserve', 'd', 'add', 'e'); },
  });

  // 3 — Grow each booking. Cooper's daycare day; an enrichment session
  // is added and the total climbs $65 to $80; then holiday boarding is
  // suggested as a separate booking, under the confirmed day.
  S.define('p-basket', {
    loopAt: 10200,
    script({ at, on, off, target, glide, tap, count, root }) {
      const total = root.querySelector('[data-scene-count]');
      at(300, () => on('a'));
      at(1400, () => on('b'));
      at(2300, () => { on('cursor'); glide(target('enrich').querySelector('.ps-check'), 800); });
      at(3200, () => tap(target('enrich'), () => { on('enrich'); count(total, 80, 700); }));
      at(4000, () => off('cursor'));
      at(4900, () => on('d'));
      at(5700, () => on('e'));
      at(9500, () => on('out'));
    },
    finalState({ on, root }) {
      on('a', 'b', 'enrich', 'd', 'e');
      root.querySelector('[data-scene-count]').textContent = '$80';
    },
  });

  // 4 — Be discoverable by AI search. Lola's question is typed; four
  // recommendations arrive in turn, each with why it suits her; the
  // mobility assessment is picked out and its provider opens.
  S.define('p-ai', {
    loopAt: 16800,
    script({ at, on, off, target, glide, tap, type, root }) {
      const field = root.querySelector('[data-type]');
      const track = root.querySelector('[data-scroll="recs"]');
      const card = (n) => root.querySelector('.ps-r' + n);
      // Scrolls the list up so card n sits at the top of the window.
      const show = (n) => {
        track.style.transition = 'transform 800ms cubic-bezier(0.16, 1, 0.3, 1)';
        track.style.transform = 'translateY(' + (-card(n).offsetTop + 4) + 'px)';
      };
      at(300, () => on('a'));
      at(1000, () => { on('typing'); type(field, 36); });
      at(4100, () => { off('typing'); on('b'); });
      at(4900, () => on('r1'));
      at(5500, () => on('w1'));
      at(6400, () => on('r2'));
      at(7000, () => on('w2'));
      at(7900, () => { on('r3'); show(2); });
      at(8500, () => on('w3'));
      at(9400, () => { on('r4'); show(3); });
      at(10000, () => on('w4'));
      at(11300, () => { show(2); on('hi'); });
      at(12300, () => on('h'));
      at(13200, () => { on('cursor'); glide(target('explore'), 750, 0.5, 0.55); });
      at(14050, () => tap(target('explore')));
      at(14600, () => off('cursor'));
      at(16100, () => on('out'));
    },
    finalState({ on }) { on('a', 'b', 'r1', 'w1', 'r2', 'w2', 'r3', 'w3', 'r4', 'w4', 'hi', 'h'); },
  });
}

const sceneCards = [...document.querySelectorAll('[data-stack]')].map((card) => {
  const root = card.querySelector('[data-scene]');
  return { card, scene: root && window.EthoScenes ? window.EthoScenes.create(root) : null, inView: false };
}).filter((x) => x.scene);

function syncScenes() {
  sceneCards.forEach((x) => {
    if (x.inView && !x.card.dataset.covered) x.scene.play(); else x.scene.stop();
  });
}

if ('IntersectionObserver' in window) {
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const x = sceneCards.find((c) => c.card === entry.target);
      if (x) x.inView = entry.intersectionRatio >= 0.45;
    });
    syncScenes();
  }, { threshold: [0, 0.45, 1] });
  sceneCards.forEach((x) => seen.observe(x.card));
} else {
  sceneCards.forEach((x) => { x.inView = true; });
}

initStack([...document.querySelectorAll('[data-stack]')]);
