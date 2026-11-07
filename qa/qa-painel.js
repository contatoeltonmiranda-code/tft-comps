// QA do Painel de decisao (1440, 1100 e 390). Uso: servidor na raiz (python -m http.server 8765) e node qa/qa-painel.js
// Um unico Chromium, um contexto por largura, partida simulada com varias rodadas do 2-1 ao 4-3.
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const exe = process.env.LOCALAPPDATA.replace(/\\/g, '/') + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8765/';
const OUT = __dirname;
const results = [];
const ok = (name, cond, extra) => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'OK   ' : 'FALHA') + ' ' + name + (extra ? ' -> ' + extra : '')); };

const VEIGAR = 'DA_18_Veigar';
const ORNN = 'DA_18_Ornn';
const BF = 'DA_Component_BFSword';

async function run(browser, label, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/kaspersky/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed ' + r.url()));
  const shot = (name, opts) => page.screenshot(Object.assign({ path: path.join(OUT, `painel-${label}-${name}.png`) }, opts || {}));
  const overflowX = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const saida = () => page.locator('#pn-saida').innerText();
  const barra = () => page.locator('#pn-barra').innerText();
  const box = (sel) => page.locator(sel).first().boundingBox();
  const stage = () => page.evaluate(() => `${document.querySelector('#pn-estagio').value}-${document.querySelector('#pn-rodada').value}`);
  const guardado = () => page.evaluate(() => JSON.parse(localStorage.getItem('tft-comps:painel:v1')));
  const wide = viewport.width >= 1000;

  const resp = await page.goto(BASE + 'painel.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.pn-card');
  await page.evaluate(() => document.fonts.ready);
  ok(`[${label}] painel.html responde 200`, resp.status() === 200);

  /* ---------- estrutura, nav, meta ---------- */
  const nav = await page.locator('.sitenav a').evaluateAll((as) => as.map((a) => ({ t: a.textContent.trim(), h: a.getAttribute('href'), cur: a.getAttribute('aria-current') })));
  ok(`[${label}] nav: Comps | Painel | Guia do Jogo | Estratégia padrão | Notícias, ativo = Painel`, nav.map((n) => n.t).join('|') === 'Comps|Painel|Guia do Jogo|Estratégia padrão|Notícias' && nav.filter((n) => n.cur === 'page').map((n) => n.t).join() === 'Painel', JSON.stringify(nav));
  const navFit = await page.evaluate(() => { const n = document.querySelector('.sitenav-in'); return n.scrollWidth - n.clientWidth; });
  ok(`[${label}] nav cabe sem rolar (5 links visíveis)`, navFit <= 0, 'sobra=' + navFit);
  const meta = await page.evaluate(() => ({ t: document.title, d: document.querySelector('meta[name=description]').content, r: document.querySelector('meta[name=robots]').content, h1: document.querySelectorAll('h1').length, og: !!document.querySelector('meta[property="og:title"]'), tw: !!document.querySelector('meta[name="twitter:card"]') }));
  ok(`[${label}] title <= 60, description 140-160, h1 único, og/twitter, noindex`, meta.t.length <= 60 && meta.d.length >= 140 && meta.d.length <= 160 && meta.h1 === 1 && meta.og && meta.tw && meta.r === 'noindex', JSON.stringify({ t: meta.t.length, d: meta.d.length }));
  ok(`[${label}] sem scroll horizontal da página`, (await overflowX()) <= 0, 'overflow=' + (await overflowX()));
  ok(`[${label}] estado inicial 1-1, vida 100, ouro 0, nível 1`, (await stage()) === '1-1' && (await page.inputValue('#pn-vida')) === '100' && (await page.inputValue('#pn-ouro')) === '0' && (await page.inputValue('#pn-nivel')) === '1');
  ok(`[${label}] 74 campeões e 10 componentes na grade`, (await page.locator('.pn-champ').count()) === 74 && (await page.locator('.pn-compo').count()) === 10);
  ok(`[${label}] contest lista as 24 comps`, (await page.locator('.pn-ct').count()) === 24);
  ok(`[${label}] aviso de política visível e recolhível`, /não lê o jogo/i.test(await page.locator('#pn-aviso summary').innerText()));

  /* ---------- layout ---------- */
  const e = await box('#pn-entrada');
  const s = await box('#pn-saida');
  if (wide) ok(`[${label}] desktop: entrada à esquerda, saída à direita, lado a lado`, e.x < s.x && Math.abs(e.y - s.y) < 30 && e.x + e.width <= s.x + 2, JSON.stringify({ e: [e.x, e.width], s: [s.x, s.width] }));
  else ok(`[${label}] mobile: saída no topo e entrada abaixo`, s.y < e.y && Math.abs(e.x - s.x) < 2, JSON.stringify({ sy: s.y, ey: e.y }));
  await shot('01-inicio');

  /* ---------- 2-1: vida 100, ouro 4 ---------- */
  await page.selectOption('#pn-estagio', '2');
  ok(`[${label}] trocar estágio mantém a rodada válida`, (await stage()) === '2-1');
  await page.fill('#pn-ouro', '4');
  for (let i = 0; i < 2; i++) await page.click('[data-step="level:1"]');
  ok(`[${label}] nível sobe pelo botão +1`, (await page.inputValue('#pn-nivel')) === '3');
  let t = await saida();
  ok(`[${label}] 2-1 ouro 4: Open Fort, FICAR no 3, juros +0, próximo degrau 10 (faltam 6)`, /Open Fort/.test(t) && /FICAR no 3/.test(t) && /\+0/.test(t) && /próximo degrau 10 \(faltam 6\)/.test(t), t.slice(0, 160).replace(/\n/g, ' | '));
  ok(`[${label}] barra resumo: rodada, badge FICAR, ouro`, /Rodada 2-1/.test(await barra()) && (await page.locator('#pn-barra .act-ficar').count()) === 1 && /Ouro 4/.test(await barra()));
  ok(`[${label}] estágio 2: faixa de vida não vale e sem alerta`, /faixa de vida não vale/.test(t) && (await page.locator('.pn-alerta').count()) === 0);
  await shot('02-2-1');

  /* ---------- campeoes: soma, par, 2 estrelas, remover ---------- */
  const veigar = page.locator(`.pn-champ[data-id="${VEIGAR}"]`);
  const ornn = page.locator(`.pn-champ[data-id="${ORNN}"]`);
  const tap = (loc) => (mobile ? loc.tap() : loc.click());
  await tap(veigar);
  ok(`[${label}] 1 clique = 1 cópia (×1, sem rótulo)`, (await veigar.locator('.pn-cnt').innerText()) === '×1' && (await veigar.locator('.pn-st').innerText()) === '');
  await tap(veigar);
  ok(`[${label}] 2 cópias = par`, (await veigar.locator('.pn-cnt').innerText()) === '×2' && (await veigar.locator('.pn-st').innerText()) === 'par');
  for (let i = 0; i < 3; i++) await tap(ornn);
  ok(`[${label}] 3 cópias = 2★ automático`, (await ornn.locator('.pn-cnt').innerText()) === '×3' && (await ornn.locator('.pn-st').innerText()) === '2★');
  ok(`[${label}] chips "Tenho" mostram os dois campeões`, (await page.locator('.pn-chip').count()) === 2 && /Veigar ×2 par/.test(await page.locator('#pn-tenho').innerText()) && /Ornn ×3 2★/.test(await page.locator('#pn-tenho').innerText()));
  if (mobile) {
    await ornn.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
    await page.waitForTimeout(650);
    await ornn.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
    await page.waitForTimeout(500);
    ok(`[${label}] segurar (long-press) remove uma cópia e não soma`, (await ornn.locator('.pn-cnt').innerText()) === '×2' && (await ornn.locator('.pn-st').innerText()) === 'par');
  } else {
    await ornn.click({ button: 'right' });
    ok(`[${label}] botão direito remove uma cópia`, (await ornn.locator('.pn-cnt').innerText()) === '×2' && (await ornn.locator('.pn-st').innerText()) === 'par');
    await ornn.focus();
    await page.keyboard.press('Enter');
    ok(`[${label}] teclado: Enter soma`, (await ornn.locator('.pn-cnt').innerText()) === '×3');
    await page.keyboard.press('Delete');
    ok(`[${label}] teclado: Delete remove`, (await ornn.locator('.pn-cnt').innerText()) === '×2');
  }
  await page.locator('#pn-tenho .pn-chip', { hasText: 'Ornn' }).locator('.pn-chip-x').click();
  await tap(ornn);
  ok(`[${label}] × do chip remove 1 cópia; clique soma de volta`, (await ornn.locator('.pn-cnt').innerText()) === '×2');
  await page.fill('#pn-q-champs', 'veig');
  ok(`[${label}] busca de campeão filtra (ignora acento e caixa)`, (await page.locator('.pn-champ:not([hidden])').count()) === 1);
  await page.fill('#pn-q-champs', 'zzzz');
  ok(`[${label}] busca sem resultado mostra aviso`, await page.locator('#pn-champs-vazio').isVisible());
  await page.fill('#pn-q-champs', '');
  ok(`[${label}] busca limpa mostra todos`, (await page.locator('.pn-champ:not([hidden])').count()) === 74);

  /* ---------- componentes ---------- */
  const bf = page.locator(`.pn-compo[data-id="${BF}"]`);
  await tap(bf.locator('.pn-compo-b'));
  await tap(bf.locator('.pn-compo-b'));
  ok(`[${label}] componente soma (×2) e mostra o botão -`, (await bf.locator('.pn-cnt').innerText()) === '×2' && await bf.locator('.pn-menos').isVisible());
  await bf.locator('.pn-menos').click();
  ok(`[${label}] botão - remove um componente`, (await bf.locator('.pn-cnt').innerText()) === '×1');
  await tap(bf.locator('.pn-compo-b'));
  const g = await guardado();
  ok(`[${label}] estado salvo em tft-comps:painel:v1`, g && g.champs[VEIGAR] === 2 && g.champs[ORNN] === 2 && g.comps[BF] === 2 && g.gold === 4 && g.level === 3, JSON.stringify(g && { s: g.stage, c: g.champs, k: g.comps }));
  await shot('03-campeoes');

  /* ---------- partida: 2-2 em diante (proxima rodada mantem o resto) ---------- */
  await page.click('#pn-prox');
  ok(`[${label}] "Próxima rodada" avança 2-1 -> 2-2 e mantém o resto`, (await stage()) === '2-2' && (await page.inputValue('#pn-ouro')) === '4' && (await veigar.locator('.pn-cnt').innerText()) === '×2');
  await page.fill('#pn-ouro', '9');
  await page.fill('#pn-vida', '98');
  await page.fill('#pn-nivel', '4');
  t = await saida();
  ok(`[${label}] 2-2 com 2 pares e componentes: Fast 8, GUARDAR`, /Fast 8 padrão/.test(t) && (await page.locator('#pn-barra .act-guardar').count()) === 1, (await barra()).replace(/\n/g, ' | '));
  await page.click('#pn-prox');
  for (let i = 0; i < 3; i++) await page.click('[data-step="streak:1"]');
  ok(`[${label}] streak +3 mostra "3 vitórias"`, (await page.locator('#pn-streak').innerText()) === '3 vitórias');
  ok(`[${label}] 2-3 com win streak: board forte, UPAR 5`, /UPAR para 5/.test(await barra()) && (await page.locator('#pn-barra .act-upar').count()) === 1, (await barra()).replace(/\n/g, ' | '));
  await page.click('#pn-prox');
  ok(`[${label}] 2-4 é carrossel`, /Rodada de carrossel/.test(await saida()));

  // 3-2: ouro 32, vida 70, nivel 5
  while ((await stage()) !== '3-2') await page.click('#pn-prox');
  await page.fill('#pn-ouro', '32');
  await page.fill('#pn-vida', '70');
  await page.fill('#pn-nivel', '5');
  await page.click('#pn-streak-zero');
  ok(`[${label}] zerar streak`, (await page.locator('#pn-streak').innerText()) === 'sem streak');
  t = await saida();
  ok(`[${label}] 3-2 ouro 32 vida 70: UPAR para 6, juros +3, próximo degrau 40, faixa Segura`, /UPAR para 6/.test(t) && /\+3/.test(t) && /próximo degrau 40 \(faltam 8\)/.test(t) && /70 · Segura/.test(t), (await barra()).replace(/\n/g, ' | '));
  ok(`[${label}] regra citada: §2 Fast 8 · Rodada a rodada · 3-2 com link e trecho`, (await page.locator('.pn-fonte a[href*="rodada-a-rodada"]').count()) === 1 && /3-2/.test(await page.locator('.pn-fonte').innerText()));
  await page.locator('.pn-trecho summary').click();
  ok(`[${label}] "Ver o trecho do guia" mostra o texto do .md`, /SE ouro ≥ 30–32 → UPAR 6/.test(await page.locator('.pn-trecho blockquote').innerText()));
  await page.fill('#pn-xp-atual', '20');
  await page.fill('#pn-xp-max', '36');
  t = await saida();
  ok(`[${label}] com XP 20/36: sobra após a ação = 16`, /Sobra após a ação\s*16/.test(t), t.match(/Sobra após a ação[^\n]*\n?[^\n]*/)?.[0]);
  await shot('04-3-2');

  // comps: ranking, top3, itens
  ok(`[${label}] ranking: 3 comps em destaque e todas as 24`, (await page.locator('.pn-top-i').count()) === 3 && /Todas as comps \(24\)/.test(await page.locator('.pn-todas summary').innerText()));
  await page.locator('.pn-todas summary').click();
  ok(`[${label}] "Todas as comps" abre com as outras 21`, (await page.locator('.pn-resto-i').count()) === 21);
  const sc = (await page.locator('.pn-top-i .pn-score').allInnerTexts()).map((x) => x.replace(/\D/g, ''));
  ok(`[${label}] top 3 em ordem decrescente de pontuação`, sc.length === 3 && Number(sc[0]) >= Number(sc[1]) && Number(sc[1]) >= Number(sc[2]), sc.join());
  ok(`[${label}] cada comp do top 3 mostra o que falta e as miniaturas da fase`, (await page.locator('.pn-top-i .pn-falta').count()) === 3 && (await page.locator('.pn-top-i .pn-mini').count()) >= 9);
  ok(`[${label}] fase "Meio" no estágio 3`, /Meio \(estágios 3 e 4\)/.test(await saida()));

  // contest e favorita
  const compNome = await page.locator('.pn-top-i h3').first().innerText();
  await page.fill('#pn-q-contest', compNome.split(' ')[0]);
  const linha = page.locator('.pn-ct:not([hidden])', { hasText: compNome }).first();
  await linha.locator('.pn-star').click();
  ok(`[${label}] estrela marca a comp favorita (aria-pressed) e vai para o Forçar`, (await linha.locator('.pn-star').getAttribute('aria-pressed')) === 'true' && (await page.inputValue('#pn-forcar-sel')) !== '');
  t = await saida();
  ok(`[${label}] Forçar comp mostra veredito com badge`, /OK|ARRISCADO|NÃO FORCE/.test(await page.locator('.pn-veredito').innerText()), await page.locator('.pn-veredito').innerText());
  for (let i = 0; i < 3; i++) await linha.locator('[data-contest$=":1"]').click();
  ok(`[${label}] contest 3 na comp = NÃO FORCE e pede pivô`, (await page.locator('.pn-veredito .pn-v-nao').count()) === 1 && /3 ou mais jogadores/.test(await saida()) && /pivote/i.test(await saida()), (await page.locator('.pn-veredito').innerText()).replace(/\n/g, ' '));
  await shot('05-forcar');
  for (let i = 0; i < 3; i++) await linha.locator('[data-contest$=":-1"]').click();

  // 4-2: ouro 45, vida 50, nivel 7
  while ((await stage()) !== '4-2') await page.click('#pn-prox');
  await page.fill('#pn-ouro', '45');
  await page.fill('#pn-vida', '50');
  await page.fill('#pn-nivel', '7');
  await page.fill('#pn-xp-atual', '40');
  await page.fill('#pn-xp-max', '48');
  t = await saida();
  ok(`[${label}] 4-2 ouro 45 vida 50: UPAR para 8 e ROLAR até 20–30, sobra 20–30`, /UPAR para 8 e ROLAR até 20–30/.test(t) && /Sobra após a ação\s*20–30/.test(t) && (await page.locator('#pn-barra .act-upar').count()) === 1 && (await page.locator('#pn-barra .act-rolar').count()) === 1, (await barra()).replace(/\n/g, ' | '));
  ok(`[${label}] piso ~40 do 4-2 aparece`, /~40 para subir ao 8/.test(t) || /Ouro ~40/.test(t));
  await shot('06-4-2');

  // 4-3: vida critica
  await page.click('#pn-prox');
  await page.fill('#pn-vida', '25');
  await page.fill('#pn-ouro', '38');
  await page.fill('#pn-nivel', '8');
  await page.click('[data-step="streak:-1"]');
  await page.click('[data-step="streak:-1"]');
  await page.click('[data-step="streak:-1"]');
  t = await saida();
  ok(`[${label}] vida < 30 (Crítica): alerta crítico e ROLAR até 10, regra derivada do guia`, (await page.locator('.pn-alerta-critico').count()) === 1 && /ROLAR até 10/.test(await barra()) && /derivada do guia/.test(t), (await barra()).replace(/\n/g, ' | '));
  ok(`[${label}] Estratégia mostra "Por que" e "O que faria mudar"`, /Por que/.test(t) && /O que faria mudar/.test(t));
  await shot('07-vida-critica');

  // extras: aprimoramento e board
  await page.locator('.pn-extras summary').click();
  await page.locator('[data-seg="aprim"] [data-valor="eco"]').click();
  await page.locator('[data-seg="board"] [data-valor="forte"]').click();
  ok(`[${label}] extras: aprimoramento Economia e board Forte marcados`, (await page.locator('[data-seg="aprim"] [data-valor="eco"]').getAttribute('aria-pressed')) === 'true' && (await page.locator('[data-seg="board"] [data-valor="forte"]').getAttribute('aria-pressed')) === 'true');
  await page.locator('[data-seg="board"] [data-valor="auto"]').click();
  await page.locator('[data-seg="aprim"] [data-valor=""]').click();

  /* ---------- tamanho de alvos de toque ---------- */
  const alvos = await page.evaluate(() => [...document.querySelectorAll('.pn-b, .pn-prox, .pn-sel, .pn-num, .pn-champ')].map((b) => { const r = b.getBoundingClientRect(); return { c: b.className, w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.w > 0 && (x.w < 40 || x.h < 40)));
  ok(`[${label}] alvos de toque principais >= 40px`, alvos.filter((a) => !/pn-b pn-b/.test(a.c)).length === 0, JSON.stringify(alvos.slice(0, 4)));

  /* ---------- barra fixa ---------- */
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(150);
  const bt = await page.evaluate(() => Math.round(document.querySelector('#pn-barra').getBoundingClientRect().top));
  ok(`[${label}] barra resumo fica fixa no topo ao rolar`, bt >= 0 && bt <= 2, 'top=' + bt);
  await shot('08-rolado');
  await page.evaluate(() => window.scrollTo(0, 0));

  /* ---------- persistencia ---------- */
  await page.reload();
  await page.waitForSelector('.pn-card');
  ok(`[${label}] recarregar restaura a partida (4-3, vida 25, ouro 38, Veigar ×2)`, (await stage()) === '4-3' && (await page.inputValue('#pn-vida')) === '25' && (await page.inputValue('#pn-ouro')) === '38' && (await veigar.locator('.pn-cnt').innerText()) === '×2' && (await page.locator('#pn-streak').innerText()) === '3 derrotas');
  ok(`[${label}] favorita sobrevive ao reload`, (await page.inputValue('#pn-forcar-sel')) !== '');

  /* ---------- estado corrompido nao quebra ---------- */
  await page.evaluate(() => localStorage.setItem('tft-comps:painel:v1', '{"stage":"9-9","hp":"x","champs":{"__proto__":3,"NAO_EXISTE":2}}'));
  await page.reload();
  await page.waitForSelector('.pn-card');
  ok(`[${label}] localStorage corrompido cai no estado limpo, sem erro`, (await stage()) === '1-1' && (await page.locator('.pn-chip').count()) === 0);
  await page.evaluate(() => localStorage.setItem('tft-comps:painel:v1', 'lixo{'));
  await page.reload();
  await page.waitForSelector('.pn-card');
  ok(`[${label}] JSON inválido no localStorage cai no estado limpo`, (await stage()) === '1-1');

  /* ---------- nova partida ---------- */
  await page.selectOption('#pn-estagio', '3');
  await page.fill('#pn-ouro', '50');
  await tap(veigar);
  await page.click('#pn-nova');
  ok(`[${label}] "Nova partida" pede confirmação`, await page.locator('#pn-confirma').isVisible());
  await page.click('#pn-confirma-nao');
  ok(`[${label}] cancelar mantém o estado`, (await page.inputValue('#pn-ouro')) === '50' && (await veigar.locator('.pn-cnt').innerText()) === '×1');
  await page.click('#pn-nova');
  await shot('09-confirma');
  await page.click('#pn-confirma-sim');
  ok(`[${label}] confirmar zera: 1-1, ouro 0, sem campeões, sem favorita`, (await stage()) === '1-1' && (await page.inputValue('#pn-ouro')) === '0' && (await page.locator('.pn-chip').count()) === 0 && (await page.inputValue('#pn-forcar-sel')) === '');
  const g2 = await guardado();
  ok(`[${label}] estado zerado também no localStorage`, g2.stage === '1-1' && Object.keys(g2.champs).length === 0 && g2.gold === 0);

  /* ---------- navegacao ---------- */
  await page.click('.sitenav a[href="estrategia.html"]');
  await page.waitForSelector('.guia h2');
  ok(`[${label}] navegação Painel > Estratégia: 5 links e Painel presente`, (await page.locator('.sitenav a').count()) === 5 && (await page.locator('.sitenav a[href="painel.html"]').innerText()).trim() === 'Painel');
  await page.click('.sitenav a[href="painel.html"]');
  await page.waitForSelector('.pn-card');
  ok(`[${label}] volta ao Painel pelo menu`, page.url().endsWith('painel.html'));
  ok(`[${label}] sem scroll horizontal no fim`, (await overflowX()) <= 0, 'overflow=' + (await overflowX()));
  await shot('10-final-vazio');

  const filtrados = errors.filter((x) => !/localStorage|lixo|JSON/.test(x));
  ok(`[${label}] sem erros nem avisos no console (${errors.length})`, filtrados.length === 0, filtrados.slice(0, 3).join(' || '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  await run(browser, '1440', { width: 1440, height: 900 }, false);
  await run(browser, '1100', { width: 1100, height: 800 }, false);
  await run(browser, '390', { width: 390, height: 844 }, true);
  await browser.close();
  const fail = results.filter((r) => !r.pass);
  fs.writeFileSync(path.join(OUT, 'resultado-painel.json'), JSON.stringify({ total: results.length, falhas: fail.length, results }, null, 2));
  console.log(`\n${results.length - fail.length}/${results.length} ok`);
  process.exit(fail.length ? 1 : 0);
})();
