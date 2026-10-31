/* ---------------------------------------------------------------
   Showcase scenes — Etho's app UI, acted out inside the phone

   Each scene is a script of timed steps. A step only adds or removes
   state classes (s-*) on the scene, glides the cursor to an element,
   taps it, or counts a number up; how anything moves is left to
   scenes.css. home.js plays a chapter's scene once the chapter is in
   and on screen, and stops it (back to the very start) whenever the
   chapter leaves, so a scene always opens from its first beat. A
   scene loops by sending everything back down and starting over.

   How to make a new one, and the style to keep: the showcase-scenes
   skill (.claude/skills/showcase-scenes/SKILL.md).

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

    // Types an element's data-type into it, a letter every ms, as into
    // a search field; the caret shows while s-typing is on.
    const type = (el, ms = 55) => {
      const text = [...el.dataset.type];
      let n = 0;
      const next = () => {
        if (!playing) return;
        n += 1;
        el.textContent = text.slice(0, n).join('');
        if (n < text.length) at(ms, next);
      };
      next();
    };

    // Puts states on with no transition, as if they had always been
    // there: a scene that opens on its UI shows it from the first frame.
    const now = (...names) => {
      root.classList.add('is-resetting');
      on(...names);
      void root.offsetWidth;
      root.classList.remove('is-resetting');
    };

    // The chapter's closing film (data-outro), run from its start by
    // roll(); it holds its last frame until the next round's UI rises.
    const outro = root.parentElement.querySelector('video[data-outro]');
    const roll = () => {
      if (!outro) return;
      try { outro.currentTime = 0; } catch (e) { /* not loaded yet: at 0 */ }
      const played = outro.play();
      if (played) played.catch(() => {});
    };

    // The closing film is fetched whole while the scene plays, and then
    // played from memory, so a slow connection can never stall it
    // midway (a browser's "can play through" is only a guess). Fetched
    // once per page; if the fetch fails the film streams as usual.
    let fetched = null;
    const fetchWhole = () => {
      if (!outro) return Promise.resolve();
      if (!fetched) {
        fetched = fetch(outro.currentSrc || outro.src)
          .then((r) => (r.ok ? r.blob() : Promise.reject(r.status)))
          .then((blob) => {
            outro.src = URL.createObjectURL(blob);
            outro.load();
          })
          .catch(() => {});
      }
      return fetched;
    };
    // Runs fn once the closing film is in memory: the scene holds its
    // last screen meanwhile. After maxMs it goes anyway, and the film's
    // still (its first frame) stands in until frames arrive.
    const whenReady = (fn, maxMs = 6000) => {
      let done = false;
      const go = () => {
        if (done || !playing) return;
        done = true;
        fn();
      };
      fetchWhole().then(go);
      at(maxMs, go);
    };

    // Which round this is: 1 on arrival, then counting up as it loops.
    let round = 0;
    // Starts the next round ms from now, for a scene whose length is not
    // fixed (one that waits on its film); others loop at loopAt.
    let again = () => {};

    const verbs = {
      at, on, off, now, target, glide, park, press, tap, drag, scrollTo, type, em, count, roll, whenReady, root,
      again: (ms) => again(ms),
      get first() { return round === 1; },
    };

    // Back to the first frame with nothing animating on the way.
    const reset = () => {
      timers.forEach(clearTimeout);
      timers = [];
      root.classList.add('is-resetting');
      [...root.classList].forEach((c) => { if (c.startsWith('s-')) root.classList.remove(c); });
      root.querySelectorAll('.is-pressed, .is-bump').forEach((el) => el.classList.remove('is-pressed', 'is-bump'));
      root.querySelectorAll('[data-scene-count]').forEach((el) => { el.textContent = el.dataset.sceneCountFrom; });
      root.querySelectorAll('[data-scroll]').forEach((el) => { el.style.transition = ''; el.style.transform = ''; });
      root.querySelectorAll('[data-type]').forEach((el) => { el.textContent = ''; });
      cursor.style.setProperty('--press', '1');
      park();
      void root.offsetWidth;
      root.classList.remove('is-resetting');
    };
    root.querySelectorAll('[data-scene-count]').forEach((el) => { el.dataset.sceneCountFrom = el.textContent; });

    // The chapter's film, when it plays once ahead of the scene: each
    // later round starts it again, so the scene always opens on it.
    const film = root.parentElement.querySelector('video[data-once]');
    const replay = () => {
      if (!film || !film.ended) return;
      film.currentTime = 0;
      const played = film.play();
      if (played) played.catch(() => {});
    };

    const run = () => {
      round += 1;
      replay();
      script(verbs);
      if (loopAt) at(loopAt, () => { reset(); run(); });
    };
    again = (ms) => at(ms, () => { reset(); run(); });

    return {
      play() {
        if (playing) return;
        playing = true;
        round = 0;
        fetchWhole();
        reset();
        if (reduced.matches) {
          root.classList.add('is-resetting');
          root.querySelectorAll('[data-type]').forEach((el) => { el.textContent = el.dataset.type; });
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

  // Chapter 1 — grooming, for Hector. The scene opens the chapter:
  // "Picked for Hector" is on screen from the first frame (later rounds
  // rise over the film's last frame). The cursor swipes the row and
  // lets go; it flies past more picks than can be read and settles with
  // the wash & dry, at 20% off, first in view. The cursor opens it,
  // books it for Saturday, ticks a $20 post-groom photo (the total
  // counts up) and a free dental check, and confirms. "Booked" and the
  // saving hold, then everything drops away and the Samoyed shakes off
  // his bath.
  const scripts = {
    groom: {
      // No fixed length: the round ends 6s after the Samoyed starts.
      loopAt: null,
      script(t) {
        const { at, on, off, now, target, glide, press, tap, drag, scrollTo, em, count, roll, whenReady, again, root } = t;
        // The row draws its cards in while in flight (s-fling) and the
        // picked card's offer hops once it lands (s-pick).
        const total = root.querySelector('[data-scene-count]');
        const rail = root.querySelector('[data-scroll="picked"]');
        const wash = target('wash');
        if (t.first) now('app'); else at(0, () => on('app'));
        at(1700, () => { on('cursor'); glide(rail.children[0], 750, 0.75, 0.4); });
        at(2550, () => press(true));
        at(2700, () => { on('fling'); drag(rail, -em(5), 320); });
        // Let go: the fling carries the row on and eases to a stop with
        // the wash & dry exactly where the first card started.
        at(3020, () => {
          press(false);
          scrollTo(rail, rail.children[0].offsetLeft - wash.offsetLeft, 1600, 'cubic-bezier(0.05, 0.75, 0.15, 1)');
        });
        at(4050, () => { off('fling'); on('pick'); });
        at(4800, () => glide(wash, 650, 0.5, 0.42));
        at(5600, () => tap(wash, () => on('sheet')));
        at(6650, () => glide(target('book'), 750, 0.5, 0.55));
        at(7600, () => tap(target('book'), () => on('extras')));
        at(8500, () => glide(target('photo').querySelector('.sx-check'), 750));
        at(9400, () => tap(target('photo'), () => { on('photo'); count(total, 116); }));
        at(10100, () => glide(target('dental').querySelector('.sx-check'), 550));
        at(10800, () => tap(target('dental'), () => on('dental')));
        at(11500, () => glide(target('confirm'), 700, 0.5, 0.55));
        at(12350, () => tap(target('confirm'), () => on('done')));
        at(12950, () => off('cursor'));
        // Once the Samoyed can play through, everything drops away and
        // he shakes off his bath; the next round rises over his grin.
        at(15500, () => whenReady(() => { on('out'); roll(); again(6000); }));
      },
      finalState({ on, root }) {
        on('app', 'sheet', 'extras', 'photo', 'dental', 'done');
        root.querySelector('[data-scene-count]').textContent = '$116';
      },
    },

    // Chapter 2, first screen — training a puppy. A large search sits
    // in the middle of frosted glass. "Train my puppy…" is typed into
    // it, the bar rises, and three answers come in on glass: puppy
    // school 200m away at 25% off (its offer hops), the puppy parents'
    // Wednesday meetup, and group training at 30% off. The cursor taps
    // puppy school, and a success screen slides up, "A+ for your pup.
    // Perks for you.", with the month's saving counting up to $120. It slides away, the bar settles
    // back in the middle, and the round starts over.
    puppy: {
      loopAt: 13600,
      script({ at, on, off, target, glide, tap, type, count, root }) {
        const field = target('search').querySelector('[data-type]');
        const saved = root.querySelector('[data-scene-count]');
        const school = target('school');
        at(900, () => { on('typing'); type(field, 65); });
        at(2200, () => { off('typing'); on('up'); });
        at(2900, () => on('results'));
        at(3700, () => on('pick'));
        at(4500, () => { on('cursor'); glide(school, 850, 0.55, 0.5); });
        at(5550, () => tap(school));
        at(5800, () => { on('success'); off('cursor'); });
        at(6800, () => count(saved, 120, 900));
        at(11800, () => off('success'));
        at(12500, () => off('results', 'pick', 'up'));
      },
      finalState({ on, root }) {
        on('up', 'results', 'success');
        root.querySelector('[data-scene-count]').textContent = '$120';
      },
    },

    // Chapter 2, second screen — Winnie, a Dachshund with sore hips.
    // She steps down the sofa stairs (the film, rolled once it is in
    // memory) and a glass search rises over her; "Winnie has hip pain"
    // is typed, the film frosts over, the page comes in behind with its
    // header, the bar settles under it, and three large therapies fill
    // the screen, hydrotherapy at 15% off. The cursor books it, a
    // confirmation slides up (like the puppy's success screen) offering
    // "The little extras matter", and the cursor picks the dog ramp and
    // taps Shop; the total Etho saving opens above it.
    winnie: {
      loopAt: null,
      script({ at, on, off, target, glide, tap, type, count, roll, whenReady, again, root }) {
        const field = target('search').querySelector('[data-type]');
        const saved = root.querySelector('[data-scene-count]');
        whenReady(() => {
          roll();
          at(1300, () => on('bar'));
          at(2000, () => { on('typing'); type(field, 60); });
          at(3300, () => { off('typing'); on('frost'); });
          at(3900, () => on('app', 'up'));
          at(4600, () => on('list'));
          at(5400, () => on('pick'));
          at(6300, () => { on('cursor'); glide(target('hydro'), 850, 0.5, 0.5); });
          at(7350, () => tap(target('hydro')));
          at(7600, () => on('success'));
          at(9600, () => glide(target('ramp').querySelector('.sx-extra__photo'), 800, 0.5, 0.55));
          at(10600, () => tap(target('ramp'), () => on('ramp')));
          at(11400, () => glide(target('shop'), 750, 0.5, 0.55));
          at(12350, () => tap(target('shop'), () => on('shop')));
          at(13000, () => off('cursor'));
          // Then the total opens: $21 off the ramp, 15% off an $80 swim.
          at(13300, () => on('total'));
          at(13700, () => count(saved, 33, 900));
          at(16900, () => on('out'));
          again(18000);
        });
      },
      finalState({ on, root }) {
        on('bar', 'frost', 'app', 'up', 'list', 'success', 'ramp', 'shop', 'total');
        root.querySelector('[data-scene-count]').textContent = '$33';
      },
    },

    // Chapter 3 — a weekend away for Bobbi's birthday. A notification
    // drops in over the chapter's photo; the cursor taps it and Etho
    // opens out of it on three dog-friendly stays, the beach hotel at
    // 25% off. The cursor opens the hotel, taps the free welcome pupcake
    // to see its flavours, picks pumpkin (the choice folds back into the
    // row), adds an outdoor dinner, and books the weekend: a success
    // screen with confetti, the total saving, and outfits to shop.
    trip: {
      loopAt: 21500,
      script({ at, on, off, target, glide, tap, count, root }) {
        const saved = root.querySelector('[data-scene-count]');
        // The lock screen holds a moment before the notification lands.
        at(1100, () => on('notif'));
        at(2300, () => { on('cursor'); glide(target('notif'), 800, 0.55, 0.55); });
        at(3250, () => tap(target('notif'), () => on('open', 'app')));
        at(3500, () => on('list'));
        at(4300, () => on('pick'));
        at(5200, () => glide(target('hotel'), 800, 0.5, 0.5));
        at(6150, () => tap(target('hotel'), () => on('sheet')));
        at(7300, () => glide(target('cake'), 800, 0.6, 0.5));
        at(8250, () => tap(target('cake'), () => on('cake')));
        at(9050, () => glide(target('pumpkin'), 650, 0.5, 0.6));
        at(9850, () => tap(target('pumpkin'), () => on('pumpkin')));
        at(10500, () => on('caked'));
        at(11200, () => glide(target('dinner').querySelector('.sx-check'), 700));
        at(12050, () => tap(target('dinner'), () => on('dinner')));
        at(12800, () => glide(target('book'), 700, 0.5, 0.55));
        at(13650, () => tap(target('book'), () => on('booked')));
        at(14300, () => off('cursor'));
        // Then the success screen slides up with confetti, and the total
        // counts up: $140 off the stay and the free pupcake ($12).
        at(14500, () => on('success'));
        at(15600, () => count(saved, 152, 900));
        at(20500, () => on('out'));
      },
      finalState({ on, root }) {
        on('notif', 'open', 'app', 'list', 'sheet', 'cake', 'pumpkin', 'caked', 'dinner', 'booked', 'success');
        root.querySelector('[data-scene-count]').textContent = '$152';
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
