// QA da pagina Estrategia padrao (1440, 1100 e 390). Uso: servidor na raiz (python -m http.server 8765) e node qa/qa-estrategia.js
// Um unico Chromium, tres contextos em sequencia.
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const exe = process.env.LOCALAPPDATA.replace(/\\/g, '/') + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8765/';
const OUT = __dirname;
const results = [];
const ok = (name, cond, extra) => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'OK   ' : 'FALHA') + ' ' + name + (extra ? ' -> ' + extra : '')); };
const md = fs.readFileSync(path.join(__dirname, '../data/estrategia-padrao.md'), 'utf8');
const N_TABLES = md.split('\n').filter((l, i, a) => /^\|[\s|:-]+\|\s*$/.test(l) && /^\|/.test(a[i - 1])).length;

async function run(browser, label, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/kaspersky/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed ' + r.url()));
  const shot = (name, opts) => page.screenshot(Object.assign({ path: path.join(OUT, `estrategia-${label}-${name}.png`) }, opts || {}));
  const overflowX = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const topOf = (sel) => page.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().top), sel);
  const barBottom = () => page.evaluate(() => Math.round(document.querySelector('.searchbar').getBoundingClientRect().bottom));
  const wide = viewport.width >= 1000;

  const resp = await page.goto(BASE + 'estrategia.html');
  await page.waitForSelector('.guia h2');
  await page.evaluate(() => document.fonts.ready);
  ok(`[${label}] estrategia.html responde 200`, resp.status() === 200);

  /* ---------- nav ---------- */
  const nav = await page.locator('.sitenav a').evaluateAll((as) => as.map((a) => ({ t: a.textContent.trim(), h: a.getAttribute('href'), cur: a.getAttribute('aria-current') })));
  ok(`[${label}] nav: 7 links, ativo = Estratégia padrão`, nav.length === 7 && nav.map((n) => n.t).join('|') === 'Comps|Plano|Painel|Pós-jogo|Guia do Jogo|Estratégia padrão|Notícias' && nav.filter((n) => n.cur === 'page').map((n) => n.t).join() === 'Estratégia padrão', JSON.stringify(nav));
  const navFit = await page.evaluate(() => { const n = document.querySelector('.sitenav-in'); return n.scrollWidth - n.clientWidth; });
  ok(`[${label}] nav cabe sem rolar (7 links)`, navFit <= 0, 'sobra=' + navFit);
  ok(`[${label}] sem badge "Em breve"`, (await page.locator('.soon').count()) === 0 && !/Em breve/.test(await page.locator('body').innerText()));
  ok(`[${label}] title e h1`, /Estratégia padrão de TFT/.test(await page.title()) && (await page.locator('h1').innerText()) === 'Estratégia padrão — TFT Set 18');
  ok(`[${label}] 6 seções e ${N_TABLES} tabelas`, (await page.locator('.guia h2').count()) === 6 && (await page.locator('.guia table').count()) === N_TABLES, `tabelas md=${N_TABLES}`);
  ok(`[${label}] sem scroll horizontal da página`, (await overflowX()) <= 0, 'overflow=' + (await overflowX()));
  const body = await page.locator('.guia').innerText();
  ok(`[${label}] acentos e símbolos preservados (Estratégia, Atenção, ≥, →, ★)`, /Estratégia 1/.test(body) && /Atenção/.test(body) && /≥/.test(body) && /→/.test(body) && /3★/.test(body));
  await shot('1-topo');

  /* ---------- atalhos ---------- */
  const qa = await page.locator('.quick a').evaluateAll((as) => as.map((a) => ({ t: a.textContent.trim(), h: a.getAttribute('href'), height: Math.round(a.getBoundingClientRect().height) })));
  ok(`[${label}] atalhos no topo: "Checklist rápido" e "Resumo de bolso" (>= 44px)`, qa.length === 2 && qa[0].t === 'Checklist rápido' && qa[1].t === 'Resumo de bolso' && qa.every((a) => a.height >= 44), JSON.stringify(qa));
  const qy = await page.evaluate(() => Math.round(document.querySelector('.quick').getBoundingClientRect().bottom));
  ok(`[${label}] atalhos visíveis sem rolar (primeira dobra)`, qy < viewport.height, 'bottom=' + qy);
  await page.locator('.quick a', { hasText: 'Checklist rápido' }).click();
  await page.waitForTimeout(250);
  const ct = await topOf('#checklist-de-30-segundos');
  const bb = await barBottom();
  ok(`[${label}] "Checklist rápido" leva ao checklist (título logo abaixo da busca fixa)`, page.url().endsWith('#checklist-de-30-segundos') && ct >= bb - 2 && ct < bb + 140, `h3.top=${ct} barra.bottom=${bb}`);
  const cbox = await page.locator('.caixa:has(#checklist-de-30-segundos)').evaluate((e) => { const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { b: c.borderLeftWidth, bg: c.backgroundImage !== 'none', items: e.querySelectorAll('li').length, inView: r.bottom <= innerHeight && r.top >= 0 }; });
  ok(`[${label}] checklist em caixa destacada, 7 itens, inteiro na tela`, cbox.b === '4px' && cbox.bg && cbox.items === 7 && cbox.inView, JSON.stringify(cbox));
  const marker = await page.locator('.caixa li').first().evaluate((e) => getComputedStyle(e, '::before').content);
  ok(`[${label}] itens do checklist numerados (contador)`, marker === 'counter(cx)', marker);
  await shot('2-checklist');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.quick a', { hasText: 'Resumo de bolso' }).click();
  await page.waitForTimeout(250);
  const rt = await topOf('#resumo-de-bolso');
  ok(`[${label}] "Resumo de bolso" leva ao resumo em caixa com 10 itens`, page.url().endsWith('#resumo-de-bolso') && rt >= (await barBottom()) - 2 && (await page.locator('.gsec.caixa li').count()) === 10, 'h2.top=' + rt);
  await shot('3-resumo');

  /* ---------- indice ---------- */
  await page.evaluate(() => window.scrollTo(0, 0));
  const tocVisible = await page.locator('#toc a:visible').count();
  const summaryVisible = await page.locator('#toc summary').isVisible();
  if (wide) {
    ok(`[${label}] índice lateral aberto com 6 links, sem cabeçalho recolhível`, tocVisible === 6 && !summaryVisible, `visiveis=${tocVisible}`);
    const g = await page.evaluate(() => { const t = document.getElementById('toc').getBoundingClientRect(); const a = document.getElementById('guia').getBoundingClientRect(); return { tr: Math.round(t.right), al: Math.round(a.left) }; });
    ok(`[${label}] índice ao lado do texto (2 colunas)`, g.tr <= g.al, JSON.stringify(g));
    await page.evaluate(() => window.scrollTo(0, 3200));
    await page.waitForTimeout(150);
    const tb = await page.locator('#toc').boundingBox();
    ok(`[${label}] índice fixo (sticky) ao rolar`, tb.y >= 60 && tb.y <= 100 && tb.y + tb.height <= viewport.height, `y=${Math.round(tb.y)} h=${Math.round(tb.height)}`);
    ok(`[${label}] scrollspy marca 1 seção`, (await page.locator('#toc a[aria-current]').count()) === 1, await page.locator('#toc a[aria-current]').innerText());
    await shot('4-indice-fixo');
  } else {
    ok(`[${label}] índice recolhido no topo (cabeçalho visível, links ocultos)`, summaryVisible && tocVisible === 0 && !(await page.locator('#toc-d').evaluate((d) => d.open)), `links=${tocVisible}`);
    const sb = await page.locator('#toc summary').boundingBox();
    ok(`[${label}] alvo do índice >= 44px`, sb.height >= 44, 'h=' + Math.round(sb.height));
    await page.locator('#toc summary').click();
    ok(`[${label}] toque no Índice abre os 6 links`, (await page.locator('#toc a:visible').count()) === 6);
    const lh = await page.locator('#toc a').first().boundingBox();
    ok(`[${label}] links do índice >= 44px de altura`, lh.height >= 44, 'h=' + Math.round(lh.height));
    await shot('4-indice-aberto');
    await page.locator('#toc summary').click();
  }

  /* ---------- ancoras do indice ---------- */
  const hrefs = await page.locator('#toc a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  const alvos = await page.evaluate((hs) => hs.map((h) => !!document.getElementById(h.slice(1))), hrefs);
  ok(`[${label}] 6 âncoras do índice têm alvo`, hrefs.length === 6 && alvos.every(Boolean));
  let bad = [];
  for (const h of hrefs) {
    await page.evaluate(() => window.scrollTo(0, 0));
    if (!wide) await page.locator('#toc-d').evaluate((d) => { d.open = true; });
    await page.locator(`#toc a[href="${h}"]`).click();
    await page.waitForTimeout(200);
    const t = await topOf(h);
    const b = await barBottom();
    const ultima = h === hrefs[hrefs.length - 1]; // pagina acaba antes de o titulo chegar ao topo
    if (!(page.url().endsWith(h) && t >= b - 2 && (ultima ? t < viewport.height - 80 : t < b + 120))) bad.push(`${h}:${t}/${b}`);
    if (!wide && (await page.locator('#toc-d').evaluate((d) => d.open))) bad.push(h + ':indice nao fechou');
  }
  ok(`[${label}] clicar em cada item do índice: URL e título logo abaixo da busca fixa${wide ? '' : ', índice fecha'}`, bad.length === 0, bad.join(' '));
  if (wide) ok(`[${label}] scrollspy acompanha a última âncora`, (await page.locator('#toc a[aria-current]').innerText()).startsWith('6.'));
  ok(`[${label}] sem scroll horizontal após âncoras`, (await overflowX()) <= 0);
  await shot('5-ancora');

  /* ---------- badges de acao ---------- */
  const acts = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.act')];
    const cor = {};
    ['upar', 'ficar', 'rolar', 'guardar', 'parar'].forEach((k) => { const e = document.querySelector('.act-' + k); cor[k] = e ? getComputedStyle(e).color : null; });
    return { n: all.length, foraTabela: all.filter((e) => !e.closest('table')).length, cor, inline: all.every((e) => getComputedStyle(e).display === 'inline-block'), texto: [...new Set(all.map((e) => e.textContent.split(' ')[0]))].sort().join(',') };
  });
  ok(`[${label}] badges UPAR/FICAR/ROLAR/GUARDAR/PARAR só nas tabelas (${acts.n})`, acts.n >= 60 && acts.foraTabela === 0 && acts.inline, `n=${acts.n} texto=${acts.texto}`);
  ok(`[${label}] 5 ações com 5 cores diferentes`, new Set(Object.values(acts.cor)).size === 5 && Object.values(acts.cor).every(Boolean), JSON.stringify(acts.cor));
  const ex = page.locator('#estrategia-1-fast-8-padrao-rodada-a-rodada ~ .tbl').first();
  await ex.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -140));
  await shot('6-linha-do-tempo');

  /* ---------- tabelas ---------- */
  const tb = await page.evaluate(() => [...document.querySelectorAll('.tbl')].map((t) => ({ sw: t.scrollWidth, cw: t.clientWidth })));
  const scrollables = tb.filter((t) => t.sw > t.cw + 1).length;
  if (mobile) {
    ok(`[${label}] mobile: tabelas viram cartões, nenhuma rola de lado (${scrollables})`, scrollables === 0 && (await overflowX()) <= 0, `rolantes=${scrollables}/${tb.length}`);
    const st = await page.evaluate(() => { const t = document.querySelector('.tbl.stack table'); const td = document.querySelector('.tbl.stack td'); return { thead: getComputedStyle(t.querySelector('thead')).display, tr: getComputedStyle(t.querySelector('tr')).display, label: getComputedStyle(td, '::before').content, lab: td.dataset.label }; });
    ok(`[${label}] cartão mostra o rótulo da coluna em cada célula`, st.thead === 'none' && st.tr === 'block' && st.label === `"${st.lab}"`, JSON.stringify(st));
    const fora = await page.evaluate(() => [...document.querySelectorAll('.guia *, .toc *, .gsearch *, .top *, .sitenav *, .quick *')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => e.tagName + '.' + e.className));
    ok(`[${label}] nada fora da tela`, fora.length === 0, fora.slice(0, 3).join(','));
  } else {
    ok(`[${label}] tabelas cabem na largura, sem rolar`, scrollables === 0 && (await overflowX()) <= 0, `rolantes=${scrollables}`);
    const th = await page.locator('.tbl thead th').first().evaluate((e) => getComputedStyle(e).textTransform);
    ok(`[${label}] cabeçalho de tabela estilizado`, th === 'uppercase');
  }
  ok(`[${label}] tabela focável por teclado com nome`, (await page.locator('.tbl').first().getAttribute('tabindex')) === '0' && /^Tabela: /.test(await page.locator('.tbl').first().getAttribute('aria-label')));
  const mx = page.locator('.tbl:has(strong:text-is("Folga (80+)"))');
  await mx.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -140));
  ok(`[${label}] matriz vida x board presente (4 linhas, badges)`, (await mx.locator('tbody tr').count()) === 4 && (await mx.locator('.act').count()) === 5);
  await shot('7-matriz');

  /* ---------- marcacoes e notas ---------- */
  const mk = await page.evaluate(() => {
    const rd = document.querySelector('.rd'); const dv = document.querySelector('.dv'); const nc = document.querySelector('.nc'); const s18 = document.querySelector('.s18'); const p = document.querySelector('.guia p');
    const c = (e) => getComputedStyle(e);
    return { rdItalic: c(rd).fontStyle, rdColor: c(rd).color, body: c(p).color, rdN: document.querySelectorAll('.rd').length, dvN: document.querySelectorAll('.dv').length, ncN: document.querySelectorAll('.nc').length, s18N: document.querySelectorAll('.s18').length, dvColor: c(dv).color, ncColor: c(nc).color, s18Color: c(s18).color, nota: c(document.querySelector('.nota')).borderLeftWidth };
  });
  ok(`[${label}] "(regra derivada do guia)" discreta: itálico, cor mais apagada que o texto (${mk.rdN})`, mk.rdN >= 15 && mk.rdItalic === 'italic' && mk.rdColor !== mk.body, JSON.stringify({ it: mk.rdItalic, rd: mk.rdColor, body: mk.body }));
  ok(`[${label}] (divergência), (Google, não confirmado) e (Set 18) com cores próprias`, mk.dvN >= 3 && mk.ncN >= 2 && mk.s18N >= 6 && new Set([mk.dvColor, mk.ncColor, mk.s18Color, mk.rdColor]).size === 4, JSON.stringify([mk.dvColor, mk.ncColor, mk.s18Color]));
  ok(`[${label}] notas em bloco discreto`, mk.nota === '3px');

  /* ---------- busca ---------- */
  await page.evaluate(() => window.scrollTo(0, 0));
  const antes = await page.locator('.guia').innerText();
  await page.fill('#gq', 'slow roll');
  await page.waitForTimeout(300);
  const nm = await page.locator('mark.hit').count();
  const secVis = await page.locator('.gsec:not([hidden])').count();
  const tocVis = await page.locator('#toc li:not([hidden])').count();
  ok(`[${label}] busca "slow roll": destaca ${nm} trechos e esconde seções sem resultado`, nm >= 8 && secVis >= 2 && secVis < 7, `marks=${nm} secoes=${secVis}`);
  ok(`[${label}] busca: índice mostra só seções com resultado`, tocVis === (await page.locator('.gsec:not([hidden]):not(.gintro) h2').count()), `toc=${tocVis}`);
  ok(`[${label}] busca: contador informa ocorrências e seções`, /^\d+ ocorrências? em \d+ seç(ão|ões)$/.test(await page.locator('#gcount').innerText()), await page.locator('#gcount').innerText());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  ok(`[${label}] Enter vai ao 1º resultado, dentro da tela`, await page.locator('mark.hit.cur').evaluate((m) => { const r = m.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  await shot('8-busca');
  await page.fill('#gq', 'estrategia 3');
  await page.waitForTimeout(300);
  const semAcento = await page.locator('mark.hit').count();
  await page.fill('#gq', 'ESTRATÉGIA 3');
  await page.waitForTimeout(300);
  ok(`[${label}] busca ignora acento e caixa ("estrategia 3" = "ESTRATÉGIA 3")`, semAcento >= 5 && semAcento === (await page.locator('mark.hit').count()), `${semAcento}`);
  await page.fill('#gq', 'UPAR 8');
  await page.waitForTimeout(300);
  ok(`[${label}] busca acha texto dentro de badge ("UPAR 8")`, (await page.locator('mark.hit').count()) >= 6 && (await page.locator('.act mark.hit').count()) >= 3);
  await page.fill('#gq', 'zzqqxx');
  await page.waitForTimeout(300);
  ok(`[${label}] busca sem resultado: mensagem e nada visível`, (await page.locator('#gempty').isVisible()) && (await page.locator('.gsec:not([hidden])').count()) === 0 && (await page.locator('#gcount').innerText()) === 'Nenhum resultado');
  await shot('9-busca-vazia');
  await page.fill('#gq', '<img src=x onerror=alert(1)>');
  await page.waitForTimeout(300);
  ok(`[${label}] busca com HTML não injeta nada`, (await page.locator('.guia img').count()) === 0);
  await page.fill('#gq', 'slow roll');
  await page.waitForTimeout(300);
  await page.locator('#gclear').click();
  ok(`[${label}] Limpar restaura o texto idêntico, sem marcas e com tudo visível`, (await page.locator('.guia').innerText()) === antes && (await page.locator('mark').count()) === 0 && (await page.locator('.gsec[hidden]').count()) === 0 && (await page.locator('#toc li[hidden]').count()) === 0);
  await page.fill('#gq', 'slow roll');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  ok(`[${label}] Esc limpa a busca`, (await page.inputValue('#gq')) === '' && (await page.locator('mark').count()) === 0);
  // busca ativa escondeu o checklist: atalho limpa e leva
  await page.fill('#gq', 'zzqqxx');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.quick a', { hasText: 'Checklist rápido' }).click();
  await page.waitForTimeout(300);
  ok(`[${label}] busca ativa + "Checklist rápido": limpa a busca e mostra o checklist`, (await page.inputValue('#gq')) === '' && (await page.locator('#checklist-de-30-segundos').isVisible()) && (await topOf('#checklist-de-30-segundos')) < viewport.height - 60);
  ok(`[${label}] sem scroll horizontal ao final`, (await overflowX()) <= 0);

  /* ---------- navegacao entre as 4 paginas ---------- */
  const seq = [['noticias.html', '.ncard'], ['guia.html', '.guia h2'], ['estrategia.html', '.guia h2'], ['index.html', 'article.comp']];
  for (const [href, sel] of seq) {
    await page.click(`.sitenav a[href="${href}"]`);
    await page.waitForSelector(sel);
  }
  ok(`[${label}] navegação por clique Estratégia > Notícias > Guia > Estratégia > Comps`, page.url().endsWith('index.html') && (await page.locator('.sitenav a').count()) === 7 && (await page.locator('.sitenav a[aria-current="page"]').innerText()).trim() === 'Comps');

  ok(`[${label}] sem erros de console / requests falhos`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  try {
    await run(browser, 'd1440', { width: 1440, height: 900 }, false);
    await run(browser, 'd1100', { width: 1100, height: 800 }, false);
    await run(browser, 'm390', { width: 390, height: 844 }, true);
  } finally {
    await browser.close();
  }
  const fails = results.filter((r) => !r.pass);
  console.log(`\nTOTAL ${results.length} | FALHAS ${fails.length}`);
  fs.writeFileSync(path.join(OUT, 'resultado-estrategia.json'), JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})();
