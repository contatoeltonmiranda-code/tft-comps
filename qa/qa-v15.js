// QA v15 (seed-38 "Sabugueiro Carrasco Alune" abaixo da seed-37). Headless.
// Uso: servidor na raiz (python -m http.server 8775) e QA_BASE=http://127.0.0.1:8775/ node qa/qa-v15.js
const path = require('path');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const exe = process.env.LOCALAPPDATA.replace(/\\/g, '/') + '/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8775/';
const out = (label, nome) => path.join(__dirname, `v15-${label}-${nome}.png`);

async function run(browser, label, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/kaspersky/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed ' + r.url()));
  page.setDefaultTimeout(15000);
  await page.goto(BASE + 'index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('article.comp');
  const card = page.locator('article.comp', { hasText: 'Sabugueiro Carrasco Alune' }).first();
  const idx = await page.evaluate(() => [...document.querySelectorAll('article.comp')].findIndex((a) => a.textContent.includes('Sabugueiro Carrasco Alune')));
  const total = await page.locator('article.comp').count();
  await card.scrollIntoViewIfNeeded();
  const tg = card.locator('button[aria-label="Mostrar tabuleiro"]');
  if ((await tg.getAttribute('aria-pressed')) !== 'true') await tg.click();
  // lazy: rola o card para forcar as imagens
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const info = await card.evaluate(async (e) => {
    await Promise.all([...e.querySelectorAll('img')].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    const imgs = [...e.querySelectorAll('img')];
        return {
      imgs: imgs.length,
      quebradas: imgs.filter((i) => !(i.naturalWidth > 0)).map((i) => i.getAttribute('src')),
      itens: imgs.filter((i) => /items\//.test(i.getAttribute('src') || '')).length,
      hexes: e.querySelectorAll('.board .hex').length,
      ocupadas: [...e.querySelectorAll('.board .hex.has')].map((x) => x.getAttribute('data-r') + ',' + x.getAttribute('data-c') + ':' + (x.getAttribute('aria-label') || x.title || '')),
      texto: e.innerText.replace(/\s+/g, ' ').slice(0, 420)
    };
  });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await card.screenshot({ path: out(label, 'seed-38') });
  console.log(label, JSON.stringify({ idx, total, over, info, errors }));
  await ctx.close();
  return { idx, total, over, info, errors };
}

(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const a = await run(browser, 'd1440', { width: 1440, height: 900 }, false);
  const b = await run(browser, 'm390', { width: 390, height: 844 }, true);
  await browser.close();
  const bad = [a, b].some((r) => r.errors.length || r.info.quebradas.length || r.over > 0 || r.idx !== 13);
  process.exit(bad ? 1 : 0);
})();
