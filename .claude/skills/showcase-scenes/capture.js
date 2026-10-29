/* Captures the showcase phone at chosen moments, to check a scene.

     node capture.js <out-dir> <ms,ms,…> [WIDTHxHEIGHT] [+scrollPx]

   Serve the site first (python3 -m http.server 8765 from the repo
   root). Times are from the moment the showcase pins; each frame is
   saved as <out-dir>/s_<ms>.png. The extra scroll moves further into
   the section, for later chapters (one chapter is one viewport). */
const { chromium } = require('playwright');

(async () => {
  const [out, times, size = '1440x900', extra = '+10'] = process.argv.slice(2);
  const [width, height] = size.split('x').map(Number);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8765/index.html');
  await page.waitForTimeout(600);
  const top = await page.evaluate(() => document.querySelector('#showcase').offsetTop);
  await page.evaluate((y) => window.scrollTo(0, y), top + Number(extra));
  const start = Date.now();
  for (const t of times.split(',').map(Number)) {
    const wait = t - (Date.now() - start);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.locator('.showcase__phone').screenshot({ path: `${out}/s_${String(t).padStart(5, '0')}.png` });
  }
  console.log(errors.length ? 'page errors:\n' + errors.join('\n') : 'no page errors');
  await browser.close();
})();
