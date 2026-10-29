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

    // Places the cursor's tip on a point inside an element, given as
    // fractions of its box, gliding there over ms (0 jumps).
    const glide = (el, ms, fx = 0.5, fy = 0.55) => {
      const box = root.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      cursor.style.setProperty('--glide', ms + 'ms');
      cursor.style.setProperty('--x', (r.left - box.left + r.width * fx).toFixed(1) + 'px');
      cursor.style.setProperty('--y', (r.top - box.top + r.height * fy).toFixed(1) + 'px');
    };
    // Parks the cursor just off the screen's lower right, out of sight.
    const park = () => {
      const box = root.getBoundingClientRect();
      cursor.style.setProperty('--glide', '0ms');
      cursor.style.setProperty('--x', (box.width * 0.82).toFixed(1) + 'px');
      cursor.style.setProperty('--y', (box.height * 1.04).toFixed(1) + 'px');
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

    const verbs = { at, on, off, target, glide, park, tap, count, root };

    // Back to the first frame with nothing animating on the way.
    const reset = () => {
      timers.forEach(clearTimeout);
      timers = [];
      root.classList.add('is-resetting');
      [...root.classList].forEach((c) => { if (c.startsWith('s-')) root.classList.remove(c); });
      root.querySelectorAll('.is-pressed, .is-bump').forEach((el) => el.classList.remove('is-pressed', 'is-bump'));
      root.querySelectorAll('[data-scene-count]').forEach((el) => { el.textContent = el.dataset.sceneCountFrom; });
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

  // Chapter 1 — grooming. The film plays alone for a few seconds, then
  // a sheet of member prices rises over it. The cursor picks Saturday
  // 10:00 for a full groom at 20% off, the booking page pushes in, two
  // add-ons that are free with Etho are switched on while the saving
  // counts up, and the booking is made. It holds, the sheet drops
  // away, and the film has the screen again before the next round.
  const scripts = {
    groom: {
      loopAt: 17000,
      script({ at, on, off, target, glide, tap, count, root }) {
        const saved = root.querySelector('[data-scene-count]');
        at(4200, () => on('sheet'));
        at(4650, () => on('cards'));
        at(5700, () => { on('cursor'); glide(target('slot'), 950, 0.45, 0.6); });
        at(6800, () => tap(target('slot'), () => on('slot')));
        at(7350, () => on('book'));
        at(8250, () => glide(target('photo').querySelector('.sc-toggle'), 800));
        at(9150, () => tap(target('photo'), () => { on('photo'); count(saved, 39); }));
        at(9750, () => glide(target('dental').querySelector('.sc-toggle'), 550));
        at(10450, () => tap(target('dental'), () => { on('dental'); count(saved, 64); }));
        at(11100, () => glide(target('book'), 750, 0.5, 0.55));
        at(12000, () => tap(target('book'), () => on('booked')));
        at(12800, () => off('cursor'));
        at(15900, () => on('out'));
      },
      finalState({ on, root }) {
        on('sheet', 'cards', 'slot', 'book', 'photo', 'dental', 'booked');
        root.querySelector('[data-scene-count]').textContent = '$64';
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
