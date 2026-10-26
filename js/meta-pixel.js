/* Meta Pixel, behind consent.

   Nothing is sent to Meta, and Meta's script is not even fetched, until
   the visitor says yes in the banner this file shows. The answer is kept
   in localStorage so the banner asks once; a browser sending Global
   Privacy Control is taken as a no and never asked. Meta's own snippet
   ships with a <noscript> image as well; it is left out on purpose,
   since without scripting there is no way to ask first.

   Once consent is given the pixel reports one PageView for the page and
   a Lead for every waitlist signup the server confirms. The Lead hangs
   off the etho:analytics event landing.js dispatches for
   waitlist_signup_success, which fires only after /api/waitlist has
   answered OK, never on the submit itself.

   Loaded by every page a visitor can reach (index.html, and 404.html,
   which Vercel serves for every unknown URL), before landing.js. Any
   element with data-consent-settings reopens the banner. */
(function () {
  var PIXEL_ID = '1125074893823259';
  var STORAGE_KEY = 'etho:consent:marketing';

  var loaded = false;
  var banner = null;

  function readChoice() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
  }

  function saveChoice(choice) {
    try { window.localStorage.setItem(STORAGE_KEY, choice); } catch (_) { /* asks again next visit */ }
  }

  function gpcOn() {
    return navigator.globalPrivacyControl === true;
  }

  function granted() {
    return loaded && typeof window.fbq === 'function';
  }

  // Meta's base code, verbatim but for being called rather than inlined.
  // The loaded flag and Meta's own `if (f.fbq) return` both stand between
  // a second call and a second PageView.
  function loadPixel() {
    if (loaded) return;
    loaded = true;

    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('consent', 'grant');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  // A no after a yes: the pixel stops sending for the rest of the visit,
  // and the cookie it set on our domain goes.
  function revoke() {
    if (typeof window.fbq === 'function') window.fbq('consent', 'revoke');
    loaded = false;
    var host = window.location.hostname.replace(/^www\./, '');
    ['', '; domain=' + host, '; domain=.' + host].forEach(function (domain) {
      document.cookie = '_fbp=; Max-Age=0; path=/' + domain;
      document.cookie = '_fbc=; Max-Age=0; path=/' + domain;
    });
  }

  function choose(choice) {
    saveChoice(choice);
    hideBanner();
    if (choice === 'granted') loadPixel();
    else revoke();
  }

  function hideBanner() {
    if (banner) banner.hidden = true;
  }

  function showBanner() {
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'consent';
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', 'Cookie preferences');
      banner.innerHTML =
        '<p class="consent__text">We’d like to use a Meta cookie to see which of our Facebook and Instagram ads bring people to Etho. Nothing is shared with Meta unless you allow it.</p>' +
        '<div class="consent__actions">' +
          '<button type="button" class="consent__btn" data-consent="denied">No thanks</button>' +
          '<button type="button" class="consent__btn consent__btn--yes" data-consent="granted">Allow</button>' +
        '</div>';
      banner.addEventListener('click', function (evt) {
        var btn = evt.target.closest('[data-consent]');
        if (btn) choose(btn.getAttribute('data-consent'));
      });
      document.body.appendChild(banner);
    }
    banner.hidden = false;
  }

  document.addEventListener('etho:analytics', function (evt) {
    var detail = evt.detail || {};
    if (detail.event !== 'waitlist_signup_success' || !granted()) return;
    window.fbq('track', 'Lead', { content_name: detail.form || 'waitlist' });
  });

  document.addEventListener('click', function (evt) {
    if (!evt.target.closest('[data-consent-settings]')) return;
    evt.preventDefault();
    showBanner();
  });

  var choice = readChoice();
  if (choice === 'granted' && !gpcOn()) loadPixel();
  else if (choice === null && !gpcOn()) showBanner();
})();
