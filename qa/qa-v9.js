// QA v9 (seed-26 e seed-27 abaixo da seed-25). Uso: servidor na raiz (python -m http.server 8765) e node qa/qa-v9.js
const path = require('path');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const exe = process.env.LOCALAPPDATA.split(String.fromCharCode(92)).join('/') + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8765/';

async function run(label, viewport, mobile) {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  try {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/kaspersky/i.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE + 'index.html');
    await page.waitForSelector('article.comp');
    const first = page.locator('article.comp').first();
    const quatro = page.locator('article.comp:nth-child(-n+4)');
    await page.locator('article.comp').nth(2).locator('button[aria-label="Mostrar tabuleiro"]').click().catch(() => {});
    const info = await page.evaluate(async () => {
      await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
      const arts = [...document.querySelectorAll('article.comp')];
      const f = arts[0];
      return {
        count: arts.length,
        nomes: arts.slice(0, 5).map((a) => (a.querySelector('h2,h3,.name') || a).textContent.trim().slice(0, 60)),
        imgsFirst: [...arts[2].querySelectorAll('img')].map((i) => ({ alt: i.alt, ok: i.naturalWidth > 0 })),
        badAll: [...document.images].filter((i) => !(i.naturalWidth > 0)).map((i) => i.getAttribute('src')),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    console.log(label, JSON.stringify(info), 'erros:', errors.length ? errors.join(' | ') : 'nenhum');
    await page.locator('article.comp').nth(2).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(__dirname, `v9-${label}-topo.png`) });
  } finally {
    await browser.close();
  }
}
(async () => {
  await run('d1440', { width: 1440, height: 900 }, false);
  await run('m390', { width: 390, height: 844 }, true);
})().catch((e) => { console.error(e); process.exit(1); });
