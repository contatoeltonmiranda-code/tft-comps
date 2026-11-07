// QA da pagina Guia do Jogo (1440 e 390). Uso: servidor na raiz (python -m http.server 8765) e node qa/qa-guia.js
// Um unico Chromium, dois contextos em sequencia.
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const exe = process.env.LOCALAPPDATA.replace(/\\/g, '/') + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8765/';
const OUT = __dirname;
const results = [];
const ok = (name, cond, extra) => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'OK   ' : 'FALHA') + ' ' + name + (extra ? ' -> ' + extra : '')); };
const md = fs.readFileSync(path.join(__dirname, '../data/guia-do-jogo.md'), 'utf8');
const N_TABLES = md.split('\n').filter((l, i, a) => /^\|[\s|:-]+\|\s*$/.test(l) && /^\|/.test(a[i - 1])).length;

async function run(browser, label, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/kaspersky/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed ' + r.url()));
  const shot = (name, opts) => page.screenshot(Object.assign({ path: path.join(OUT, `guia-${label}-${name}.png`) }, opts || {}));
  const overflowX = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const h2top = (id) => page.evaluate((i) => Math.round(document.getElementById(i).getBoundingClientRect().top), id);

  const resp = await page.goto(BASE + 'guia.html');
  await page.waitForSelector('.guia h2');
  await page.evaluate(() => document.fonts.ready);
  ok(`[${label}] guia.html responde 200`, resp.status() === 200);
  ok(`[${label}] nav: Guia do Jogo ativo e sem badge "Em breve"`, (await page.locator('.sitenav a[aria-current="page"]').innerText()).trim() === 'Guia do Jogo' && (await page.locator('.soon').count()) === 0 && !/Em breve/.test(await page.locator('body').innerText()));
  ok(`[${label}] h1 do guia`, (await page.locator('h1').innerText()) === 'Guia do Jogo — TFT Set 18');
  ok(`[${label}] 13 seções e ${N_TABLES} tabelas`, (await page.locator('.guia h2').count()) === 13 && (await page.locator('.guia table').count()) === N_TABLES, `tabelas md=${N_TABLES}`);
  ok(`[${label}] sem scroll horizontal da página`, (await overflowX()) <= 0, 'overflow=' + (await overflowX()));
  ok(`[${label}] acentos preservados no texto`, /1\. Glossário rápido/.test(await page.locator('.guia').innerText()) && /Estágio/.test(await page.locator('.guia').innerText()) && /Notícias/.test(await page.locator('.sitenav').innerText()));
  await shot('1-topo');

  /* ---------- indice ---------- */
  const tocVisible = await page.locator('#toc a:visible').count();
  const summaryVisible = await page.locator('#toc summary').isVisible();
  if (!mobile) {
    ok(`[${label}] índice lateral aberto com 13 links, sem cabeçalho recolhível`, tocVisible === 13 && !summaryVisible, `visiveis=${tocVisible}`);
    const g = await page.evaluate(() => { const t = document.getElementById('toc').getBoundingClientRect(); const a = document.getElementById('guia').getBoundingClientRect(); return { tr: Math.round(t.right), al: Math.round(a.left) }; });
    ok(`[${label}] índice ao lado do texto (2 colunas)`, g.tr <= g.al, JSON.stringify(g));
    await page.evaluate(() => window.scrollTo(0, 2600));
    await page.waitForTimeout(150);
    const tb = await page.locator('#toc').boundingBox();
    ok(`[${label}] índice fixo (sticky) ao rolar`, tb.y >= 60 && tb.y <= 100 && tb.y + tb.height <= viewport.height, `y=${Math.round(tb.y)} h=${Math.round(tb.height)}`);
    const spy = await page.locator('#toc a[aria-current]').count();
    ok(`[${label}] scrollspy marca 1 seção`, spy === 1, await page.locator('#toc a[aria-current]').innerText());
    await shot('2-indice-fixo');
  } else {
    ok(`[${label}] índice recolhido no topo (cabeçalho visível, links ocultos)`, summaryVisible && tocVisible === 0 && !(await page.locator('#toc-d').evaluate((d) => d.open)), `links=${tocVisible}`);
    const sb = await page.locator('#toc summary').boundingBox();
    ok(`[${label}] alvo do índice >= 44px`, sb.height >= 44, 'h=' + Math.round(sb.height));
    await page.locator('#toc summary').click();
    ok(`[${label}] toque no Índice abre os 13 links`, (await page.locator('#toc a:visible').count()) === 13);
    const lh = await page.locator('#toc a').first().boundingBox();
    ok(`[${label}] links do índice >= 44px de altura`, lh.height >= 44, 'h=' + Math.round(lh.height));
    await shot('2-indice-aberto');
  }

  /* ---------- ancoras ---------- */
  await page.evaluate(() => window.scrollTo(0, 0));
  const alvo = '5. Quando rolar e quanto';
  const link = page.locator('#toc a', { hasText: alvo });
  if (mobile) await page.locator('#toc-d').evaluate((d) => { d.open = true; });
  await link.click();
  await page.waitForTimeout(250);
  const href = await link.getAttribute('href');
  const top = await h2top(href.slice(1));
  const barB = await page.evaluate(() => Math.round(document.querySelector('.searchbar').getBoundingClientRect().bottom));
  ok(`[${label}] âncora ${href}: URL e título logo abaixo da busca fixa`, page.url().endsWith(href) && top >= barB - 2 && top < barB + 120, `h2.top=${top} barra.bottom=${barB}`);
  ok(`[${label}] âncora: índice ${mobile ? 'fecha' : 'marca a seção'}`, mobile ? !(await page.locator('#toc-d').evaluate((d) => d.open)) : (await page.locator('#toc a[aria-current]').innerText()).startsWith('5.'));
  ok(`[${label}] sem scroll horizontal após âncora`, (await overflowX()) <= 0);
  await shot('3-ancora');
  // todas as ancoras resolvem
  const todas = await page.evaluate(() => [...document.querySelectorAll('#toc a')].map((a) => !!document.getElementById(a.getAttribute('href').slice(1))));
  ok(`[${label}] 13 âncoras do índice têm alvo`, todas.length === 13 && todas.every(Boolean));
  // ultima secao
  if (mobile) await page.locator('#toc-d').evaluate((d) => { d.open = true; });
  await page.locator('#toc a', { hasText: 'Notas sobre as fontes' }).click();
  await page.waitForTimeout(250);
  ok(`[${label}] última âncora (Notas sobre as fontes) visível`, (await h2top('notas-sobre-as-fontes')) < viewport.height - 40);

  /* ---------- tabelas ---------- */
  const tb = await page.evaluate(() => [...document.querySelectorAll('.tbl')].map((t) => ({ sw: t.scrollWidth, cw: t.clientWidth, tw: t.querySelector('table').getBoundingClientRect().width })));
  const scrollables = tb.filter((t) => t.sw > t.cw + 1).length;
  if (mobile) {
    ok(`[${label}] tabelas largas rolam dentro do contêiner (${scrollables}), página não`, scrollables >= 4 && (await overflowX()) <= 0, `rolantes=${scrollables}/${tb.length}`);
    const fora = await page.evaluate(() => [...document.querySelectorAll('.guia *, .toc *, .gsearch *, .top *, .sitenav *')].filter((e) => !e.closest('.tbl') && !e.closest('.sitenav-in') && e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => e.tagName + '.' + e.className));
    ok(`[${label}] nada fora da tela (exceto dentro das tabelas)`, fora.length === 0, fora.slice(0, 3).join(','));
  } else {
    ok(`[${label}] tabelas cabem no desktop sem rolar`, scrollables === 0, `rolantes=${scrollables}`);
  }
  // tabela larga (estilos de jogo): rolar dentro dela
  const estilos = page.locator('#estilos-de-jogo ~ .tbl').first();
  await estilos.scrollIntoViewIfNeeded();
  const sx = await estilos.evaluate((t) => { t.scrollLeft = 200; return t.scrollLeft; });
  ok(`[${label}] tabela Estilos de jogo: scroll interno ${mobile ? '> 0' : 'n/a (cabe)'}`, mobile ? sx > 0 && (await overflowX()) <= 0 && (await page.evaluate(() => scrollX)) === 0 : true, 'scrollLeft=' + sx);
  ok(`[${label}] tabela focável por teclado com nome`, (await estilos.getAttribute('tabindex')) === '0' && /^Tabela: /.test(await estilos.getAttribute('aria-label')));
  await estilos.scrollIntoViewIfNeeded();
  await shot('4-tabela');
  const first = await page.locator('.tbl thead th').first().evaluate((e) => getComputedStyle(e).textTransform);
  ok(`[${label}] cabeçalho de tabela estilizado`, first === 'uppercase');

  /* ---------- notas ---------- */
  const nota = page.locator('.nota').nth(2);
  await nota.scrollIntoViewIfNeeded();
  const ns = await nota.evaluate((e) => { const c = getComputedStyle(e); return { b: c.borderLeftWidth, bg: c.backgroundColor }; });
  ok(`[${label}] notas de divergência com estilo discreto (borda + fundo)`, ns.b === '3px' && ns.bg !== 'rgba(0, 0, 0, 0)', JSON.stringify(ns));
  ok(`[${label}] marcadores "(Google, não confirmado)" destacados`, (await page.locator('.nc').count()) >= 2);
  await shot('5-notas');

  /* ---------- busca ---------- */
  await page.evaluate(() => window.scrollTo(0, 0));
  const antes = await page.locator('.guia').innerText();
  await page.fill('#gq', 'juros');
  await page.waitForTimeout(300);
  const nm = await page.locator('mark.hit').count();
  const secVis = await page.locator('.gsec:not([hidden])').count();
  const tocVis = await page.locator('#toc li:not([hidden])').count();
  ok(`[${label}] busca "juros": destaca ${nm} trechos e esconde seções sem resultado`, nm >= 8 && secVis < 14 && secVis >= 2, `marks=${nm} secoes=${secVis}`);
  ok(`[${label}] busca: índice mostra só seções com resultado`, tocVis === (await page.locator('.gsec:not([hidden]):not(.gintro) h2').count()), `toc=${tocVis}`);
  ok(`[${label}] busca: contador informa ocorrências e seções`, /^\d+ ocorrências? em \d+ seç(ão|ões)$/.test(await page.locator('#gcount').innerText()), await page.locator('#gcount').innerText());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const curIn = await page.locator('mark.hit.cur').evaluate((m) => { const r = m.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  ok(`[${label}] Enter vai ao 1º resultado, dentro da tela`, curIn);
  await shot('6-busca');
  await page.keyboard.press('Enter');
  ok(`[${label}] Enter de novo avança para o próximo`, (await page.locator('mark.hit.cur').count()) === 1);
  // sem acento
  await page.fill('#gq', 'nivel');
  await page.waitForTimeout(300);
  const semAcento = await page.locator('mark.hit').count();
  await page.fill('#gq', 'nível');
  await page.waitForTimeout(300);
  ok(`[${label}] busca ignora acento e caixa ("nivel" = "nível")`, semAcento > 5 && semAcento === (await page.locator('mark.hit').count()), `${semAcento}`);
  await page.fill('#gq', 'FAST 8');
  await page.waitForTimeout(300);
  ok(`[${label}] busca "FAST 8" (frase, caixa alta)`, (await page.locator('mark.hit').count()) >= 5);
  await page.fill('#gq', 'zzqqxx');
  await page.waitForTimeout(300);
  ok(`[${label}] busca sem resultado: mensagem e nada visível`, (await page.locator('#gempty').isVisible()) && (await page.locator('.gsec:not([hidden])').count()) === 0 && (await page.locator('#gcount').innerText()) === 'Nenhum resultado');
  await shot('7-busca-vazia');
  await page.fill('#gq', '<img src=x onerror=alert(1)>');
  await page.waitForTimeout(300);
  ok(`[${label}] busca com HTML não injeta nada`, (await page.locator('.guia img').count()) === 0);
  await page.fill('#gq', 'juros');
  await page.waitForTimeout(300);
  await page.locator('#gclear').click();
  const depois = await page.locator('.guia').innerText();
  ok(`[${label}] Limpar restaura o texto idêntico, sem marcas e com tudo visível`, depois === antes && (await page.locator('mark').count()) === 0 && (await page.locator('.gsec[hidden]').count()) === 0 && (await page.locator('#toc li[hidden]').count()) === 0);
  await page.fill('#gq', 'juros');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  ok(`[${label}] Esc limpa a busca`, (await page.inputValue('#gq')) === '' && (await page.locator('mark').count()) === 0);
  ok(`[${label}] sem scroll horizontal ao final`, (await overflowX()) <= 0);

  /* ---------- navegacao entre paginas ---------- */
  await page.click('.sitenav a[href="noticias.html"]');
  await page.waitForSelector('.ncard');
  ok(`[${label}] Notícias sem badge e Guia navegável`, (await page.locator('.soon').count()) === 0);
  await page.click('.sitenav a[href="guia.html"]');
  await page.waitForSelector('.guia h2');
  await page.click('.sitenav a[href="index.html"]');
  await page.waitForSelector('article.comp');
  ok(`[${label}] navegação Notícias > Guia > Comps; Comps sem badge`, page.url().endsWith('index.html') && (await page.locator('.soon').count()) === 0 && (await page.locator('.sitenav a[href="guia.html"]').innerText()).trim() === 'Guia do Jogo');

  ok(`[${label}] sem erros de console / requests falhos`, errors.length === 0, errors.slice(0, 3).join(' | '));
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
  const fails = results.filter((r) => !r.pass);
  console.log(`\nTOTAL ${results.length} | FALHAS ${fails.length}`);
  fs.writeFileSync(path.join(OUT, 'resultado-guia.json'), JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})();
