/* ---------------------------------------------------------------
   Showcase scenes — Etho's app UI, acted out inside the phone

   Each scene is a script of timed steps. A step only adds or removes
   state classes (s-*) on the scene, glides the cursor to an element,
   taps it, or counts a number up; how anything moves is left to
   scenes.css. home.js plays a chapter's scene once the chapter is in
   and on screen, and stops it (back to the very start) whenever the
   chapter leaves, so a scene always opens from its first beat. A
   scene loops by sending its sheet back down and starting over.

   Under prefers-reduced-motion a scene skips straight to its final
   frame and holds it, with no cursor.
   --------------------------------------------------------------- */
window.EthoScenes = (() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // The runner every scene shares. script(t) lays out the steps with
  // t.at(ms, fn); the helpers below are the verbs a step can use.
  function createScene(root, { script, finalState, loopAt }) {
    const cursor = root.querySelector('.scene__cursor');
    let timers = [];
    let playing = false;

    const at = (ms, fn) => { timers.push(setTimeout(fn, ms)); };
    const on = (...names) => names.forEach((n) => root.classList.add('s-' + n));
    const off = (...names) => names.forEach((n) => root.classList.remove('s-' + n));
    const target = (name) => root.querySelector('[data-target="' + name + '"]');

    // Where the cursor's tip is, in px from the scene's top left.
    let cx = 0;
    let cy = 0;
    const place = (x, y, ms) => {
      cx = x;
      cy = y;
      cursor.style.setProperty('--glide', ms + 'ms');
      cursor.style.setProperty('--x', x.toFixed(1) + 'px');
      cursor.style.setProperty('--y', y.toFixed(1) + 'px');
    };
    // Places the cursor's tip on a point inside an element, given as
    // fractions of its box, gliding there over ms (0 jumps).
    const glide = (el, ms, fx = 0.5, fy = 0.55) => {
      const box = root.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      place(r.left - box.left + r.width * fx, r.top - box.top + r.height * fy, ms);
    };
    // One em of the scene, in px, for distances drawn in the CSS's unit.
    const em = (n) => n * parseFloat(getComputedStyle(root).fontSize);
    // Parks the cursor just off the screen's lower right, out of sight.
    const park = () => {
      const box = root.getBoundingClientRect();
      place(box.width * 0.82, box.height * 1.04, 0);
    };
    // Holds the cursor down (true) or lets it up (false).
    const press = (down) => {
      cursor.style.setProperty('--glide', '120ms');
      cursor.style.setProperty('--press', down ? '0.82' : '1');
    };
    // Moves a row sideways by its transform to x px, over ms on curve.
    const scrollTo = (el, x, ms, curve) => {
      el.style.transition = 'transform ' + ms + 'ms ' + curve;
      el.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
    };
    // A swipe: with the cursor held down on a row, both travel dx px
    // over ms, gathering speed, so the fling that follows carries on
    // at the pace the finger left off.
    const drag = (el, dx, ms) => {
      place(cx + dx, cy, ms);
      cursor.style.setProperty('--press', '0.82');
      scrollTo(el, dx, ms, 'cubic-bezier(0.5, 0, 1, 1)');
    };
    // A tap: the cursor dips and the element under it gives, then both
    // come back; then() runs at the moment of contact.
    const tap = (el, then) => {
      cursor.style.setProperty('--glide', '140ms');
      cursor.style.setProperty('--press', '0.82');
      el.classList.add('is-pressed');
      if (then) then();
      at(160, () => {
        cursor.style.setProperty('--press', '1');
        el.classList.remove('is-pressed');
      });
    };
    // Counts a figure like "$24" up to `to` over ms, on an ease-out.
    const count = (el, to, ms = 650) => {
      const from = Number(el.textContent.replace(/[^\d]/g, '')) || 0;
      const start = performance.now();
      el.classList.remove('is-bump');
      void el.offsetWidth;
      el.classList.add('is-bump');
      const step = (now) => {
        if (!playing) return;
        const f = Math.min(1, (now - start) / ms);
        const eased = 1 - Math.pow(1 - f, 3);
        el.textContent = '$' + Math.round(from + (to - from) * eased);
        if (f < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const verbs = { at, on, off, target, glide, park, press, tap, drag, scrollTo, em, count, root };

    // Back to the first frame with nothing animating on the way.
    const reset = () => {
      timers.forEach(clearTimeout);
      timers = [];
      root.classList.add('is-resetting');
      [...root.classList].forEach((c) => { if (c.startsWith('s-')) root.classList.remove(c); });
      root.querySelectorAll('.is-pressed, .is-bump').forEach((el) => el.classList.remove('is-pressed', 'is-bump'));
      root.querySelectorAll('[data-scene-count]').forEach((el) => { el.textContent = el.dataset.sceneCountFrom; });
      root.querySelectorAll('[data-scroll]').forEach((el) => { el.style.transition = ''; el.style.transform = ''; });
      cursor.style.setProperty('--press', '1');
      park();
      void root.offsetWidth;
      root.classList.remove('is-resetting');
    };
    root.querySelectorAll('[data-scene-count]').forEach((el) => { el.dataset.sceneCountFrom = el.textContent; });

    const run = () => {
      script(verbs);
      at(loopAt, () => { reset(); run(); });
    };

    return {
      play() {
        if (playing) return;
        playing = true;
        reset();
        if (reduced.matches) {
          root.classList.add('is-resetting');
          finalState(verbs);
          return;
        }
        run();
      },
      stop() {
        if (!playing) return;
        playing = false;
        reset();
      },
    };
  }

  // Chapter 1 — grooming, for Hector. The film plays alone for a few
  // seconds, then Explore rises over it. The cursor swipes "Picked for
  // you and Hector" and lets go; the row flies past more picks than
  // can be read and settles with the wash & dry, at 20% off, first in
  // view. The cursor opens it, books it for Saturday, ticks a $20
  // post-groom photo (the total counts up) and a free dental check,
  // and confirms. "Booked" and the saving hold, everything drops away,
  // and the film has the screen again before the next round.
  const scripts = {
    groom: {
      loopAt: 20500,
      script({ at, on, off, target, glide, press, tap, drag, scrollTo, em, count, root }) {
        // The row draws its cards in while in flight (s-fling) and the
        // picked card's offer hops once it lands (s-pick).
        const total = root.querySelector('[data-scene-count]');
        const rail = root.querySelector('[data-scroll="picked"]');
        const wash = target('wash');
        at(3800, () => on('app'));
        at(5000, () => { on('cursor'); glide(rail.children[0], 750, 0.75, 0.4); });
        at(5850, () => press(true));
        at(6000, () => { on('fling'); drag(rail, -em(5), 320); });
        // Let go: the fling carries the row on and eases to a stop with
        // the wash & dry exactly where the first card started.
        at(6320, () => {
          press(false);
          scrollTo(rail, rail.children[0].offsetLeft - wash.offsetLeft, 1600, 'cubic-bezier(0.05, 0.75, 0.15, 1)');
        });
        at(7350, () => { off('fling'); on('pick'); });
        at(8100, () => glide(wash, 650, 0.5, 0.42));
        at(8900, () => tap(wash, () => on('sheet')));
        at(9950, () => glide(target('book'), 750, 0.5, 0.55));
        at(10900, () => tap(target('book'), () => on('extras')));
        at(11800, () => glide(target('photo').querySelector('.sx-check'), 750));
        at(12700, () => tap(target('photo'), () => { on('photo'); count(total, 116); }));
        at(13400, () => glide(target('dental').querySelector('.sx-check'), 550));
        at(14100, () => tap(target('dental'), () => on('dental')));
        at(14800, () => glide(target('confirm'), 700, 0.5, 0.55));
        at(15650, () => tap(target('confirm'), () => on('done')));
        at(16250, () => off('cursor'));
        at(19500, () => on('out'));
      },
      finalState({ on, root }) {
        on('app', 'sheet', 'extras', 'photo', 'dental', 'done');
        root.querySelector('[data-scene-count]').textContent = '$116';
      },
    },
  };

  return {
    create(root) {
      const def = scripts[root.dataset.scene];
      return def ? createScene(root, def) : null;
    },
  };
})();
