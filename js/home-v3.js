/* home-v3 only. main.js still carries the hero video, the reveal and the
   fixed wordmark; landing.js carries the analytics and the waitlist
   forms, this page's third one included. */

/* ---------------------------------------------------------------
   The waitlist form pinned to the top of the page

   It stays out of the way until the hero is half scrolled past, then
   comes down and stays for the rest of the page. main.js separately
   toggles .is-past-hero on it, which is what flips it from glass over
   the video to solid over the page below.

   Desktop only: below 901px CSS hides it and the sticky bar at the
   foot of the page does the same job.
   --------------------------------------------------------------- */
function initNavForm(nav) {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  let queued = false;

  const measure = () => {
    queued = false;
    // offsetHeight rather than a cached number: the hero is sized in
    // svh, so it changes when the browser chrome collapses.
    nav.classList.toggle('is-visible', window.scrollY >= hero.offsetHeight / 2);
  };

  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(measure);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  measure();
}

document.querySelectorAll('[data-nav-form]').forEach(initNavForm);
