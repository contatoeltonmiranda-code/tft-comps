// QA das paginas Pos-jogo e Plano, da voz/faixas do Painel e da navegacao de 7 links (1440 e 390, um Chromium so).
// Uso: servidor na raiz (python -m http.server 8765 --bind 127.0.0.1) e node qa/qa-pos-plano-voz.js
// Sobe o servidor local so-leitura (tools/riot-server.js) numa pasta temporaria com partidas FICTICIAS, na porta 17871, e o encerra pelo PID.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require(process.env.PW_PATH || 'C:/Users/elton/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright');
const exe = process.env.LOCALAPPDATA.split('\\').join('/') + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8765/';
const OUT = __dirname;
const ROOT = path.join(__dirname, '..');
const PORTA = 17871;
const results = [];
const ok = (name, cond, extra) => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'OK   ' : 'FALHA') + ' ' + name + (extra ? ' -> ' + extra : '')); };

// ---- partidas fictícias para o servidor local
global.window = {};
require(path.join(ROOT, 'data/posjogo-exemplo.js'));
const exemplo = window.TFT_POSJOGO_EXEMPLO.partidas;
const falsas = exemplo.map((p, i) => Object.assign({}, p, { id: 'BR1_QA' + String(i + 1).padStart(2, '0') }));
const NAV7 = 'Comps|Plano|Painel|Pós-jogo|Guia do Jogo|Estratégia padrão|Notícias';

function subirServidor() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tft-qa-'));
  fs.writeFileSync(path.join(dir, 'partidas.json'), JSON.stringify({ versao: 1, atualizadoEm: '2026-11-07T12:00:00.000Z', partidas: falsas }));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ riotId: 'Teste#BR1' }));
  const proc = spawn(process.execPath, [path.join(ROOT, 'tools/riot-server.js')], { env: Object.assign({}, process.env, { TFT_COMPS_DIR: dir, TFT_COMPS_PORTA: String(PORTA) }), stdio: 'ignore', windowsHide: true });
  return { proc, dir };
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function aguardarServidor() {
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORTA}/api/ping`); if (r.ok) return true; } catch (e) { /* ainda subindo */ }
    await esperar(200);
  }
  return false;
}

function novoPage(ctx, errors) {
  return ctx.newPage().then((page) => {
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/kaspersky/i.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
    return page;
  });
}

const STUB_VOZ = (transcript, erro) => `(() => {
  delete window.SpeechRecognition;
  window.webkitSpeechRecognition = class {
    start() {
      setTimeout(() => { ${erro ? `this.onerror && this.onerror({ error: ${JSON.stringify(erro)} });` : `this.onresult && this.onresult({ results: [[{ transcript: ${JSON.stringify(transcript)} }]] });`} }, 40);
      setTimeout(() => { this.onend && this.onend(); }, 90);
    }
    stop() { if (this.onend) this.onend(); }
  };
})();`;

async function run(browser, label, viewport, mobile, servidor) {
  const mk = () => browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const shot = (page, nome, opts) => page.screenshot(Object.assign({ path: path.join(OUT, `pos-${label}-${nome}.png`) }, opts || {}));
  const navTxt = (page) => page.locator('.sitenav a').evaluateAll((as) => as.map((a) => a.textContent.trim()).join('|'));
  const filtro = (errors, extra) => errors.filter((x) => !/ERR_CONNECTION_REFUSED|ERR_FAILED/.test(x) || extra === false);

  /* ================= Pos-jogo sem helper: exemplo ================= */
  {
    const ctx = await mk();
    const errors = [];
    const page = await novoPage(ctx, errors);
    const resp = await page.goto(BASE + 'posjogo.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.pj-partida');
    await page.evaluate(() => document.fonts.ready);
    ok(`[${label}] posjogo.html responde 200`, resp.status() === 200);
    ok(`[${label}] nav com 7 links e Pós-jogo ativo`, (await navTxt(page)) === NAV7 && (await page.locator('.sitenav a[aria-current="page"]').innerText()).trim() === 'Pós-jogo');
    ok(`[${label}] banner EXEMPLO (dados fictícios) e instruções abertas`, /EXEMPLO/.test(await page.locator('#pj-fonte').innerText()) && /fictícios/.test(await page.locator('#pj-fonte').innerText()) && (await page.locator('#pj-como').evaluate((d) => d.open)));
    ok(`[${label}] 10 partidas de exemplo, todas marcadas EXEMPLO`, (await page.locator('.pj-partida').count()) === 10 && (await page.locator('.pj-partida .pj-tag-exemplo').count()) === 10);
    ok(`[${label}] cards de resumo (5) e tabelas por comp e por estilo`, (await page.locator('.pj-card').count()) === 5 && (await page.locator('#pj-por-comp tbody tr').count()) >= 3 && (await page.locator('#pj-por-estilo tbody tr').count()) >= 3);
    const primeira = page.locator('.pj-partida').first();
    ok(`[${label}] partida: colocação, nível, eliminação estimada (≈), ouro, board com estrelas e itens, aprimoramentos`, (await primeira.locator('.pj-col').innerText()).trim() === '1º' && /≈6-6/.test(await primeira.innerText()) && (await primeira.locator('.pj-un').count()) >= 6 && (await primeira.locator('.pj-estrelas').first().innerText()).includes('★') && (await primeira.locator('.pj-itens img').count()) >= 3 && /Aprimoramentos:/.test(await primeira.innerText()));
    const imgsQuebradas = await page.evaluate(() => [...document.querySelectorAll('.pj-partida img')].filter((i) => i.complete && i.naturalWidth === 0).length);
    ok(`[${label}] nenhuma imagem de campeão/item/traço quebrada`, imgsQuebradas === 0, String(imgsQuebradas));
    const det = primeira.locator('.pj-det');
    ok(`[${label}] análise da 1ª partida aberta: comp parecida, estilo, onde errou, o que a API não mostra`, (await det.evaluate((d) => d.open)) && /Comp salva mais parecida/i.test(await det.innerText()) && /Estratégia que parece ter sido seguida/i.test(await det.innerText()) && /Onde pode ter errado/i.test(await det.innerText()) && /não dá para saber/i.test(await det.innerText()));
    const textoTodas = await page.locator('#pj-lista').evaluate((e) => e.textContent);
    ok(`[${label}] achados citam o guia e a API não mostra ouro por rodada (sem inventar)`, /Guia: “/.test(textoTodas) && /Ouro a cada rodada/.test(textoTodas));
    ok(`[${label}] achado "morreu com ouro" aparece na partida com 38 de ouro`, /38 de ouro sobrando/.test(textoTodas));
    await page.locator('#pj-fila').selectOption('1100');
    ok(`[${label}] filtro por fila mantém as partidas`, (await page.locator('.pj-partida').count()) === 10);
    await page.locator('#pj-ultimas').selectOption('5');
    ok(`[${label}] últimas 5 no card`, /Últimas 5/i.test(await page.locator('#pj-cards').innerText()));
    ok(`[${label}] posjogo sem scroll horizontal`, (await overflowX(page)) <= 0, 'overflow=' + (await overflowX(page)));
    await shot(page, '1-posjogo-exemplo');
    await page.locator('.pj-partida').first().scrollIntoViewIfNeeded();
    await shot(page, '2-posjogo-partida', { fullPage: false });
    // importar arquivo
    await page.locator('#pj-arquivo').setInputFiles({ name: 'partidas.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ partidas: falsas.slice(0, 3) })) });
    await page.waitForFunction(() => /Arquivo importado/.test(document.querySelector('#pj-fonte').innerText));
    ok(`[${label}] importar partidas.json: 3 partidas reais, sem tag EXEMPLO`, (await page.locator('.pj-partida').count()) === 3 && (await page.locator('.pj-tag-exemplo').count()) === 0);
    await page.locator('#pj-arquivo').setInputFiles({ name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from('{{{ nao e json') });
    await page.waitForFunction(() => /JSON válido/.test(document.querySelector('#pj-fonte').innerText));
    ok(`[${label}] arquivo inválido mostra erro e não derruba a página`, (await page.locator('.pj-partida').count()) === 3);
    await page.reload();
    await page.waitForSelector('.pj-partida');
    ok(`[${label}] cópia do arquivo sobrevive ao recarregar (servidor off)`, /Arquivo importado|Cópia deste navegador/.test(await page.locator('#pj-fonte').innerText()) && (await page.locator('.pj-partida').count()) === 3);
    await page.locator('#pj-esquecer').click();
    await page.waitForFunction(() => /EXEMPLO/.test(document.querySelector('#pj-fonte').innerText));
    ok(`[${label}] "Esquecer dados deste navegador" volta ao exemplo`, (await page.locator('.pj-partida').count()) === 10);
    ok(`[${label}] sem erros no console além da conexão recusada esperada`, filtro(errors).length === 0, filtro(errors).slice(0, 3).join(' || '));
    await ctx.close();
  }

  /* ================= Pos-jogo e Plano com o servidor local ================= */
  {
    const ctx = await mk();
    const errors = [];
    const page = await novoPage(ctx, errors);
    await page.goto(BASE + 'posjogo.html?porta=' + PORTA);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.pj-partida');
    const banner = await page.locator('#pj-fonte').innerText();
    ok(`[${label}] com o helper local: "Dados reais", 10 partidas, sem EXEMPLO e instruções fechadas`, /Dados reais/.test(banner) && /10 partidas/.test(banner) && (await page.locator('.pj-tag-exemplo').count()) === 0 && !(await page.locator('#pj-como').evaluate((d) => d.open)));
    ok(`[${label}] CORS: localhost:8765 lê 127.0.0.1:${PORTA} sem erro de console`, errors.length === 0, errors.slice(0, 2).join(' || '));
    ok(`[${label}] a chave e o Riot ID nunca chegam ao navegador`, !/RGAPI-[0-9a-f]{8}-|Teste#BR1/.test(await page.content()) && !/RGAPI/.test(await page.evaluate(() => JSON.stringify(localStorage))));
    await shot(page, '3-posjogo-real');
    // plano com historico
    await page.goto(BASE + 'plano.html?porta=' + PORTA);
    await page.waitForSelector('.pl-comp');
    const fonte = await page.locator('#pl-fonte').innerText();
    ok(`[${label}] plano com histórico: "10 partidas lidas do helper local"`, /histórico: 10 partidas lidas do helper local/.test(fonte), fonte);
    ok(`[${label}] plano: 3 comps, cada uma com o porquê`, (await page.locator('.pl-comp').count()) === 3 && (await page.locator('.pl-comp').evaluateAll((els) => els.every((e) => e.querySelectorAll('.pl-m').length >= 2))));
    const textoPlano = await page.locator('#pl-comps').innerText();
    ok(`[${label}] plano usa o histórico pessoal (Você jogou N partidas… média, top 4)`, /Você jogou \d+ partidas? com essa comp: média/.test(textoPlano), textoPlano.slice(0, 200));
    ok(`[${label}] plano usa as notícias do patch (Buff/Nerf no patch)`, /(Buff|Nerf) no patch 18\.\d/.test(textoPlano));
    await shot(page, '4-plano-real');
    await ctx.close();
  }

  /* ================= Plano sem helper, compacto, estático ================= */
  {
    const ctx = await mk();
    const errors = [];
    const page = await novoPage(ctx, errors);
    const resp = await page.goto(BASE + 'plano.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.pl-comp');
    await page.evaluate(() => document.fonts.ready);
    ok(`[${label}] plano.html responde 200, nav 7 links e Plano ativo`, resp.status() === 200 && (await navTxt(page)) === NAV7 && (await page.locator('.sitenav a[aria-current="page"]').innerText()).trim() === 'Plano');
    ok(`[${label}] plano sem histórico avisa e aponta o Pós-jogo`, /sem histórico pessoal/.test(await page.locator('#pl-fonte').innerText()) && (await page.locator('#pl-fonte a[href="posjogo.html"]').count()) === 1);
    ok(`[${label}] estratégia Fast 8 padrão com trecho do guia`, /Fast 8 padrão/.test(await page.locator('#pl-estrategia').innerText()) && /8 no 4-2 com ~40/.test(await page.locator('#pl-estrategia').innerText()));
    const marcos = await page.locator('.pl-marco h3').allInnerTexts();
    ok(`[${label}] linha do tempo: 2-1, Fim do 2, 3-2, 4-1, 4-2 com badges`, marcos.join('|') === '2-1|Fim do 2|3-2|4-1|4-2' && (await page.locator('.pl-marco .act').count()) >= 8, marcos.join('|'));
    ok(`[${label}] plano sem scroll horizontal`, (await overflowX(page)) <= 0, 'overflow=' + (await overflowX(page)));
    await shot(page, '5-plano');
    const antes = await page.locator('#pl-comps').innerText();
    await page.waitForTimeout(1500);
    ok(`[${label}] plano estático: nada muda sozinho`, (await page.locator('#pl-comps').innerText()) === antes);
    await page.locator('#pl-compacto').click();
    ok(`[${label}] modo compacto esconde o porquê e continua com comps e linha do tempo`, !(await page.locator('.pl-porque').first().isVisible()) && (await page.locator('.pl-comp').first().isVisible()) && (await page.locator('.pl-marco').first().isVisible()));
    await shot(page, '6-plano-compacto');
    await page.reload();
    await page.waitForSelector('.pl-comp');
    ok(`[${label}] modo compacto persiste`, (await page.locator('#pl-compacto').getAttribute('aria-pressed')) === 'true');
    await page.locator('#pl-compacto').click();
    ok(`[${label}] plano sem erros no console além da conexão recusada esperada`, filtro(errors).length === 0, filtro(errors).slice(0, 3).join(' || '));
    // navegacao entre as paginas
    for (const [href, nome] of [['posjogo.html', 'Pós-jogo'], ['painel.html', 'Painel'], ['guia.html', 'Guia do Jogo'], ['estrategia.html', 'Estratégia padrão'], ['noticias.html', 'Notícias'], ['index.html', 'Comps'], ['plano.html', 'Plano']]) {
      await page.locator(`.sitenav a[href="${href}"]`).click();
      await page.waitForLoadState('domcontentloaded');
      const tx = await navTxt(page);
      const cur = (await page.locator('.sitenav a[aria-current="page"]').innerText()).trim();
      const ov = await overflowX(page);
      ok(`[${label}] nav -> ${href}: 7 links, ativo ${nome}, sem scroll horizontal`, tx === NAV7 && cur === nome && ov <= 0, `${cur} overflow=${ov}`);
    }
    const alturaNav = await page.locator('.sitenav').evaluate((n) => n.getBoundingClientRect().height);
    ok(`[${label}] nav ${mobile ? 'quebra em 2 linhas sem esconder links' : 'em 1 linha'}`, mobile ? alturaNav > 60 && alturaNav < 110 : alturaNav < 60, 'altura=' + Math.round(alturaNav));
    await ctx.close();
  }

  /* ================= Painel: voz, texto, faixas, grade recolhida ================= */
  {
    // grade recolhida por padrao (sem forcar abertura)
    const ctx0 = await mk();
    const e0 = [];
    const p0 = await novoPage(ctx0, e0);
    await p0.goto(BASE + 'painel.html');
    await p0.evaluate(() => localStorage.clear());
    await p0.reload();
    await p0.waitForSelector('.pn-card');
    ok(`[${label}] painel: grade de campeões recolhida por padrão`, !(await p0.locator('#pn-det-champs').evaluate((d) => d.open)) && !(await p0.locator('.pn-champ').first().isVisible()));
    await p0.locator('#pn-det-champs > summary').click();
    ok(`[${label}] painel: abrir a grade mostra os 74 campeões`, (await p0.locator('.pn-champ').first().isVisible()) && (await p0.locator('.pn-champ').count()) === 74);
    ok(`[${label}] painel: nav com 7 links`, (await navTxt(p0)) === NAV7);
    await ctx0.close();

    // voz com reconhecedor simulado
    const ctx = await mk();
    await ctx.addInitScript(STUB_VOZ('ouro 32 vida 70 rodada 3-2 nível 6'));
    const errors = [];
    const page = await novoPage(ctx, errors);
    await page.goto(BASE + 'painel.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.pn-card');
    const ini = await page.evaluate(() => JSON.parse(localStorage.getItem('tft-comps:painel:v1') || 'null'));
    ok(`[${label}] painel: botão de voz habilitado e sem aviso quando há SpeechRecognition`, !(await page.locator('#pn-mic').isDisabled()) && !(await page.locator('#pn-voz-aviso').isVisible()));
    await page.locator('#pn-mic').click();
    await page.waitForFunction(() => document.querySelector('#pn-ouro').value === '32');
    const v = await page.evaluate(() => ({ ouro: document.querySelector('#pn-ouro').value, vida: document.querySelector('#pn-vida').value, nivel: document.querySelector('#pn-nivel').value, rodada: `${document.querySelector('#pn-estagio').value}-${document.querySelector('#pn-rodada').value}` }));
    ok(`[${label}] voz: "ouro 32 vida 70 rodada 3-2 nível 6" preenche os campos`, v.ouro === '32' && v.vida === '70' && v.nivel === '6' && v.rodada === '3-2', JSON.stringify(v));
    ok(`[${label}] voz: mostra o que ouviu e o que aplicou`, /Ouvi:/.test(await page.locator('#pn-voz-res').innerText()) && (await page.locator('.pn-voz-chips li').count()) === 4);
    ok(`[${label}] voz: o botão volta para "Falar" depois de ouvir`, (await page.locator('#pn-mic').getAttribute('aria-pressed')) === 'false' && (await page.locator('#pn-mic-t').innerText()) === 'Falar');
    ok(`[${label}] faixas: ouro 32 acende 30–40 e vida 70 acende 41–79`, (await page.locator('[data-faixas="gold"] [aria-pressed="true"]').innerText()) === '30–40' && /41–79/.test(await page.locator('[data-faixas="hp"] [aria-pressed="true"]').innerText()));
    await shot(page, '7-painel-voz');
    await page.locator('#pn-voz-desfazer').click();
    const desf = await page.evaluate(() => document.querySelector('#pn-ouro').value);
    ok(`[${label}] voz: Desfazer volta o estado anterior`, desf !== '32' && /Desfeito/.test(await page.locator('#pn-voz-status').innerText()), 'ouro=' + desf);

    await page.fill('#pn-cmd', 'tenho dois Veigar comp solar yunara aprimoramento de economia 3 vitórias seguidas');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.pn-voz-chips li');
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('tft-comps:painel:v1')));
    ok(`[${label}] texto: "tenho dois Veigar" grava 2 cópias; comp, aprimoramento e streak entram`, st.champs.DA_18_Veigar === 2 && st.favorita === 'seed-20' && st.aprim === 'eco' && st.streak === 3, JSON.stringify({ c: st.champs, f: st.favorita, a: st.aprim, s: st.streak }));
    await page.fill('#pn-cmd', 'mais um Veigar');
    await page.locator('#pn-cmd-ok').click();
    ok(`[${label}] texto: "mais um Veigar" soma (3 cópias = 2★)`, (await page.evaluate(() => JSON.parse(localStorage.getItem('tft-comps:painel:v1')).champs.DA_18_Veigar)) === 3);
    await page.fill('#pn-cmd', 'comp vivaz');
    await page.locator('#pn-cmd-ok').click();
    await page.waitForSelector('.pn-voz-amb button');
    const opcoes = await page.locator('.pn-voz-amb button').count();
    ok(`[${label}] comp ambígua pergunta qual (${opcoes} opções) e aplica a escolhida`, opcoes >= 2);
    await page.locator('.pn-voz-amb button').first().click();
    ok(`[${label}] escolha da comp ambígua vira favorita`, (await page.evaluate(() => JSON.parse(localStorage.getItem('tft-comps:painel:v1')).favorita)) !== 'seed-20' && (await page.locator('.pn-voz-amb').count()) === 0);
    await page.fill('#pn-cmd', 'blá blá blá');
    await page.locator('#pn-cmd-ok').click();
    ok(`[${label}] frase sem sentido: "Nada aplicado" e "Não entendi", sem mexer no estado`, /Nada aplicado/.test(await page.locator('#pn-voz-status').innerText()) && /Não entendi/.test(await page.locator('#pn-voz-res').innerText()));

    // faixas
    await page.locator('[data-faixas="gold"] button', { hasText: '50+' }).click();
    ok(`[${label}] faixa de ouro 50+ define 50`, (await page.locator('#pn-ouro').inputValue()) === '50');
    await page.locator('[data-faixas="hp"] button', { hasText: 'Folga' }).click();
    ok(`[${label}] faixa de vida Folga define 90`, (await page.locator('#pn-vida').inputValue()) === '90');
    await page.locator('#pn-ouro').fill('27');
    ok(`[${label}] número exato continua valendo e acende a faixa 20–30`, (await page.locator('[data-faixas="gold"] [aria-pressed="true"]').innerText()) === '20–30');
    ok(`[${label}] painel sem scroll horizontal`, (await overflowX(page)) <= 0, 'overflow=' + (await overflowX(page)));
    ok(`[${label}] painel sem erros no console`, errors.length === 0, errors.slice(0, 3).join(' || '));
    await ctx.close();

    // erro de rede do servico de voz (Brave) com navegador que finge Brave
    const ctxB = await mk();
    await ctxB.addInitScript(STUB_VOZ('', 'network'));
    await ctxB.addInitScript(() => { Object.defineProperty(navigator, 'brave', { value: { isBrave: () => Promise.resolve(true) } }); });
    const eb = [];
    const pb = await novoPage(ctxB, eb);
    await pb.goto(BASE + 'painel.html');
    await pb.waitForSelector('.pn-card');
    ok(`[${label}] Brave: aviso claro antes de tentar (usar Chrome ou Edge)`, (await pb.locator('#pn-voz-aviso').isVisible()) && /Chrome/.test(await pb.locator('#pn-voz-aviso').innerText()) && /Edge/.test(await pb.locator('#pn-voz-aviso').innerText()));
    await pb.locator('#pn-mic').click();
    await pb.waitForFunction(() => /Chrome|Edge/.test(document.querySelector('#pn-voz-status').innerText));
    await pb.waitForFunction(() => document.querySelector('#pn-mic-t').innerText === 'Falar');
    ok(`[${label}] Brave: erro "network" vira mensagem clara e o painel continua funcionando`, (await pb.locator('#pn-mic-t').innerText()) === 'Falar');
    await pb.fill('#pn-cmd', 'ouro 44');
    await pb.keyboard.press('Enter');
    ok(`[${label}] Brave: o comando digitado continua funcionando`, (await pb.locator('#pn-ouro').inputValue()) === '44');
    await shot(pb, '8-painel-brave');
    ok(`[${label}] Brave: sem erro de JavaScript`, eb.filter((x) => /PAGEERROR/.test(x)).length === 0, eb.join(' || '));
    await ctxB.close();

    // navegador sem SpeechRecognition
    const ctxN = await mk();
    await ctxN.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true }); Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true }); });
    const en = [];
    const pn = await novoPage(ctxN, en);
    await pn.goto(BASE + 'painel.html');
    await pn.waitForSelector('.pn-card');
    ok(`[${label}] sem suporte: botão de voz desabilitado e aviso diz para usar Chrome ou Edge`, (await pn.locator('#pn-mic').isDisabled()) && /Chrome ou o Edge/.test(await pn.locator('#pn-voz-aviso').innerText()));
    await pn.fill('#pn-cmd', 'vida 55');
    await pn.locator('#pn-cmd-ok').click();
    ok(`[${label}] sem suporte: digitar o comando funciona`, (await pn.locator('#pn-vida').inputValue()) === '55');
    ok(`[${label}] sem suporte: sem erro no console`, en.length === 0, en.join(' || '));
    await ctxN.close();
  }
}

(async () => {
  const servidor = subirServidor();
  const subiu = await aguardarServidor();
  ok('servidor local so-leitura sobe em 127.0.0.1:' + PORTA, subiu);
  const browser = await chromium.launch({ executablePath: exe });
  try {
    await run(browser, '1440', { width: 1440, height: 900 }, false, servidor);
    await run(browser, '390', { width: 390, height: 844 }, true, servidor);
  } finally {
    await browser.close();
    servidor.proc.kill();
    try { fs.rmSync(servidor.dir, { recursive: true, force: true }); } catch (e) { /* tmp */ }
  }
  const fail = results.filter((r) => !r.pass);
  fs.writeFileSync(path.join(OUT, 'resultado-pos-plano-voz.json'), JSON.stringify({ total: results.length, falhas: fail.length, results }, null, 2));
  console.log(`\n${results.length - fail.length}/${results.length} ok`);
  process.exit(fail.length ? 1 : 0);
})();
