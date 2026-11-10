// QA v12 (seed-33 e seed-34 abaixo da seed-32; citacao da secao 13 no Painel e no Pos-jogo).
// Uso: servidor na raiz (python -m http.server 8772) e QA_BASE=http://127.0.0.1:8772/ node qa/qa-v12.js
const path = require('path');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const exe = process.env.LOCALAPPDATA.replace(/\\/g, '/') + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8772/';
const out = (label, nome) => path.join(__dirname, `v12-${label}-${nome}.png`);

async function run(browser, label, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/kaspersky/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed ' + r.url()));
  const res = {};
  page.setDefaultTimeout(15000);
  const log = (k, v) => console.log(label, k, JSON.stringify(v));

  // ---- index
  await page.goto(BASE + 'index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('article.comp');
  const arts = page.locator('article.comp');
  res.index = await page.evaluate(async () => {
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    const a = [...document.querySelectorAll('article.comp')];
    return {
      count: a.length,
      nomes: a.slice(6, 12).map((x) => (x.querySelector('h2,h3,.name') || x).textContent.trim().slice(0, 50)),
      imgsQuebradas: [...document.images].filter((i) => !(i.naturalWidth > 0)).map((i) => i.getAttribute('src')),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  log('index', res.index);
  const c33 = arts.nth(8);
  const c34 = arts.nth(9);
  await c33.locator('button[aria-label="Mostrar tabuleiro"]').click().catch(() => {});
  await c33.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  res.c33 = await c33.evaluate((e) => ({ unidades: e.querySelectorAll('img[alt]').length, texto: e.innerText.replace(/\s+/g, ' ').slice(0, 230) }));
  await c33.screenshot({ path: out(label, 'seed33') });
  await c34.scrollIntoViewIfNeeded();
  res.c34 = await c34.evaluate((e) => ({ unidades: e.querySelectorAll('img[alt]').length, texto: e.innerText.replace(/\s+/g, ' ').slice(0, 230) }));
  await c34.screenshot({ path: out(label, 'seed34') });
  log('cards', [res.c33, res.c34]);

  // ---- painel: 4-1, vida 35 (Atencao), ouro 40, nivel 7
  await page.goto(BASE + 'painel.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.pn-card');
  await page.selectOption('#pn-estagio', '4');
  await page.selectOption('#pn-rodada', '1');
  for (const [sel, v] of [['#pn-vida', '35'], ['#pn-ouro', '40'], ['#pn-nivel', '7']]) {
    await page.fill(sel, v);
    await page.dispatchEvent(sel, 'change');
  }
  await page.waitForTimeout(400);
  res.painel = await page.evaluate(() => ({
    links: [...document.querySelectorAll('.pn-ref-vida')].map((a) => ({ t: a.textContent, h: a.getAttribute('href'), title: (a.title || '').slice(0, 90) })),
    blocos: [...document.querySelectorAll('.pn-trecho-vida')].map((b) => b.textContent.slice(0, 110)),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  }));
  log('painel', res.painel);
  const det = page.locator('.pn-trecho').first();
  await det.locator('summary').click().catch(() => {});
  await det.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.locator('#pn-saida').screenshot({ path: out(label, 'painel-citacao') });

  // ---- pos-jogo
  await page.goto(BASE + 'posjogo.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.pj-partida');
  res.pos = await page.evaluate(() => ({
    linhas: [...document.querySelectorAll('.pj-regra-vida')].map((p) => ({ t: p.textContent.slice(0, 120), h: p.querySelector('a') && p.querySelector('a').getAttribute('href') })),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  }));
  log('pos', res.pos);
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  const comVida = page.locator('.pj-achado:has(.pj-regra-vida)').first();
  if (await comVida.count()) {
    await comVida.scrollIntoViewIfNeeded();
    await comVida.screenshot({ path: out(label, 'posjogo-citacao') });
  }
  res.erros = errors;
  log('erros', res.erros);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  try {
    await run(browser, 'd1440', { width: 1440, height: 900 }, false);
    await run(browser, 'm390', { width: 390, height: 844 }, true);
  } finally {
    await browser.close();
  }
})();
