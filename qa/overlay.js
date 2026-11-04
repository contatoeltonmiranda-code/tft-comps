// QA da previa do overlay (Playwright). Uso: node qa/overlay.js  (servidor na raiz do projeto em http://127.0.0.1:8765)
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const exe = process.env.LOCALAPPDATA.replace(/\\/g, '/') + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const BASE = process.env.QA_URL || 'http://127.0.0.1:8765/overwolf-app/overlay/overlay.html';
const OUT = __dirname;
const resultados = [];
const ok = (nome, cond, extra) => { resultados.push({ nome, pass: !!cond, extra }); console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome + (extra ? ' -> ' + extra : '')); };

(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  for (const [rotulo, viewport] of [['desktop', { width: 1000, height: 560 }], ['mobile', { width: 390, height: 780 }]]) {
    const page = await browser.newPage({ viewport });
    const erros = [];
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    page.on('pageerror', (e) => erros.push(String(e)));
    page.on('requestfailed', (r) => erros.push('requestfailed ' + r.url()));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const stages = await page.evaluate(() => window.TFT_DEMO_CENARIOS.map((c) => c.estado.stage));
    const n = stages.length;
    for (let i = 0; i < n; i++) {
      await page.goto(BASE + '?cenario=' + i, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const info = await page.evaluate(() => {
        const hud = document.getElementById('hud');
        const r = hud.getBoundingClientRect();
        const imgs = [...hud.querySelectorAll('img')];
        return {
          visivel: getComputedStyle(hud).display !== 'none' && r.height > 0,
          altura: Math.round(r.height),
          largura: Math.round(r.width),
          linhas: hud.querySelectorAll('.linha').length,
          imgsQuebradas: imgs.filter((x) => !(x.complete && x.naturalWidth > 0)).length,
          imgs: imgs.length,
          estoura: hud.scrollWidth > hud.clientWidth + 1,
          maiorLinhaPecas: Math.max(0, ...[...hud.querySelectorAll('.pecas')].map((p) => Math.round(p.getBoundingClientRect().height))),
          texto: hud.textContent.slice(0, 120),
        };
      });
      const esperaVisivel = stages[i] !== '2-1';
      ok(`${rotulo} cenario ${i}: ${esperaVisivel ? 'visivel' : 'oculto no 2-1'}`, info.visivel === esperaVisivel, JSON.stringify(info));
      if (info.visivel) ok(`${rotulo} cenario ${i}: sem imagem quebrada nem estouro`, info.imgsQuebradas === 0 && !info.estoura && info.largura <= 340);
      await page.screenshot({ path: path.join(OUT, `overlay-${rotulo}-${i}.png`) });
    }
    ok(`${rotulo}: sem erros de console/rede`, erros.length === 0, erros.join(' | '));
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'resultado-overlay.json'), JSON.stringify(resultados, null, 1));
  process.exit(resultados.every((r) => r.pass) ? 0 : 1);
})();
