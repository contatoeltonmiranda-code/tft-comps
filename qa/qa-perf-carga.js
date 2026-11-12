// QA de carga (index, posjogo, noticias): lazy, hidratacao dos cards, busca multi-campeao com debounce, checks Inicio/Meio.
// Uso: node qa/qa-perf-carga.js [raiz-do-site]   (sobe o proprio servidor estatico em porta livre e fecha no fim)
// Env: QA_LABEL (prefixo dos prints), QA_FULL=<pasta> (salva tambem a pagina inteira, com todas as imagens carregadas, para diff de pixel).
// A porta 17870 (helper local do Pos-jogo) e bloqueada no navegador: o QA nunca fala com ela.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const EXE = process.env.QA_EXE || 'C:/Users/elton/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const LABEL = process.env.QA_LABEL || 'perf';
const FULL = process.env.QA_FULL ? path.resolve(process.env.QA_FULL) : null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});

const falhas = [];
const ok = (cond, msg, extra) => { console.log((cond ? 'OK   ' : 'FALHA ') + msg + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); if (!cond) falhas.push(msg); };

async function carregarTudo(page) {
  // imagens lazy so carregam perto da tela: forca eager e rola a pagina para todos os cards hidratarem
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    window.scrollTo(0, 0);
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

async function pagina(ctx, base, arq, esperar) {
  const page = await ctx.newPage();
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_BLOCKED/.test(m.text())) erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(e.message));
  await page.route(/127\.0\.0\.1:17870/, (r) => r.abort());
  await page.goto(base + '/' + arq, { waitUntil: 'load' });
  await page.waitForSelector(esperar);
  await page.waitForTimeout(400);
  return { page, erros };
}

async function rodar(browser, base, nome, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  const tag = `[${nome}] `;
  const png = (p, n) => path.join(__dirname, `${LABEL}-${nome}-${n}.png`);
  const full = (n) => path.join(FULL, `${nome}-${n}.png`);

  // ---------------------------------------------------------------- index
  {
    const { page, erros } = await pagina(ctx, base, 'index.html', 'article.comp');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('article.comp');
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const imgs = [...document.images];
      return {
        comps: document.querySelectorAll('article.comp').length,
        imgs: imgs.length,
        lazy: imgs.filter((i) => i.loading === 'lazy').length,
        semDecoding: imgs.filter((i) => i.decoding !== 'async').length,
        semTamanho: imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length,
        carregadasNoPrimeiroPaint: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
        nos: document.querySelectorAll('*').length,
        pendentes: document.querySelectorAll('article.comp[data-pend]').length,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    ok(info.comps === 34, tag + 'index: 34 comps', info.comps);
    ok(info.lazy === info.imgs && info.imgs > 100, tag + 'index: toda <img> e lazy', { imgs: info.imgs, lazy: info.lazy });
    ok(info.semDecoding === 0 && info.semTamanho === 0, tag + 'index: decoding async e width/height em toda <img>');
    ok(info.carregadasNoPrimeiroPaint < 300, tag + 'index: imagens carregadas no primeiro paint (antes: 1388)', info.carregadasNoPrimeiroPaint);
    ok(info.pendentes >= 20 && info.pendentes < 34 && info.nos < 4500, tag + 'index: card longe da tela nasce pendente (so cabecalho) e o DOM inicial e enxuto', { pendentes: info.pendentes, nos: info.nos });
    ok(info.overflowX <= 0, tag + 'index: sem rolagem horizontal', info.overflowX);
    await page.screenshot({ path: png(nome, 'index-topo') });

    // rolar ate o fim: toda imagem que entrou na tela carrega, nenhuma quebrada
    const rolagem = await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
      await new Promise((r) => setTimeout(r, 600));
      const vis = [...document.images].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; });
      return { visiveis: vis.length, quebradasVisiveis: vis.filter((i) => !(i.complete && i.naturalWidth > 0)).length, depois: [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length };
    });
    ok(rolagem.visiveis > 0 && rolagem.quebradasVisiveis === 0, tag + 'index: apos rolar ate o fim, as imagens visiveis carregaram', rolagem);
    await page.evaluate(() => window.scrollTo(0, 0));

    // card longe da tela hidrata ao chegar perto e funciona igual (check no Fim, busca interna, tabuleiro)
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('article.comp');
    const longe = page.locator('article.comp').nth(25);
    ok(await longe.getAttribute('data-pend') !== null, tag + 'card 26 recem-carregado esta pendente');
    await longe.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !document.querySelectorAll('article.comp')[25].hasAttribute('data-pend'));
    const corpo = await longe.evaluate((c) => ({ minis: c.querySelectorAll('.mini').length, unidades: c.querySelectorAll('.unit').length, cq: !!c.querySelector('.cq') }));
    ok(corpo.unidades > 0 && corpo.cq, tag + 'card 26 hidratou com campeoes e busca interna', corpo);
    const nomeUnidade = await longe.locator('.unit .uname').first().textContent();
    await longe.locator('.cq').fill(nomeUnidade.slice(0, 4));
    const filtrado = await longe.evaluate((c) => c.querySelectorAll('.unit').length);
    ok(filtrado >= 1 && filtrado <= corpo.unidades, tag + 'busca dentro do card hidratado filtra os campeoes', { de: corpo.unidades, para: filtrado });
    await longe.locator('.cq').fill('');
    const pick = longe.locator('.unit .pick').first();
    await pick.click();
    ok(await pick.getAttribute('aria-pressed') === 'true', tag + 'check no board final de card hidratado');
    await pick.click();
    // Ctrl+F e impressao hidratam tudo
    await page.keyboard.press('Control+f');
    ok(await page.evaluate(() => document.querySelectorAll('article.comp[data-pend]').length) === 0, tag + 'Ctrl+F hidrata todos os cards (busca do navegador acha tudo)');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('article.comp');
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    const imprimir = await page.evaluate(() => ({ pend: document.querySelectorAll('article.comp[data-pend]').length, unidades: document.querySelectorAll('article.comp .unit').length }));
    ok(imprimir.pend === 0 && imprimir.unidades >= 250, tag + 'impressao hidrata todos os cards', imprimir);
    // tabuleiro de um card
    const comBoard = page.locator('article.comp:has(button[aria-label="Mostrar tabuleiro"])').first();
    const id = await comBoard.getAttribute('data-id');
    const hexAntes = await comBoard.locator('.board .hex').count();
    await comBoard.locator('button[aria-label="Mostrar tabuleiro"]').click();
    const hexDepois = await page.locator(`article.comp[data-id="${id}"] .board .hex`).count();
    ok((hexAntes === 0 && hexDepois === 28) || (hexAntes === 28 && hexDepois === 0), tag + 'botao Tabuleiro alterna o board hex (28 hexagonos)', { hexAntes, hexDepois });
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('article.comp');

    // busca multi-campeao AND com debounce
    await page.focus('#q');
    await page.keyboard.type('karma, ahri', { delay: 40 });
    const antes = await page.evaluate(() => document.querySelectorAll('article.comp').length);
    ok(antes === 34, tag + 'busca: durante a digitacao a lista nao foi redesenhada a cada tecla', antes);
    await page.waitForFunction(() => document.querySelector('#count').textContent === '1 de 34');
    const res = await page.evaluate(() => ({ n: document.querySelectorAll('article.comp').length, nome: (document.querySelector('article.comp h2') || {}).textContent, chips: document.querySelectorAll('#chips .sq-chip').length, tem: !!document.querySelector('.mscore.full') }));
    ok(res.n === 1 && res.nome === 'Emanador Ahri', tag + 'busca "karma, ahri" mostra so Emanador Ahri', res);
    ok(res.chips === 2 && res.tem, tag + 'busca: 2 chips e selo "Tem todos"');
    await page.screenshot({ path: png(nome, 'index-busca') });

    // check no Inicio e no Meio (compartilhado com o Fim)
    const card = page.locator('article.comp').first();
    const fases = await card.evaluate((c) => ({ inicio: c.querySelectorAll('.phase.inicio .mini').length, meio: c.querySelectorAll('.phase.meio .mini').length }));
    ok(fases.inicio > 0 && fases.meio > 0, tag + 'card tem Inicio e Meio', fases);
    for (const fase of ['inicio', 'meio']) {
      const mini = card.locator(`.phase.${fase} .mini`).first();
      const champ = await mini.getAttribute('data-c');
      const btn = mini.locator('.pick');
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      const marcado = await card.evaluate((c, id) => [...c.querySelectorAll(`.mini[data-c="${id}"]`)].every((m) => m.classList.contains('picked') && m.querySelector('.pick').getAttribute('aria-pressed') === 'true'), champ);
      const salvo = await page.evaluate((id) => JSON.stringify(JSON.parse(localStorage.getItem('tft-comps:picks:v1')).checks).includes(id), champ);
      const contador = await card.locator('.pcount').textContent();
      ok(marcado && salvo && /^[1-9]\d*\/\d+ pegos$/.test(contador), tag + `check no ${fase}: marca, grava e atualiza o contador`, { champ, contador });
      await btn.click();
      const desmarcado = await card.evaluate((c, id) => [...c.querySelectorAll(`.mini[data-c="${id}"]`)].every((m) => !m.classList.contains('picked')), champ);
      ok(desmarcado, tag + `check no ${fase}: desmarca`);
    }
    await page.fill('#q', '');
    await page.waitForFunction(() => document.querySelectorAll('article.comp').length === 34);
    ok(true, tag + 'busca limpa volta as 34 comps');
    // botao Limpar (render direto) cancela a pendencia do debounce
    await page.fill('#q', 'karma');
    await page.click('#btn-clear');
    await page.waitForTimeout(300);
    const aposLimpar = await page.evaluate(() => ({ n: document.querySelectorAll('article.comp').length, q: document.querySelector('#q').value }));
    ok(aposLimpar.n === 34 && aposLimpar.q === '', tag + 'Limpar: lista completa e sem render pendente sobrescrevendo', aposLimpar);
    ok(erros.length === 0, tag + 'index: sem erros no console', erros);
    if (FULL) { await carregarTudo(page); await page.screenshot({ path: full('index'), fullPage: true }); }
    await page.close();
  }

  // ---------------------------------------------------------------- posjogo e noticias
  for (const [arq, sel, imgSel] of [['posjogo.html', '.pj-partida', '.pj-partida img'], ['noticias.html', '.ncard', '.ncard img']]) {
    const { page, erros } = await pagina(ctx, base, arq, sel);
    const info = await page.evaluate((s) => {
      const imgs = [...document.querySelectorAll(s)];
      return { imgs: imgs.length, lazy: imgs.filter((i) => i.loading === 'lazy').length, semTamanho: imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length, overflowX: document.documentElement.scrollWidth - window.innerWidth, itens: document.querySelectorAll('.pj-partida, .ncard').length };
    }, imgSel);
    ok(info.imgs > 0 && info.lazy === info.imgs && info.semTamanho === 0, tag + `${arq}: toda <img> lazy com width/height`, info);
    ok(info.overflowX <= 0, tag + `${arq}: sem rolagem horizontal`, info.overflowX);
    ok(erros.length === 0, tag + `${arq}: sem erros no console`, erros);
    await page.screenshot({ path: png(nome, arq.replace('.html', '-topo')) });
    if (FULL) { await carregarTudo(page); await page.screenshot({ path: full(arq.replace('.html', '')), fullPage: true }); }
    await page.close();
  }
  await ctx.close();
}

(async () => {
  if (FULL) fs.mkdirSync(FULL, { recursive: true });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    await rodar(browser, base, 'd1440', { width: 1440, height: 900 }, false);
    await rodar(browser, base, 'm390', { width: 390, height: 844 }, true);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTudo OK');
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
