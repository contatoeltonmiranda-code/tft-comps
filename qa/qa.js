// QA com Playwright. Uso: node qa/qa.js  (servidor em http://127.0.0.1:8765)
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const exe = process.env.LOCALAPPDATA.replace(/\\/g, '/') + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = process.env.QA_URL || 'http://127.0.0.1:8765/index.html';
const OUT = __dirname;
const results = [];
const ok = (name, cond, extra) => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'OK   ' : 'FALHA') + ' ' + name + (extra ? ' -> ' + extra : '')); };

async function imgReport(page) {
  return page.evaluate(async () => {
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    const bad = [...document.images].filter((i) => !(i.naturalWidth > 0)).map((i) => i.getAttribute('src'));
    return { total: document.images.length, bad };
  });
}

async function catalogImages(page) {
  return page.evaluate(async () => {
    const c = window.TFT_CATALOG;
    const urls = [...c.champs, ...c.items, ...c.traits].map((x) => x.img);
    const bad = [];
    await Promise.all(urls.map((u) => new Promise((r) => { const i = new Image(); i.onload = () => { if (!(i.naturalWidth > 0)) bad.push(u); r(); }; i.onerror = () => { bad.push(u); r(); }; i.src = u; })));
    return { total: urls.length, bad };
  });
}

async function run(label, viewport, mobile) {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/kaspersky/i.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => !/kaspersky/i.test(r.url()) && errors.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });

  await page.goto(URL);
  await page.waitForSelector('article.comp');
  const n = await page.locator('article.comp').count();
  ok(`[${label}] 15 comps renderizadas`, n === 15, 'n=' + n);

  ok(`[${label}] botao Limpar oculto sem busca`, !(await page.locator('#btn-clear').isVisible()));
  const rep = await imgReport(page);
  ok(`[${label}] imagens da lista carregam`, rep.bad.length === 0, `total=${rep.total} falhas=${rep.bad.length} ${rep.bad.slice(0, 3)}`);
  const cat = await catalogImages(page);
  ok(`[${label}] imagens do catalogo completo carregam`, cat.bad.length === 0, `total=${cat.total} falhas=${cat.bad.length} ${cat.bad.slice(0, 3)}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`[${label}] sem rolagem horizontal`, overflow <= 0, 'overflow=' + overflow);
  await page.screenshot({ path: path.join(OUT, `${label}-1-lista.png`) });
  await page.locator('article.comp').nth(8).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, `${label}-2-board.png`) });
  const hasHex = await page.locator('article.comp:nth-child(9) .hex.has').count();
  ok(`[${label}] tabuleiro hex com unidades`, hasHex === 8, 'hex=' + hasHex);

  // busca
  await page.fill('#q', 'diana');
  const dn = await page.locator('article.comp').count();
  const names = await page.locator('article.comp h2').allTextContents();
  ok(`[${label}] busca "diana" filtra`, dn > 0 && dn < 15, `n=${dn}`);
  ok(`[${label}] busca destaca campeao`, (await page.locator('.unit.hit').count()) >= dn);
  await page.screenshot({ path: path.join(OUT, `${label}-3-busca.png`) });
  await page.fill('#q', 'guinsoo');
  ok(`[${label}] busca por item`, (await page.locator('article.comp').count()) > 0 && (await page.locator('.item.hit').count()) > 0);
  await page.fill('#q', 'devastador');
  ok(`[${label}] busca por traco`, (await page.locator('article.comp').count()) > 0, names.length + '');
  await page.fill('#q', 'zzzz');
  ok(`[${label}] busca sem resultado mostra aviso`, await page.locator('#empty').isVisible());
  await page.fill('#q', '');

  // ajuda com "?"
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('?');
  ok(`[${label}] "?" abre ajuda`, await page.locator('#help').evaluate((d) => d.open));
  await page.screenshot({ path: path.join(OUT, `${label}-4-ajuda.png`) });
  await page.keyboard.press('?');
  ok(`[${label}] "?" fecha ajuda`, !(await page.locator('#help').evaluate((d) => d.open)));

  // editar: add campeao + item alternativo
  await page.locator('article.comp').first().locator('button[aria-label^="Editar"]').click();
  ok(`[${label}] editor abre`, await page.locator('#editor').evaluate((d) => d.open));
  ok(`[${label}] checkbox e tabuleiro do editor coexistem`, (await page.locator('#ed-showboard').isVisible()) && (await page.locator('#ed-board.board').count()) === 1);
  await page.click('#ed-add-champ');
  await page.fill('#pk-q', 'leona');
  await page.locator('#pk-grid .pcell[data-id="DA_18_Leona"]').click();
  const row = page.locator('li.erow[data-champ="DA_18_Leona"]');
  ok(`[${label}] campeao adicionado no editor`, (await row.count()) === 1);
  await row.locator('button[data-act="add-alt"]').click();
  await page.fill('#pk-q', 'guinsoo');
  await page.locator('#pk-grid .pcell[data-id="DA_GuinsoosRageblade"]').click();
  ok(`[${label}] item alternativo adicionado`, (await row.locator('.chip.alt').count()) === 1);
  await row.locator('button[data-act="add-item"]').click();
  await page.fill('#pk-q', 'rabadon');
  await page.locator('#pk-grid .pcell[data-id="DA_RabadonsDeathcap"]').click();
  ok(`[${label}] item principal adicionado`, (await row.locator('.chip:not(.alt)').count()) === 1);
  // posicionar
  await row.locator('button.btn[aria-pressed]').click();
  await page.locator('#ed-board .hex[data-r="2"][data-c="4"]').click();
  ok(`[${label}] posicionamento no hex`, (await page.locator('#ed-board .hex.has[data-r="2"][data-c="4"]').count()) === 1);
  await page.screenshot({ path: path.join(OUT, `${label}-5-editor.png`) });
  await page.click('#ed-save');
  ok(`[${label}] editor fecha ao salvar`, !(await page.locator('#editor').evaluate((d) => d.open)));
  const firstUnits = await page.locator('article.comp').first().locator('.uname').allTextContents();
  ok(`[${label}] comp mostra Leona`, firstUnits.includes('Leona'));
  ok(`[${label}] item alternativo marcado na lista`, (await page.locator('article.comp').first().locator('img.item.alt').count()) === 1);

  // persistencia
  await page.reload();
  await page.waitForSelector('article.comp');
  const afterUnits = await page.locator('article.comp').first().locator('.uname').allTextContents();
  ok(`[${label}] persistencia apos recarregar`, afterUnits.includes('Leona') && (await page.locator('article.comp').first().locator('img.item.alt').count()) === 1);
  await page.locator('article.comp').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, `${label}-6-persistiu.png`) });

  // nova comp + duplicar + excluir
  await page.keyboard.press('n');
  ok(`[${label}] "n" abre nova comp`, await page.locator('#editor').evaluate((d) => d.open));
  await page.fill('#ed-nome', 'Teste QA');
  await page.fill('#ed-estilo', 'Fast 9');
  await page.click('#ed-add-champ');
  await page.fill('#pk-q', 'ahri');
  await page.locator('#pk-grid .pcell').first().click();
  await page.click('#ed-save');
  ok(`[${label}] nova comp criada no topo`, (await page.locator('article.comp h2').first().textContent()) === 'Teste QA' && (await page.locator('article.comp').count()) === 16);
  await page.locator('article.comp').first().locator('button[aria-label^="Duplicar"]').click();
  ok(`[${label}] duplicar`, (await page.locator('article.comp').count()) === 17 && (await page.locator('article.comp h2').nth(1).textContent()) === 'Teste QA (cópia)');
  await page.locator('article.comp').nth(1).locator('button[aria-label^="Excluir"]').click();
  ok(`[${label}] excluir pede confirmacao`, await page.locator('#ask').evaluate((d) => d.open));
  await page.locator('#ask-actions button', { hasText: 'Cancelar' }).click();
  ok(`[${label}] cancelar mantem comp`, (await page.locator('article.comp').count()) === 17);
  await page.locator('article.comp').nth(1).locator('button[aria-label^="Excluir"]').click();
  await page.locator('#ask-actions button', { hasText: 'Excluir' }).click();
  ok(`[${label}] excluir remove`, (await page.locator('article.comp').count()) === 16);

  // exportar / importar
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]);
  const file = path.join(OUT, `${label}-export.json`);
  await dl.saveAs(file);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(`[${label}] exportar gera JSON valido`, json.versao === 1 && json.comps.length === 16);
  await page.locator('article.comp').first().locator('button[aria-label^="Excluir"]').click();
  await page.locator('#ask-actions button', { hasText: 'Excluir' }).click();
  await page.setInputFiles('#file', file);
  await page.locator('#ask-actions button', { hasText: 'Substituir tudo' }).click();
  ok(`[${label}] importar restaura 16`, (await page.locator('article.comp').count()) === 16);
  fs.writeFileSync(path.join(OUT, 'ruim.json'), '{"comps":[{"nome":"<script>alert(1)</script>","main":[{"c":"NAO_EXISTE"}]}]}');
  await page.setInputFiles('#file', path.join(OUT, 'ruim.json'));
  await page.locator('#ask-actions button', { hasText: 'Adicionar' }).click();
  const xss = await page.evaluate(() => !document.querySelector('article.comp script') && [...document.querySelectorAll('article.comp h2')].some((h) => h.textContent.includes('<script>')));
  ok(`[${label}] import sanitiza (texto, sem executar)`, xss);
  fs.unlinkSync(path.join(OUT, 'ruim.json'));
  fs.unlinkSync(file);

  // restaurar originais
  await page.click('#btn-help');
  await page.click('#btn-reset');
  await page.locator('#ask-actions button', { hasText: 'Restaurar' }).click();
  ok(`[${label}] restaurar originais`, (await page.locator('article.comp').count()) === 15);

  const final = await imgReport(page);
  ok(`[${label}] imagens apos todos os fluxos`, final.bad.length === 0, `total=${final.total} falhas=${final.bad.length}`);
  ok(`[${label}] sem erros de console/rede`, errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close();
}

(async () => {
  await run('desktop', { width: 1440, height: 900 }, false);
  await run('mobile', { width: 390, height: 844 }, true);
  const fails = results.filter((r) => !r.pass);
  console.log(`\nTOTAL ${results.length} | FALHAS ${fails.length}`);
  fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})();
