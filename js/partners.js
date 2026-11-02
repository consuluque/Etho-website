/* partners.html only: the intro line, the Typeform popup, the hero's
   scene, the stacking value cards and their animations. */

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

/* "Grow with us" opens the partner Typeform in a popup over the page.
   Typeform's embed script loads on the first click (nothing from them
   loads before), and is warmed up on hover or touch. If it can't load,
   or takes over 4s, the button falls back to its link: the form in a
   new tab. */
const TYPEFORM_ID = 'IHpQVqhu';
let typeformReady = null;
function loadTypeform() {
  if (!typeformReady) {
    typeformReady = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://embed.typeform.com/next/css/popup.css';
      document.head.append(css);
      const js = document.createElement('script');
      js.src = 'https://embed.typeform.com/next/embed.js';
      js.async = true;
      js.onload = () => (window.tf && window.tf.createPopup ? resolve(window.tf) : reject());
      js.onerror = reject;
      document.head.append(js);
    });
    typeformReady.catch(() => { typeformReady = null; });
  }
  return typeformReady;
}
document.querySelectorAll('[data-typeform]').forEach((link) => {
  const warm = () => { loadTypeform().catch(() => {}); };
  link.addEventListener('pointerenter', warm, { once: true });
  link.addEventListener('touchstart', warm, { once: true, passive: true });
  link.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    let done = false;
    const fallback = () => {
      if (done) return;
      done = true;
      window.open(link.href, '_blank', 'noopener');
    };
    const timer = setTimeout(fallback, 4000);
    loadTypeform().then((tf) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      tf.createPopup(TYPEFORM_ID, { size: 90 }).open();
    }).catch(() => { clearTimeout(timer); fallback(); });
  });
});

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

  // The hero. Today's book at Dogue Spa, live. Etho spots two open slots
  // this afternoon and suggests a plan in the provider's own rules: the
  // service, the dogs it suits (large, high energy), new customers only,
  // when, and the offer. The provider adds Huskies and approves; back on
  // today's book, the slots fill with two new customers.
  S.define('p-hero', {
    loopAt: 14200,
    script({ at, on }) {
      at(200, () => on('in'));
      at(1500, () => on('gap'));
      at(3300, () => on('p2'));
      [3800, 4150, 4500, 4850, 5200].forEach((ms, i) => at(ms, () => on('r' + (i + 1))));
      at(6500, () => on('edit'));
      at(7700, () => on('ok'));
      at(8900, () => on('p3'));
      at(9600, () => on('m1'));
      at(10300, () => on('m2'));
      at(11000, () => on('done'));
      at(13500, () => on('out'));
    },
    finalState({ on }) { on('in', 'gap', 'p2', 'r1', 'r2', 'r3', 'r4', 'r5', 'edit', 'ok', 'p3', 'm1', 'm2', 'done'); },
  });

  // Fill the gaps: a 45-minute cancellation becomes one discounted slot
  // for a small, short-coated dog, live until 2pm, and it is booked.
  S.define('p-capacity', {
    loopAt: 10600,
    script({ at, on }) {
      at(200, () => on('in'));
      at(1300, () => on('cancel'));
      at(2400, () => on('ctl'));
      [3000, 3450, 3900, 4350, 4800].forEach((ms, i) => at(ms, () => on('r' + (i + 1))));
      at(5800, () => on('live'));
      at(7200, () => on('booked'));
      at(9900, () => on('out'));
    },
    finalState({ on }) { on('in', 'cancel', 'ctl', 'r1', 'r2', 'r3', 'r4', 'r5', 'live', 'booked'); },
  });

  // 2 — Grow each booking. A daycare booking comes in; Etho suggests
  // add-ons, one is taken and the total climbs; the average booking
  // value rises, and boarding is booked alongside.
  // Make every booking worth more: at checkout for a $220 puppy course,
  // Etho suggests a $45 starter kit and an optional follow-up; the kit
  // goes in and the total and the average transaction value count up.
  S.define('p-basket', {
    loopAt: 9600,
    script({ at, on, root }) {
      const total = root.querySelector('.ps-cart__total b');
      const avg = root.querySelector('.ps-stat .ps-num');
      at(200, () => on('in'));
      at(1500, () => on('sug'));
      at(3300, () => { on('kit'); countUp(root, total, 45, 800, (n) => money(220 + n)); });
      at(4600, () => { on('stat'); countUp(root, avg, 20, 1000, (n) => '+' + n + '%'); });
      at(8900, () => on('out'));
    },
    finalState({ on, root }) {
      on('in', 'sug', 'kit', 'stat');
      root.querySelector('.ps-cart__total b').textContent = '$265';
      root.querySelector('.ps-stat .ps-num').textContent = '+20%';
    },
  });

  // 3 — Be discoverable by AI search. The service is written out as
  // structured data behind; in front, an AI answer recommends the
  // business and the booking comes through.
  // Be part of the answer: Etho's agent speaks first. It flags Lola's
  // hip pain, suggests seeing a professional, lists Dogue Wellness's
  // mobility assessment first; it is booked and the provider is told.
  S.define('p-ai', {
    loopAt: 9600,
    script({ at, on }) {
      at(200, () => on('in'));
      at(1000, () => on('m1'));
      at(2300, () => on('think'));
      at(3200, () => on('m2'));
      at(5200, () => on('booked'));
      at(5800, () => on('toast'));
      at(8900, () => on('out'));
    },
    finalState({ on }) { on('in', 'm1', 'm2', 'booked', 'toast'); },
  });

  // 4 — Get loyal customers. A five-session pack paid upfront, four
  // sessions in; the month's prepaid revenue, repeat rate and rebookings
  // count up, and a rebooking arrives.
  // More ways to say yes: Cooper's parent moves from a single day to the
  // 8-day pass (free same-day pick-up), splits it into 4 payments, and
  // the provider sees eight visits booked ahead.
  S.define('p-retention', {
    loopAt: 9800,
    script({ at, on, root }) {
      const each = root.querySelector('.ps-cta [data-scene-count]');
      const ahead = root.querySelector('.ps-stat [data-scene-count]');
      at(200, () => on('in'));
      at(1400, () => { on('o2'); each.textContent = '$234'; });
      at(2300, () => { on('o3'); each.textContent = '$440'; });
      at(3500, () => { on('split'); countUp(root, each, 330, 800, (n) => '$' + (440 - n)); });
      at(4900, () => on('done'));
      at(5600, () => { on('stat'); countUp(root, ahead, 8, 900, String); });
      at(6400, () => on('toast'));
      at(9100, () => on('out'));
    },
    finalState({ on, root }) {
      on('in', 'o2', 'o3', 'split', 'done', 'stat', 'toast');
      root.querySelector('.ps-cta [data-scene-count]').textContent = '$110';
      root.querySelector('.ps-stat [data-scene-count]').textContent = '8';
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
