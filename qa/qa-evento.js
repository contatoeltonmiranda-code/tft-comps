// QA leve do evento (deteccao por monstros + override) no Pos-jogo e no Plano (1440, um Chromium). Fixtures FICTICIAS derivadas de data/posjogo-exemplo.js.
// Uso: node qa/qa-evento.js  (servidor estatico proprio na porta 8792; helper falso na porta ?porta=17899, inexistente)
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
const MON = ['DA_Krug18', 'DA_Murkwolf18', 'DA_CrimsonRaptor18', 'DA_18_Sentry', 'DA_Scuttlecrab18', 'DA_Brambleback18', 'DA_18_ElderDragon', 'DA_Cinderling18'];
const un = (ids) => ids.map((id) => ({ id, tier: 2, itens: [] }));
// A: 1100 com 8 monstros (evento por monstros) | B: 1100 com 6 monstros (ranqueada) | C: 1230 sem monstros (evento por fila) | D: 1100 normal
const defs = [['BR1_QAMON8', 1100, un(MON), 6], ['BR1_QAMON6', 1100, un(MON.slice(0, 6).concat(['DA_18_Ahri'])), 3], ['BR1_QAFILA', 1230, un(['DA_18_Ahri', 'DA_18_Veigar']), 2], ['BR1_QANORMAL', 1100, un(['DA_18_Ahri', 'DA_18_Veigar', 'DA_18_Ornn']), 4]];
const fixtures = defs.map(([id, fila, unidades, col], i) => {
  const b = JSON.parse(JSON.stringify(ex[i % ex.length]));
  return Object.assign(b, { id, fila, tipo: 'standard', quando: 1762000000000 - i * 3600000, eu: Object.assign(b.eu, { unidades, colocacao: col }) });
});
const srv = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const falhas = [];
const ok = (cond, msg) => { console.log(cond ? 'ok  ' : 'FAIL', msg); if (!cond) falhas.push(msg); };
(async () => {
  await new Promise((r) => srv.listen(8792, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((p) => { try { if (!localStorage.getItem('tft-comps:partidas:v1')) localStorage.setItem('tft-comps:partidas:v1', JSON.stringify({ salvoEm: new Date().toISOString(), origem: 'cache', partidas: p })); } catch (e) { /* */ } }, fixtures);
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION/.test(m.text())) erros.push(m.text()); });
    await page.goto('http://127.0.0.1:8792/posjogo.html?porta=17899', { waitUntil: 'load' });
    await page.waitForSelector('.pj-partida');
    const cards = () => page.$eval('#pj-cards', (e) => e.textContent);
    await page.selectOption('#pj-fila', 'todas');
    const motivos = await page.$$eval('.pj-partida .pj-motivo', (l) => l.map((x) => x.textContent));
    console.log('motivos:', JSON.stringify(motivos));
    ok(motivos.some((m) => /monstros no tabuleiro \(8 unidades\)/.test(m)), 'card 8 monstros: motivo "monstros no tabuleiro"');
    ok(motivos.some((m) => /fila do evento/.test(m)), 'card 1230: motivo "fila do evento"');
    ok(motivos.length === 2, 'so os 2 eventos tem motivo (6 monstros e normal nao)');
    await page.selectOption('#pj-fila', 'padrao');
    const total0 = await page.$eval('.pj-card-v', (e) => e.textContent);
    ok(total0 === '2', 'padrao: 2 partidas (6 monstros + normal)');
    await page.selectOption('#pj-fila', 'todas');
    const btns = await page.$$eval('.pj-marcar-btn', (l) => l.map((x) => x.textContent));
    console.log('botoes:', JSON.stringify(btns));
    ok(btns.filter((b) => b === 'Isto foi ranqueada').length === 2 && btns.filter((b) => b === 'Isto foi evento').length === 2, 'botoes certos por card');
    await page.screenshot({ path: path.join(__dirname, 'evento-1440-1-todas.png') });
    // marca o card dos 8 monstros como ranqueada
    const card = page.locator('.pj-partida', { hasText: 'Krugue' }).first();
    await card.locator('.pj-marcar-btn').click();
    const ls = await page.evaluate(() => localStorage.getItem('tft-comps:posjogo-override:v1'));
    console.log('localStorage:', ls);
    ok(ls === JSON.stringify({ BR1_QAMON8: 'regular' }), 'localStorage guarda so matchId -> regular');
    await page.selectOption('#pj-fila', 'padrao');
    ok((await page.$eval('.pj-card-v', (e) => e.textContent)) === '3', 'padrao passa a 3 partidas apos override');
    await page.selectOption('#pj-fila', 'todas');
    const mot2 = await page.$$eval('.pj-partida .pj-motivo', (l) => l.map((x) => x.textContent));
    console.log('motivos apos:', JSON.stringify(mot2));
    ok(mot2.some((m) => /Ranqueada: marcado por você/.test(mot2.join('|')) && /Ranqueada: marcado por você/.test(m)), 'card marcado mostra "marcado por voce"');
    // marca o card normal como evento
    await page.locator('.pj-partida', { hasText: 'Ornn' }).first().locator('.pj-marcar-btn').click();
    await page.selectOption('#pj-fila', 'padrao');
    ok((await page.$eval('.pj-card-v', (e) => e.textContent)) === '2', 'padrao volta a 2 apos marcar o normal como evento');
    await page.selectOption('#pj-fila', 'todas');
    await page.screenshot({ path: path.join(__dirname, 'evento-1440-2-marcados.png') });
    // persiste no reload
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.pj-partida');
    await page.selectOption('#pj-fila', 'padrao');
    ok((await page.$eval('.pj-card-v', (e) => e.textContent)) === '2', 'override persiste no reload');
    // Plano le o mesmo localStorage
    const plano = await ctx.newPage();
    plano.on('pageerror', (e) => erros.push('plano: ' + String(e)));
    await plano.goto('http://127.0.0.1:8792/plano.html?porta=17899', { waitUntil: 'load' });
    await plano.waitForSelector('#pl-fonte');
    await plano.waitForFunction(() => /histórico/.test(document.querySelector('#pl-fonte').textContent));
    const fonteTxt = await plano.$eval('#pl-fonte', (e) => e.textContent);
    console.log('plano:', fonteTxt);
    ok(/histórico: 2 partidas/.test(fonteTxt), 'Plano usa 2 partidas (mesmo override)');
    // desfaz marcacoes
    await page.selectOption('#pj-fila', 'todas');
    while (await page.locator('.pj-desfazer').count()) await page.locator('.pj-desfazer').first().click();
    ok((await page.evaluate(() => localStorage.getItem('tft-comps:posjogo-override:v1'))) === '{}', 'desfazer remove as marcacoes');
    console.log('erros de console:', JSON.stringify(erros));
    if (erros.length) falhas.push('erros de console');
  } finally {
    await browser.close();
    srv.close();
  }
  process.exitCode = falhas.length ? 1 : 0;
})();
