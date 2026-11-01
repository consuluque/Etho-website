/* partners.html only: the intro line, the hero's storefront scene, the
   stacking value cards and their animations. */

/* The intro line lights word by word as it scrolls up the screen, as
   the homepage's story paragraph does (home.js). Words inside the
   yellow <mark> pills are split in place, so the pills stay whole. */
function initScrollWords(el) {
  const spans = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.append(part); return; }
      const span = document.createElement('span');
      span.className = 'story__word';
      span.textContent = part;
      frag.append(span);
      spans.push(span);
    });
    node.replaceWith(frag);
  });

  let lit = -1;
  let queued = false;
  const measure = () => {
    queued = false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
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

  // Counts an element up from 0 to `to` over ms, written by fmt; stops
  // if the scene rewinds meanwhile (s-in is cleared on reset).
  const countUp = (root, el, to, ms, fmt) => {
    const start = performance.now();
    const step = (now) => {
      if (!root.classList.contains('s-in')) return;
      const f = Math.min(1, (now - start) / ms);
      el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - f, 3))));
      if (f < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const money = (n) => '$' + n.toLocaleString('en-AU');

  // 1 — Fill quiet periods. A quiet Tuesday morning with two open slots;
  // the off-peak offer goes live, both slots fill, and the morning's
  // recovered revenue counts up.
  // The hero — one storefront, three stories. The provider's services,
  // products and a bundle they switch on; then a 30% offer set on
  // Tuesday and Wednesday mornings and put live; then a pet parent's
  // question to an AI answered with this studio, ready to book.
  // The demo: the parent's side. The home rises; the cursor opens the
  // bath & dry, then its provider, Dogue Spa, whose storefront pushes in.
  // It swipes through this week's offers, then flicks the page down in
  // four strokes to the foot, holds, and everything drops away.
  S.define('p-demo', {
    loopAt: 22500,
    script({ at, on, off, target, glide, tap, drag, scrollTo, press, em, root }) {
      const page = root.querySelector('[data-scroll="page"]');
      const offers = root.querySelector('[data-scroll="offers"]');
      const store = target('store');
      const pageTo = (y, ms) => {
        page.style.transition = 'transform ' + ms + 'ms cubic-bezier(0.05, 0.75, 0.15, 1)';
        page.style.transform = 'translateY(' + (-y).toFixed(1) + 'px)';
      };
      // One upward flick: the cursor lands low, drags up and lets go as
      // the page carries on; share is how far down its full depth.
      const flick = (t0, share) => {
        at(t0, () => glide(store, 450, 0.62, 0.8));
        at(t0 + 600, () => {
          press(true);
          glide(store, 260, 0.62, 0.52);
          pageTo(Math.max(0, page.offsetHeight - store.clientHeight) * share, 1300);
        });
        at(t0 + 880, () => press(false));
      };

      at(200, () => on('app'));
      at(1400, () => { on('cursor'); glide(target('wash'), 900, 0.5, 0.4); });
      at(2500, () => tap(target('wash'), () => on('sheet')));
      at(3700, () => glide(target('provider'), 800, 0.35, 0.5));
      at(4700, () => tap(target('provider'), () => on('store')));
      at(6000, () => glide(target('offer'), 700, 0.75, 0.55));
      at(6900, () => drag(offers, -em(5), 320));
      at(7220, () => {
        press(false);
        // To the last offer, sitting inside the page's right margin.
        const first = offers.firstElementChild;
        const last = offers.lastElementChild;
        const width = last.offsetLeft + last.offsetWidth - first.offsetLeft;
        const max = width - (store.clientWidth - em(2.6));
        scrollTo(offers, -max, 1600, 'cubic-bezier(0.05, 0.75, 0.15, 1)');
      });
      [9200, 11000, 12800, 14600].forEach((t0, i) => flick(t0, (i + 1) / 4));
      at(17000, () => off('cursor'));
      at(20800, () => on('out'));
    },
    finalState({ on }) { on('app', 'sheet', 'store'); },
  });

  S.define('p-hero', {
    loopAt: 15500,
    script({ at, on, root }) {
      const [price, disc] = root.querySelectorAll('.ph-page--offer [data-scene-count]');
      at(200, () => on('in'));
      at(2300, () => on('t2'));
      at(3700, () => on('t3'));
      at(4400, () => on('bundle'));
      at(6000, () => on('p2'));
      at(6800, () => {
        on('disc');
        countUp(root, disc, 30, 1100, (n) => n + '%');
        countUp(root, price, 30, 1100, (n) => '$' + (100 - n));
      });
      at(8000, () => on('days'));
      at(8800, () => on('live'));
      at(10200, () => on('p3'));
      at(10800, () => on('q'));
      at(11700, () => on('ans'));
      at(12400, () => on('checks'));
      at(14900, () => on('out'));
    },
    finalState({ on, root }) {
      on('in', 'p3', 'q', 'ans', 'checks');
    },
  });

  S.define('p-capacity', {
    loopAt: 9600,
    script({ at, on, root }) {
      const num = root.querySelector('.ps-stat .ps-num');
      at(200, () => on('in'));
      at(1700, () => on('live'));
      at(3200, () => on('fill1'));
      at(4300, () => on('fill2'));
      at(5000, () => { on('stat'); countUp(root, num, 140, 1100, (n) => '+' + money(n)); });
      at(8900, () => on('out'));
    },
    finalState({ on, root }) {
      on('in', 'live', 'fill1', 'fill2', 'stat');
      root.querySelector('.ps-stat .ps-num').textContent = '+$140';
    },
  });

  // 2 — Grow each booking. A daycare booking comes in; Etho suggests
  // add-ons, one is taken and the total climbs; the average booking
  // value rises, and boarding is booked alongside.
  S.define('p-basket', {
    loopAt: 9600,
    script({ at, on, root }) {
      const total = root.querySelector('.ps-total b');
      const avg = root.querySelector('.ps-stat .ps-num');
      at(200, () => on('in'));
      at(1400, () => on('sug'));
      at(2900, () => { on('add1'); countUp(root, { set textContent(v) { total.textContent = v; } }, 15, 700, (n) => money(65 + n)); });
      at(4100, () => { on('stat'); countUp(root, avg, 23, 1000, (n) => '+' + n + '%'); });
      at(5400, () => on('cross'));
      at(8900, () => on('out'));
    },
    finalState({ on, root }) {
      on('in', 'sug', 'add1', 'stat', 'cross');
      root.querySelector('.ps-total b').textContent = '$80';
      root.querySelector('.ps-stat .ps-num').textContent = '+23%';
    },
  });

  // 3 — Be discoverable by AI search. The service is written out as
  // structured data behind; in front, an AI answer recommends the
  // business and the booking comes through.
  S.define('p-ai', {
    loopAt: 10000,
    script({ at, on, type, root }) {
      at(150, () => on('in'));
      let t = 500;
      root.querySelectorAll('.ps-code [data-type]').forEach((el) => {
        at(t, () => type(el, 16));
        t += el.dataset.type.length * 16 + 40;
      });
      at(1100, () => on('q'));
      at(2100, () => on('think'));
      at(3300, () => on('ans'));
      at(4300, () => on('tiles'));
      at(5600, () => on('booked'));
      at(6100, () => on('toast'));
      at(9300, () => on('out'));
    },
    finalState({ on }) { on('in', 'q', 'ans', 'tiles', 'booked', 'toast'); },
  });

  // 4 — Get loyal customers. A five-session pack paid upfront, four
  // sessions in; the month's prepaid revenue, repeat rate and rebookings
  // count up, and a rebooking arrives.
  S.define('p-retention', {
    loopAt: 9600,
    script({ at, on, root }) {
      const nums = root.querySelectorAll('.ps-tl .ps-num');
      at(200, () => on('in'));
      at(1000, () => on('paid'));
      at(2300, () => on('brief'));
      at(2700, () => {
        countUp(root, nums[0], 4250, 1300, money);
        countUp(root, nums[1], 68, 1300, (n) => n + '%');
        countUp(root, nums[2], 12, 1300, String);
      });
      at(5200, () => on('toast'));
      at(8900, () => on('out'));
    },
    finalState({ on, root }) {
      on('in', 'paid', 'brief', 'toast');
      const nums = root.querySelectorAll('.ps-tl .ps-num');
      nums[0].textContent = '$4,250'; nums[1].textContent = '68%'; nums[2].textContent = '12';
    },
  });
}

// The demo plays while its phone is well on screen.
const demoRoot = document.querySelector('[data-scene="p-demo"]');
const demoScene = demoRoot && window.EthoScenes ? window.EthoScenes.create(demoRoot) : null;
if (demoScene) {
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) demoScene.play(); else demoScene.stop();
    }, { threshold: 0.5 }).observe(demoRoot);
  } else demoScene.play();
}

// The hero's scene plays while the hero is on screen.
const heroRoot = document.querySelector('[data-scene="p-hero"]');
const heroScene = heroRoot && window.EthoScenes ? window.EthoScenes.create(heroRoot) : null;
if (heroScene) {
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) heroScene.play(); else heroScene.stop();
    }, { threshold: 0.3 }).observe(heroRoot);
  } else heroScene.play();
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
