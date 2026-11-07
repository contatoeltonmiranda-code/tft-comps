// QA v7 (layout 2 colunas, fases, navegacao, noticias, comps do video). Uso: servidor na raiz (python -m http.server 8765) e node qa/qa-v7.js
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const exe = process.env.LOCALAPPDATA.replace(/\\/g, '/') + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8765/';
const OUT = __dirname;
const results = [];
const ok = (name, cond, extra) => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'OK   ' : 'FALHA') + ' ' + name + (extra ? ' -> ' + extra : '')); };

const sb = { window: {} };
require('vm').runInNewContext(fs.readFileSync(path.join(__dirname, '../data/seed.js'), 'utf8'), sb);
const SEED = sb.window.TFT_SEED;
const nb = { window: {} };
require('vm').runInNewContext(fs.readFileSync(path.join(__dirname, '../data/noticias.js'), 'utf8'), nb);
const NEWS = nb.window.TFT_NOTICIAS;
const N = SEED.length;
const NOVOS = SEED.filter((c) => c.desde === 7).map((c) => c.nome);

async function imgReport(page) {
  return page.evaluate(async () => {
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    return { total: document.images.length, bad: [...document.images].filter((i) => !(i.naturalWidth > 0)).map((i) => i.getAttribute('src')) };
  });
}
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function run(label, viewport, mobile, cols) {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/kaspersky/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name, opts) => page.screenshot(Object.assign({ path: path.join(OUT, `v7-${label}-${name}.png`) }, opts || {}));

  /* ---------- comps ---------- */
  await page.goto(BASE + 'index.html');
  await page.waitForSelector('article.comp');
  ok(`[${label}] ${N} comps e meta "Set 18 · Selvas Encantadas"`, (await page.locator('article.comp').count()) === N && /Set 18 · Selvas Encantadas/.test(await page.locator('#meta').innerText()), await page.locator('#meta').innerText());
  ok(`[${label}] 5 comps novas do video depois das 3 fixadas`, JSON.stringify((await page.locator('article.comp h2').allTextContents()).slice(3, 8)) === JSON.stringify(NOVOS), (await page.locator('article.comp h2').allTextContents()).slice(0, 8).join(' | '));

  // navegacao
  const nav = await page.locator('.sitenav a').evaluateAll((as) => as.map((a) => ({ t: a.textContent.trim(), h: a.getAttribute('href'), cur: a.getAttribute('aria-current') })));
  ok(`[${label}] nav: 7 links, Comps atual, sem badge`, nav.length === 7 && nav[0].h === 'index.html' && nav[0].cur === 'page' && nav.map((n) => n.h).join() === 'index.html,plano.html,painel.html,posjogo.html,guia.html,estrategia.html,noticias.html', JSON.stringify(nav));

  // 2 colunas
  const geo = await page.evaluate(() => {
    const c = [...document.querySelectorAll('article.comp')].slice(0, 2).map((e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top + scrollY), w: Math.round(r.width), r: Math.round(r.right) }; });
    return { c, vw: innerWidth };
  });
  const lado = Math.abs(geo.c[0].t - geo.c[1].t) <= 2 && geo.c[1].l > geo.c[0].r - 2;
  ok(`[${label}] ${cols === 2 ? '2 comps lado a lado' : '1 coluna (empilhado)'}`, cols === 2 ? lado : !lado && geo.c[0].l === geo.c[1].l, JSON.stringify(geo));
  ok(`[${label}] sem scroll horizontal na lista`, (await overflowX(page)) <= 0, 'overflow=' + (await overflowX(page)));
  await shot('1-comps');

  // fases (comp 1 = Enfeiticador 6, fonte; seed-21 = derivado)
  const c1 = page.locator('article.comp').first();
  const mini = await c1.locator('.phase.inicio .mini').count();
  const meio = await c1.locator('.phase.meio .mini').count();
  const exp = SEED[0].fases;
  ok(`[${label}] fases: Início/Meio/Fim com rótulo e unidades`, mini === exp.inicio.length && meio === exp.meio.length && (await c1.locator('.fimhead .plabel b').textContent()) === 'Fim' && (await c1.locator('.phase.inicio .plabel b').textContent()) === 'Início' && (await c1.locator('.phase.meio .plabel b').textContent()) === 'Meio', `inicio=${mini} meio=${meio}`);
  const tagF = await c1.locator('.porigem .otag').textContent();
  ok(`[${label}] fases: origem "fonte" com link https`, tagF === 'fonte' && /^https:\/\/mobalytics\.gg\//.test((await c1.locator('.porigem a').getAttribute('href')) || ''), tagF);
  const c21 = page.locator('article.comp', { has: page.locator('h2', { hasText: 'Emanador Ahri' }) });
  ok(`[${label}] fases: origem "derivado" sem link`, (await c21.locator('.porigem .otag').textContent()) === 'derivado' && (await c21.locator('.porigem a').count()) === 0);
  if (!mobile) await c1.screenshot({ path: path.join(OUT, `v7-${label}-2-fases.png`) });

  // checks no Fim + espelho nas fases
  const firstChamp = SEED[0].main[0].c;
  const inPhase = await c1.locator(`.mini[data-c="${firstChamp}"]`).count();
  await c1.locator('.groups .unit').first().locator('button.pick').click();
  ok(`[${label}] check no Fim: contador 1/${SEED[0].main.length}`, (await c1.locator('.pcount').innerText()).startsWith('1/'), await c1.locator('.pcount').innerText());
  if (inPhase) ok(`[${label}] check no Fim marca o mesmo campeão nas fases`, (await c1.locator(`.mini[data-c="${firstChamp}"].picked`).count()) === inPhase, 'minis=' + inPhase);
  ok(`[${label}] check habilita Limpar checks (topo)`, !(await page.locator('#btn-clear-all').isDisabled()));
  await c1.locator('[data-act="clear-comp"]').click();
  ok(`[${label}] limpar checks da comp zera contador e fases`, (await c1.locator('.pcount').innerText()).startsWith('0/') && (await c1.locator('.mini.picked').count()) === 0);

  // busca da comp (Fim) segue funcionando
  await c1.locator('input.cq').fill('ornn');
  ok(`[${label}] busca dentro da comp filtra o Fim`, (await c1.locator('.groups .unit').count()) === 1);
  await c1.locator('input.cq').fill('');

  // busca global
  await page.fill('#q', 'yunara');
  const hitCards = await page.locator('article.comp').count();
  ok(`[${label}] busca global "yunara"`, hitCards >= 2 && hitCards < N && /de/.test(await page.locator('#count').innerText().catch(() => 'de')), 'n=' + hitCards);
  ok(`[${label}] busca destaca campeão nas fases`, (await page.locator('.mini.hit').count()) > 0);
  await page.fill('#q', '');
  ok(`[${label}] busca limpa volta a ${N}`, (await page.locator('article.comp').count()) === N);

  // comp do video: Solar Yunara (tabuleiro aberto, estrelas, itens, dicas)
  const sy = page.locator('article.comp', { has: page.locator('h2', { hasText: 'Solar Yunara Karma' }) });
  ok(`[${label}] Solar Yunara: tabuleiro aberto com 8 unidades`, (await sy.locator('.board .hex.has').count()) === 8);
  ok(`[${label}] Solar Yunara: estilo, nota e fonte com minuto`, (await sy.locator('.style').innerText()) === 'Slowroll Nvl 6' && /0:39/.test(await sy.locator('.src').last().innerText()) && (await sy.locator('.note').count()) === 1);
  ok(`[${label}] Solar Yunara: 5 unidades 3★ e itens`, (await sy.locator('.groups .stars.s3').count()) === 5 && (await sy.locator('.groups .items img').count()) >= 8);
  const bx = await sy.locator('.board').boundingBox();
  const cx = await sy.boundingBox();
  ok(`[${label}] tabuleiro cabe no card`, bx.x + bx.width <= cx.x + cx.width + 1, `board.r=${Math.round(bx.x + bx.width)} card.r=${Math.round(cx.x + cx.width)}`);
  await sy.locator('details.dicas summary').click();
  const dl = await sy.locator('details.dicas li').count();
  const href = await sy.locator('details.dicas a').getAttribute('href');
  ok(`[${label}] dicas abrem (${dl} linhas) e link do vídeo no minuto`, dl >= 5 && /^https:\/\/youtu\.be\/shtFyRruAHM\?t=39$/.test(href) && (await sy.locator('details.dicas a').getAttribute('rel')).includes('noopener'), href);
  await page.fill('#q', 'karma');
  ok(`[${label}] dicas continuam abertas depois de re-render`, await page.locator('article.comp', { has: page.locator('h2', { hasText: 'Solar Yunara Karma' }) }).locator('details.dicas').evaluate((d) => d.open));
  await page.fill('#q', '');
  await sy.scrollIntoViewIfNeeded();
  if (!mobile) await sy.screenshot({ path: path.join(OUT, `v7-${label}-3-comp-video.png`) });
  else await shot('3-comp-video', { fullPage: false });

  // comps existentes do video: dicas + posicoes novas
  const rb = page.locator('article.comp', { has: page.locator('h2', { hasText: 'Fera do Rift Rubrivira Dragão Ancião' }) });
  ok(`[${label}] comp existente (Rubrivira) recebeu dicas e posições, sem duplicar`, (await rb.locator('details.dicas').count()) === 1 && (await rb.locator('button[aria-label="Mostrar tabuleiro"]').count()) === 1 && (await page.locator('article.comp h2', { hasText: 'Fera do Rift Rubrivira Dragão Ancião' }).count()) === 1);

  // edicao
  await c1.locator('button[aria-label^="Editar"]').click();
  ok(`[${label}] editor abre`, await page.locator('#editor').evaluate((d) => d.open));
  await page.click('#ed-cancel');
  await page.waitForFunction(() => !document.querySelector('#editor').open);
  // atalhos
  await page.keyboard.press('/');
  ok(`[${label}] atalho "/" foca a busca`, await page.evaluate(() => document.activeElement.id === 'q'));
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('?');
  ok(`[${label}] atalho "?" abre ajuda`, await page.locator('#help').evaluate((d) => d.open));
  await page.keyboard.press('Escape');
  await page.keyboard.press('n');
  ok(`[${label}] atalho "N" abre nova comp`, await page.locator('#editor').evaluate((d) => d.open));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  if (await page.locator('#ask').evaluate((d) => d.open)) await page.locator('#ask-actions button', { hasText: /Descartar|Continuar/ }).first().click();
  await page.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); });
  const ir = await imgReport(page);
  ok(`[${label}] comps: sem imagem quebrada`, ir.bad.length === 0, `${ir.total} imgs; quebradas: ${ir.bad.slice(0, 3).join(',')}`);

  /* ---------- noticias ---------- */
  await page.goto(BASE + 'noticias.html');
  await page.waitForSelector('.ncard');
  const navN = await page.locator('.sitenav a[aria-current="page"]').innerText();
  ok(`[${label}] noticias: nav marca Notícias`, navN.trim() === 'Notícias');
  ok(`[${label}] noticias: resumo do meta no topo (18.6, 3 linhas, fonte)`, (await page.locator('#resumo h2').innerText()).includes('18.6') && (await page.locator('#resumo li').count()) === 3 && (await page.locator('#resumo a').getAttribute('href')).startsWith('https://teamfighttactics.leagueoflegends.com/'));
  ok(`[${label}] noticias: data da última atualização`, /^\d\d\/\d\d\/\d{4}$/.test(await page.locator('#atualizado').innerText()), await page.locator('#atualizado').innerText());
  ok(`[${label}] noticias: ${NEWS.length} cards, todos com fonte e ícone/glifo`, (await page.locator('.ncard').count()) === NEWS.length && (await page.locator('.ncard .nsrc[href^="https://"]').count()) === NEWS.length && (await page.locator('.ncard .nicon img, .ncard .nicon svg').count()) === NEWS.length);
  ok(`[${label}] noticias: ícone de campeão/item/traço quando há id`, (await page.locator('.ncard .nicon img').count()) >= 20);
  await shot('4-noticias');
  const tipos = await page.locator('#f-tipo button').allInnerTexts();
  ok(`[${label}] noticias: filtros por tipo`, tipos.some((t) => /^Buff/.test(t)) && tipos.some((t) => /^Nerf/.test(t)) && tipos.some((t) => /^Item/.test(t)) && tipos.some((t) => /^Sistema/.test(t)), tipos.join(' | '));
  await page.locator('#f-tipo button', { hasText: /^Nerf/ }).click();
  const nerfs = NEWS.filter((n) => n.tipo === 'nerf').length;
  ok(`[${label}] noticias: filtro Nerf mostra só nerfs (${nerfs})`, (await page.locator('.ncard').count()) === nerfs && (await page.locator('.ncard:not(.t-nerf)').count()) === 0 && (await page.locator('#f-tipo button[aria-pressed="true"]').innerText()).startsWith('Nerf'));
  await page.locator('#f-patch button', { hasText: '18.5' }).click();
  const n185 = NEWS.filter((n) => n.tipo === 'nerf' && n.patch === '18.5').length;
  ok(`[${label}] noticias: Nerf + patch 18.5 combinados (${n185})`, (await page.locator('.ncard').count()) === n185 && (await page.locator('.ncard .nmeta', { hasText: 'Patch 18.6' }).count()) === 0);
  await shot('5-noticias-filtro');
  await page.locator('#f-tipo button', { hasText: /^Todos/ }).click();
  await page.locator('#f-patch button', { hasText: '18.6' }).click();
  ok(`[${label}] noticias: patch 18.6 sozinho`, (await page.locator('.ncard').count()) === NEWS.filter((n) => n.patch === '18.6').length);
  await page.locator('#f-patch button', { hasText: 'Todos' }).click();
  ok(`[${label}] noticias: voltar a Todos`, (await page.locator('.ncard').count()) === NEWS.length);
  const irN = await imgReport(page);
  ok(`[${label}] noticias: sem imagem quebrada`, irN.bad.length === 0, `${irN.total} imgs; ${irN.bad.slice(0, 3).join(',')}`);
  ok(`[${label}] noticias: sem scroll horizontal`, (await overflowX(page)) <= 0, 'overflow=' + (await overflowX(page)));

  /* ---------- guia (cobertura completa em qa/qa-guia.js) ---------- */
  const resp = await page.goto(BASE + 'guia.html');
  await page.waitForSelector('.guia h2');
  ok(`[${label}] guia.html responde 200 com as 13 seções e Guia do Jogo ativo`, resp.status() === 200 && (await page.locator('.guia h2').count()) === 13 && (await page.locator('.sitenav a[aria-current="page"]').innerText()).includes('Guia do Jogo'));
  await shot('6-guia');
  ok(`[${label}] guia: sem scroll horizontal`, (await overflowX(page)) <= 0);
  // navegacao por clique
  await page.click('.sitenav a[href="noticias.html"]');
  await page.waitForSelector('.ncard');
  await page.click('.sitenav a[href="index.html"]');
  await page.waitForSelector('article.comp');
  ok(`[${label}] navegação por clique Guia > Notícias > Comps`, page.url().endsWith('index.html'));

  ok(`[${label}] sem erros de console em nenhuma página`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}

(async () => {
  await run('d1440', { width: 1440, height: 900 }, false, 2);
  await run('d1100', { width: 1100, height: 800 }, false, 2);
  await run('d1099', { width: 1099, height: 800 }, false, 1);
  await run('m390', { width: 390, height: 844 }, true, 1);
  const fails = results.filter((r) => !r.pass);
  console.log(`\nTOTAL ${results.length} | FALHAS ${fails.length}`);
  fs.writeFileSync(path.join(OUT, 'resultado-v7.json'), JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})();
