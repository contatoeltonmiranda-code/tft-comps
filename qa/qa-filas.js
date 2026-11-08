// QA leve do filtro de Fila no Pos-jogo (1440, um Chromium). Fixtures FICTICIAS derivadas de data/posjogo-exemplo.js.
// Uso: node qa/qa-filas.js  (sobe servidor estatico proprio na porta 8791 e porta ?porta=17899 inexistente para nao tocar no helper real)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const exe = process.env.LOCALAPPDATA.replace(/\\/g, '/') + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
global.window = {};
require(path.join(ROOT, 'data/posjogo-exemplo.js'));
const ex = window.TFT_POSJOGO_EXEMPLO.partidas;
const filas = [[1100, 'standard'], [1100, 'standard'], [1090, 'normal'], [1230, 'standard'], [1230, 'standard'], [1220, 'pve'], [4242, 'standard']];
const fixtures = filas.map(([fila, tipo], i) => Object.assign({}, ex[i % ex.length], { id: 'BR1_FILA' + (i + 1), fila, tipo, quando: 1762000000000 - i * 3600000 }));
const srv = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(8791, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  let code = 0;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((p) => { try { localStorage.setItem('tft-comps:partidas:v1', JSON.stringify({ salvoEm: new Date().toISOString(), origem: 'cache', partidas: p })); } catch (e) { /* */ } }, fixtures);
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION/.test(m.text())) erros.push(m.text()); });
    await page.goto('http://127.0.0.1:8791/posjogo.html?porta=17899', { waitUntil: 'load' });
    await page.waitForSelector('.pj-partida');
    const opts = await page.$$eval('#pj-fila option', (o) => o.map((x) => x.textContent));
    const sel = await page.$eval('#pj-fila', (s) => s.value);
    const n1 = await page.$$eval('.pj-partida', (l) => l.length);
    const cards = await page.$eval('#pj-cards', (e) => e.textContent);
    console.log('opcoes:', JSON.stringify(opts), '| selecionada:', sel, '| cards:', n1, '|', cards);
    await page.screenshot({ path: path.join(__dirname, 'filas-1440-1-padrao.png'), fullPage: false });
    await page.selectOption('#pj-fila', 'todas');
    const metas = await page.$$eval('.pj-meta span', (l) => l.map((x) => x.textContent));
    console.log('todas:', await page.$$eval('.pj-partida', (l) => l.length), '|', JSON.stringify(metas));
    console.log('cards todas:', await page.$eval('#pj-cards', (e) => e.textContent));
    await page.selectOption('#pj-fila', '1220');
    console.log('1220:', await page.$eval('#pj-cards', (e) => e.textContent), '|', await page.$eval('#pj-aviso-fila', (e) => e.textContent));
    await page.selectOption('#pj-fila', 'todas');
    await page.screenshot({ path: path.join(__dirname, 'filas-1440-2-todas.png'), fullPage: false });
    console.log('erros de console:', JSON.stringify(erros));
    if (erros.length) code = 1;
  } finally {
    await browser.close();
    srv.close();
  }
  process.exitCode = code;
})();
