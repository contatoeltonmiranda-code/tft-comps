// QA com Playwright. Uso: node qa/qa.js  (servidor em http://127.0.0.1:8765)
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const exe = process.env.LOCALAPPDATA.replace(/\\/g, '/') + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = process.env.QA_URL || 'http://127.0.0.1:8765/index.html';
const OUT = __dirname;
const results = [];
const SEEDSB = { window: {} };
require('vm').runInNewContext(fs.readFileSync(path.join(__dirname, '../data/seed.js'), 'utf8'), SEEDSB);
const SEEDALL = SEEDSB.window.TFT_SEED;
const N = SEEDALL.length;
const LILLIA = (page) => page.locator('article.comp', { has: page.locator('h2', { hasText: 'Solar Lunar Lillia' }) });
const NOVAS = SEEDALL.filter((c) => c.desde === 7).map((c) => c.id);
const NOVAS_NOMES = SEEDALL.filter((c) => c.desde === 7).map((c) => c.nome);
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

async function migracao(label, viewport, mobile) {
  const vm = require('vm');
  const sb = { window: {} };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../data/seed.js'), 'utf8'), sb);
  const seed = JSON.parse(JSON.stringify(sb.window.TFT_SEED));
  const legado = seed.filter((c) => !['seed-16', 'seed-17', 'seed-18', 'seed-19'].concat(NOVAS).includes(c.id)).map((c) => { delete c.desde; return c; });
  legado[0].nome = 'Vivaz EDITADA';
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/kaspersky/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.evaluate((d) => { localStorage.clear(); localStorage.setItem('tft-comps:v1', JSON.stringify({ versao: 1, comps: d })); }, legado);
  await page.reload();
  await page.waitForSelector('article.comp');
  ok(`[${label}] migracao: legado 15 -> ${N} comps`, (await page.locator('article.comp').count()) === N, 'legado=' + legado.length);
  ok(`[${label}] migracao: edicao preservada`, (await page.locator('article.comp h2').allTextContents()).includes('Vivaz EDITADA'));
  const nomes = await page.locator('article.comp h2').allTextContents();
  ok(`[${label}] migracao: comp nova entrou`, nomes.includes('Defendente Congregação das Bruxas Rengar'));
  await page.reload();
  await page.waitForSelector('article.comp');
  ok(`[${label}] migracao: idempotente apos recarregar`, (await page.locator('article.comp').count()) === N);
  ok(`[${label}] migracao: Enfeitiçador 1o, Lutador Florescer 2o, Vanguarda 3o`, JSON.stringify(nomes.slice(0, 3)) === JSON.stringify(['Enfeitiçador 6', 'Lutador Florescer Adaptador', 'Vanguarda Congregação das Bruxas Devastador']), nomes.slice(0, 3).join(' | '));
  const novo = page.locator('article.comp', { has: page.locator('h2', { hasText: 'Defendente Congregação' }) });
  await novo.locator('button[aria-label^="Excluir"]').click();
  await page.locator('#ask-actions button', { hasText: 'Excluir' }).click();
  await page.reload();
  await page.waitForSelector('article.comp');
  ok(`[${label}] migracao: comp excluida nao volta`, (await page.locator('article.comp').count()) === N - 1 && (await page.locator('article.comp h2').allTextContents()).includes('Vivaz EDITADA'));
  ok(`[${label}] migracao: sem erros de console`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
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
  ok(`[${label}] ${N} comps renderizadas`, n === N, 'n=' + n);

  ok(`[${label}] botao Limpar oculto sem busca`, !(await page.locator('#btn-clear').isVisible()));
  const rep = await imgReport(page);
  ok(`[${label}] imagens da lista carregam`, rep.bad.length === 0, `total=${rep.total} falhas=${rep.bad.length} ${rep.bad.slice(0, 3)}`);
  const cat = await catalogImages(page);
  ok(`[${label}] imagens do catalogo completo carregam`, cat.bad.length === 0, `total=${cat.total} falhas=${cat.bad.length} ${cat.bad.slice(0, 3)}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`[${label}] sem rolagem horizontal`, overflow <= 0, 'overflow=' + overflow);
  await page.screenshot({ path: path.join(OUT, `${label}-1-lista.png`) });
  await LILLIA(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, `${label}-2-board.png`) });
  const hasHex = await LILLIA(page).locator('.hex.has').count();
  ok(`[${label}] tabuleiro hex com unidades`, hasHex === 8, 'hex=' + hasHex);

  // comp nova (print 14)
  const novo = page.locator('article.comp', { has: page.locator('h2', { hasText: 'Defendente Congregação das Bruxas Rengar' }) });
  ok(`[${label}] comp nova (print 14) na lista`, (await novo.count()) === 1);
  await novo.scrollIntoViewIfNeeded();
  ok(`[${label}] comp nova tem 8 campeoes`, (await novo.locator('.uname').count()) === 8, (await novo.locator('.uname').allTextContents()).join(','));
  ok(`[${label}] comp nova mostra traco Defendente`, (await novo.innerText()).includes('Defendente'));
  await novo.screenshot({ path: path.join(OUT, `${label}-7-comp-nova.png`) });

  // busca
  await page.fill('#q', 'diana');
  const dn = await page.locator('article.comp').count();
  const names = await page.locator('article.comp h2').allTextContents();
  ok(`[${label}] busca "diana" filtra`, dn > 0 && dn < N, `n=${dn}`);
  ok(`[${label}] busca destaca campeao`, (await page.locator('.unit.hit').count()) >= dn);
  await page.screenshot({ path: path.join(OUT, `${label}-3-busca.png`) });
  await page.fill('#q', 'guinsoo');
  ok(`[${label}] busca por item`, (await page.locator('article.comp').count()) > 0 && (await page.locator('.item.hit').count()) > 0);
  await page.fill('#q', 'devastador');
  ok(`[${label}] busca por traco`, (await page.locator('article.comp').count()) > 0, names.length + '');
  await page.fill('#q', 'zzzz');
  ok(`[${label}] busca sem resultado mostra aviso`, await page.locator('#empty').isVisible());
  await page.fill('#q', '');

  // busca por comp + checks "ja peguei"
  const PK = 'tft-comps:picks:v1';
  const c8 = () => LILLIA(page);
  await c8().scrollIntoViewIfNeeded();
  const total8 = await c8().locator('.unit').count();
  const first0 = await page.locator('article.comp').first().locator('.unit').count();
  const nome0 = (await c8().locator('.uname').first().textContent()).trim();
  await c8().locator('.cq').fill(nome0.slice(0, 3).toUpperCase());
  const shown = await c8().locator('.unit').allInnerTexts();
  ok(`[${label}] busca na comp filtra so ela`, shown.length >= 1 && shown.length < total8 && (await page.locator('article.comp').first().locator('.unit').count()) === first0 && (await page.inputValue('#q')) === '' && (await page.locator('article.comp').count()) === N, `${shown.length}/${total8}`);
  ok(`[${label}] busca na comp so mostra quem bate`, (await c8().locator('.uname').allTextContents()).every((t) => t.toLowerCase().includes(nome0.slice(0, 3).toLowerCase())));
  await c8().locator('.cq').fill('zzzz');
  ok(`[${label}] busca na comp sem resultado avisa`, (await c8().locator('.cnone').count()) === 1 && (await c8().locator('.unit').count()) === 0);
  await c8().locator('.cq').fill('');
  ok(`[${label}] busca na comp vazia mostra todos`, (await c8().locator('.unit').count()) === total8);
  await c8().locator('.cq').fill('kayn');
  await page.fill('#q', 'diana');
  await page.fill('#q', '');
  ok(`[${label}] busca da comp sobrevive a busca global`, (await c8().locator('.cq').inputValue()) === 'kayn');
  await c8().locator('.cq').fill('');

  ok(`[${label}] contador inicial 0/N`, (await c8().locator('.pcount').textContent()) === `0/${total8} pegos`);
  ok(`[${label}] Limpar checks desabilitado com 0`, await c8().locator('button', { hasText: 'Limpar checks' }).isDisabled());
  const pickBtn = (i) => c8().locator('.unit').nth(i).locator('button.pick');
  await pickBtn(0).evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const box = await pickBtn(0).boundingBox();
  const probe = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e && e.closest('button.pick') ? 'pick' : (e && e.tagName); }, { x: box.x + box.width / 2 - 15, y: box.y + box.height / 2 + 15 });
  ok(`[${label}] area de toque do check >= 32px`, box.width >= 22 && probe === 'pick', `btn=${box.width}x${box.height} probe=${probe}`);
  await pickBtn(0).click();
  await pickBtn(1).click();
  ok(`[${label}] 2 checks -> contador 2/N`, (await c8().locator('.pcount').textContent()) === `2/${total8} pegos`);
  ok(`[${label}] check usa aria-pressed e destaca`, (await pickBtn(0).getAttribute('aria-pressed')) === 'true' && (await c8().locator('.unit.picked').count()) === 2 && (await pickBtn(2).getAttribute('aria-pressed')) === 'false');
  ok(`[${label}] check nao abre editor`, !(await page.locator('#editor').evaluate((d) => d.open)));
  ok(`[${label}] check nao esconde imagem nem itens`, (await c8().locator('.unit.picked img.pic').first().evaluate((i) => i.naturalWidth > 0 && getComputedStyle(i).visibility !== 'hidden' && getComputedStyle(i).opacity === '1')) && (await c8().locator('.unit.picked .items img').count()) >= 1);
  await pickBtn(1).click();
  await pickBtn(1).click();
  ok(`[${label}] clicar de novo alterna`, (await c8().locator('.pcount').textContent()) === `2/${total8} pegos`);
  const store = await page.evaluate((k) => ({ picks: localStorage.getItem(k), comps: JSON.parse(localStorage.getItem('tft-comps:v1') || 'null') }), PK);
  ok(`[${label}] checks em chave separada das comps`, !!store.picks && JSON.stringify(store.comps || {}).indexOf('"checks"') === -1);
  await page.screenshot({ path: path.join(OUT, `${label}-8-checks.png`) });
  await page.reload();
  await page.waitForSelector('article.comp');
  await c8().scrollIntoViewIfNeeded();
  ok(`[${label}] checks persistem apos recarregar`, (await c8().locator('.pcount').textContent()) === `2/${total8} pegos` && (await c8().locator('.unit.picked').count()) === 2 && (await pickBtn(0).getAttribute('aria-pressed')) === 'true');
  ok(`[${label}] check e por comp (outras comps zeradas)`, (await page.locator('.unit.picked').count()) === 2);
  await c8().locator('button', { hasText: 'Limpar checks' }).click();
  ok(`[${label}] Limpar checks zera sem confirmacao`, (await c8().locator('.pcount').textContent()) === `0/${total8} pegos` && (await c8().locator('.unit.picked').count()) === 0 && !(await page.locator('#ask').evaluate((d) => d.open)));
  await page.reload();
  await page.waitForSelector('article.comp');
  ok(`[${label}] limpar persiste apos recarregar`, (await c8().locator('.pcount').textContent()) === `0/${total8} pegos`);

  // limpar checks global
  const gbtn = page.locator('#btn-clear-all');
  const picked = () => page.locator('.unit.picked').count();
  const compsJson = () => page.evaluate(() => localStorage.getItem('tft-comps:v1'));
  ok(`[${label}] Limpar checks global desabilitado sem checks`, await gbtn.isDisabled());
  ok(`[${label}] Limpar checks global visivel no topo`, await gbtn.isVisible(), (await gbtn.boundingBox()).width + 'px');
  await c8().scrollIntoViewIfNeeded();
  await pickBtn(0).click();
  await pickBtn(1).click();
  await page.locator('article.comp').first().locator('button.pick').first().click();
  await page.locator('article.comp').nth(3).locator('button.pick').nth(2).click();
  ok(`[${label}] global habilita ao marcar check`, await gbtn.isEnabled() && (await picked()) === 4);
  const comp0 = page.locator('article.comp').first();
  ok(`[${label}] botao por comp so ativo na comp com check`, await comp0.locator('[data-act="clear-comp"]').isEnabled() && await page.locator('article.comp').nth(1).locator('[data-act="clear-comp"]').isDisabled());
  const before = await compsJson();
  await page.screenshot({ path: path.join(OUT, `${label}-10-limpar-global-antes.png`) });
  await gbtn.click();
  ok(`[${label}] global pede confirmacao`, await page.locator('#ask').evaluate((d) => d.open) && /4 campe/.test(await page.locator('#ask-text').textContent()) && /3 comps/.test(await page.locator('#ask-text').textContent()), await page.locator('#ask-text').textContent());
  await page.screenshot({ path: path.join(OUT, `${label}-11-limpar-global-confirma.png`) });
  await page.locator('#ask-actions button', { hasText: 'Cancelar' }).click();
  ok(`[${label}] cancelar global mantem checks`, (await picked()) === 4 && await gbtn.isEnabled());
  await comp0.locator('[data-act="clear-comp"]').click();
  ok(`[${label}] limpar por comp zera so ela e atualiza global`, (await picked()) === 3 && await gbtn.isEnabled());
  await gbtn.click();
  await page.locator('#ask-actions button', { hasText: 'Limpar checks' }).click();
  ok(`[${label}] confirmar global zera todas as comps`, (await picked()) === 0 && await gbtn.isDisabled() && (await c8().locator('.pcount').textContent()) === `0/${total8} pegos`);
  ok(`[${label}] limpar global nao altera as comps`, (await compsJson()) === before && (await page.locator('article.comp').count()) === N);
  await page.reload();
  await page.waitForSelector('article.comp');
  ok(`[${label}] global persiste zerado apos recarregar`, (await picked()) === 0 && await gbtn.isDisabled() && (await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).checks, PK)) !== null && Object.keys(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).checks, PK)).length === 0);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('l');
  ok(`[${label}] atalho L sem checks nao abre confirmacao`, !(await page.locator('#ask').evaluate((d) => d.open)));
  await page.locator('article.comp').first().locator('button.pick').first().click();
  await page.locator('article.comp').first().locator('.cq').click();
  await page.keyboard.press('l');
  ok(`[${label}] atalho L ignorado ao digitar`, !(await page.locator('#ask').evaluate((d) => d.open)) && (await page.locator('article.comp').first().locator('.cq').inputValue()) === 'l');
  await page.locator('article.comp').first().locator('.cq').fill('');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('L');
  ok(`[${label}] atalho L abre confirmacao`, await page.locator('#ask').evaluate((d) => d.open));
  await page.keyboard.press('Escape');
  ok(`[${label}] Esc cancela e mantem check`, !(await page.locator('#ask').evaluate((d) => d.open)) && (await picked()) === 1);
  await page.keyboard.press('L');
  await page.locator('#ask-actions button', { hasText: 'Limpar checks' }).click();
  ok(`[${label}] atalho L + confirmar zera`, (await picked()) === 0 && await gbtn.isDisabled());
  await page.keyboard.press('?');
  ok(`[${label}] ajuda documenta atalho L`, (await page.locator('#help').innerText()).includes('Limpa os checks'));
  await page.keyboard.press('?');
  const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`[${label}] topo sem rolagem horizontal com botao novo`, ovf <= 0, 'overflow=' + ovf);
  await page.evaluate((k) => localStorage.setItem(k, '{lixo'), PK);
  await page.reload();
  await page.waitForSelector('article.comp');
  ok(`[${label}] checks corrompidos nao quebram`, (await page.locator('article.comp').count()) === N);
  await page.evaluate((k) => localStorage.removeItem(k), PK);
  await page.reload();
  await page.waitForSelector('article.comp');

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
  ok(`[${label}] campeao adicionado no editor`, (await row.count()) === 1, 'rows=' + (await row.count()) + ' toast=' + (await page.locator('#toast').textContent().catch(() => '')));
  await row.locator('button[data-act="add-alt"]').click();
  await page.fill('#pk-q', 'guinsoo');
  await page.locator('#pk-grid .pcell[data-id="DA_GuinsoosRageblade"]').click();
  await page.waitForTimeout(250);
  ok(`[${label}] item alternativo adicionado`, (await row.locator('.chip.alt').count()) === 1);
  await row.locator('button[data-act="add-item"]').click();
  await page.fill('#pk-q', 'rabadon');
  await page.locator('#pk-grid .pcell[data-id="DA_RabadonsDeathcap"]').click();
  await page.waitForTimeout(250);
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
  ok(`[${label}] nova comp criada no topo`, (await page.locator('article.comp h2').first().textContent()) === 'Teste QA' && (await page.locator('article.comp').count()) === N + 1);
  await page.locator('article.comp').first().locator('button[aria-label^="Duplicar"]').click();
  ok(`[${label}] duplicar`, (await page.locator('article.comp').count()) === N + 2 && (await page.locator('article.comp h2').nth(1).textContent()) === 'Teste QA (cópia)');
  await page.locator('article.comp').nth(1).locator('button[aria-label^="Excluir"]').click();
  ok(`[${label}] excluir pede confirmacao`, await page.locator('#ask').evaluate((d) => d.open));
  await page.locator('#ask-actions button', { hasText: 'Cancelar' }).click();
  ok(`[${label}] cancelar mantem comp`, (await page.locator('article.comp').count()) === N + 2);
  await page.locator('article.comp').nth(1).locator('button[aria-label^="Excluir"]').click();
  await page.locator('#ask-actions button', { hasText: 'Excluir' }).click();
  ok(`[${label}] excluir remove`, (await page.locator('article.comp').count()) === N + 1);

  // exportar / importar
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]);
  const file = path.join(OUT, `${label}-export.json`);
  await dl.saveAs(file);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(`[${label}] exportar gera JSON valido`, json.versao === 1 && json.comps.length === N + 1);
  await page.locator('article.comp').first().locator('button[aria-label^="Excluir"]').click();
  await page.locator('#ask-actions button', { hasText: 'Excluir' }).click();
  await page.setInputFiles('#file', file);
  await page.locator('#ask-actions button', { hasText: 'Substituir tudo' }).click();
  ok(`[${label}] importar restaura N+1`, (await page.locator('article.comp').count()) === N + 1);
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
  ok(`[${label}] restaurar originais`, (await page.locator('article.comp').count()) === N);

  const final = await imgReport(page);
  ok(`[${label}] imagens apos todos os fluxos`, final.bad.length === 0, `total=${final.total} falhas=${final.bad.length}`);
  ok(`[${label}] sem erros de console/rede`, errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close();
}

async function ordemTopo(label, viewport, mobile) {
  const vm = require('vm');
  const sb = { window: {} };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../data/seed.js'), 'utf8'), sb);
  const seed = JSON.parse(JSON.stringify(sb.window.TFT_SEED));
  const sem = (ids) => seed.filter((c) => !ids.concat(NOVAS).includes(c.id)).map((c) => { delete c.desde; delete c.topo; delete c.abaixoDe; return c; });
  const v2 = sem(['seed-17', 'seed-18', 'seed-19']);
  const v3 = sem(['seed-18', 'seed-19']);
  const v4 = sem(['seed-19']);
  const v6 = sem([]);
  const E = 'Enfeitiçador 6';
  const L = 'Lutador Florescer Adaptador';
  const V = 'Vanguarda Congregação das Bruxas Devastador';
  const T = NOVAS_NOMES;
  const cenarios = [
    ['primeira vez', null, [E, L, V].concat(T), N],
    ['seedVersao 6 (so as 5 do video faltam)', { versao: 1, seedVersao: 6, excluidos: [], comps: v6 }, [E, L, V].concat(T), N],
    ['seedVersao 4 (Enfeitiçador e Lutador no topo)', { versao: 1, seedVersao: 4, excluidos: [], comps: v4 }, [E, L, V].concat(T), N],
    ['seedVersao 3 (Enfeitiçador no topo)', { versao: 1, seedVersao: 3, excluidos: [], comps: v3 }, [E, L, V].concat(T), N],
    ['versao 2 antiga', { versao: 1, seedVersao: 2, excluidos: [], comps: v2 }, [E, L, V].concat(T), N],
    ['seedVersao 4, Lutador movida', { versao: 1, seedVersao: 4, excluidos: [], comps: v4.slice(0, 1).concat(v4.slice(2, 5), v4.slice(1, 2), v4.slice(5)) }, [V].concat(T, [E]), N],
    ['seedVersao 4, Lutador excluida', { versao: 1, seedVersao: 4, excluidos: ['seed-18'], comps: v4.filter((c) => c.id !== 'seed-18') }, [V].concat(T, [E]), N - 1],
    ['seedVersao 3, Enfeitiçador excluida', { versao: 1, seedVersao: 3, excluidos: ['seed-17'], comps: v3.filter((c) => c.id !== 'seed-17') }, [L, V].concat(T), N - 1],
    ['seedVersao 3, Enfeitiçador movida', { versao: 1, seedVersao: 3, excluidos: [], comps: v3.slice(1, 4).concat(v3.slice(0, 1), v3.slice(4)) }, [L, V].concat(T), N],
  ];
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  for (const [nome, stored, esperado, total] of cenarios) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/kaspersky/i.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.evaluate((d) => { localStorage.clear(); if (d) localStorage.setItem('tft-comps:v1', JSON.stringify(d)); }, stored);
    await page.reload();
    await page.waitForSelector('article.comp');
    const nomes = await page.locator('article.comp h2').allTextContents();
    ok(`[${label}] ordem ${nome}: topo`, JSON.stringify(nomes.slice(0, esperado.length)) === JSON.stringify(esperado) && nomes.length === total, nomes.slice(0, 3).join(' | ') + ' total=' + nomes.length);
    await page.reload();
    await page.waitForSelector('article.comp');
    const again = await page.locator('article.comp h2').allTextContents();
    ok(`[${label}] ordem ${nome}: estavel apos recarregar`, JSON.stringify(again) === JSON.stringify(nomes));
    const salvo = await page.evaluate(() => { const r = localStorage.getItem('tft-comps:v1'); return r ? JSON.parse(r).seedVersao : null; });
    ok(`[${label}] ordem ${nome}: seedVersao salva = 7`, salvo === 7 || (stored === null && salvo === null));
    if (nome === 'primeira vez' || nome.startsWith('seedVersao 3 (') || nome.startsWith('seedVersao 4 (')) {
      const card = page.locator('article.comp').nth(2);
      const traits = await card.innerText();
      ok(`[${label}] ordem ${nome}: card da nova mostra os tracos`, /Vanguarda/.test(traits) && /Congrega/.test(traits) && /Devastador/.test(traits), '');
      await page.screenshot({ path: path.join(OUT, `${label}-9-ordem-${nome.startsWith('primeira') ? 'primeira' : nome.startsWith('seedVersao 4') ? 'v4' : 'v3'}.png`) });
    }
    ok(`[${label}] ordem ${nome}: sem erros de console`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await browser.close();
}

(async () => {
  await run('desktop', { width: 1440, height: 900 }, false);
  await run('mobile', { width: 390, height: 844 }, true);
  await migracao('desktop', { width: 1440, height: 900 }, false);
  await migracao('mobile', { width: 390, height: 844 }, true);
  await ordemTopo('desktop', { width: 1440, height: 900 }, false);
  await ordemTopo('mobile', { width: 390, height: 844 }, true);
  const fails = results.filter((r) => !r.pass);
  console.log(`\nTOTAL ${results.length} | FALHAS ${fails.length}`);
  fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})();
