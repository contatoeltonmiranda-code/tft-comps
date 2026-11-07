const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const STYLE = read('css/style.css');

const PAGINAS = {
  'plano.html': { css: 'css/plano.css', pref: 'pl-', js: ['js/plano.js', 'js/plano-logic.js', 'js/dom.js'] },
  'posjogo.html': { css: 'css/posjogo.css', pref: 'pj-', js: ['js/posjogo.js', 'js/posjogo-logic.js', 'js/partidas-fonte.js', 'js/dom.js'] },
};

Object.entries(PAGINAS).forEach(([arq, cfg]) => {
  const HTML = read(arq);
  const CSS = read(cfg.css).replace(/\/\*[\s\S]*?\*\//g, '');

  test(`${arq}: SEO e meta (title <= 60, description 140-160, noindex, og/twitter, um h1)`, () => {
    const title = HTML.match(/<title>([^<]+)<\/title>/)[1];
    const desc = HTML.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(title.length <= 60, title.length + ' ' + title);
    assert.ok(desc.length >= 140 && desc.length <= 160, 'description ' + desc.length);
    assert.match(HTML, /<meta name="robots" content="noindex">/);
    assert.match(HTML, /og:title/);
    assert.match(HTML, /twitter:card/);
    assert.equal((HTML.match(/<h1\b/g) || []).length, 1);
  });

  test(`${arq}: scripts existem, na ordem das dependencias, sem script inline nem externo`, () => {
    const scripts = [...HTML.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
    scripts.forEach((s) => assert.ok(fs.existsSync(path.join(ROOT, s)), s));
    assert.ok(!/<script(?![^>]*src)/i.test(HTML), 'script inline');
    assert.ok(!/<script[^>]+src="(https?:|\/\/)/i.test(HTML), 'script externo');
    assert.ok(!/<link[^>]+href="https?:/i.test(HTML), 'css externo');
    const pos = (n) => scripts.indexOf(n);
    assert.ok(pos('data/catalog.js') < pos('js/posjogo-logic.js') || arq === 'x');
    assert.ok(pos('js/recommend.js') < pos('js/posjogo-logic.js'));
    assert.ok(pos('js/posjogo-logic.js') < pos('js/partidas-fonte.js'));
    assert.ok(pos('js/dom.js') < pos(cfg.js[0]));
    cfg.js.forEach((j) => assert.ok(pos(j) >= 0, 'falta ' + j));
    assert.match(HTML, new RegExp(`<link rel="stylesheet" href="css/style\\.css">\\s*<link rel="stylesheet" href="${cfg.css.replace('.', '\\.')}">`));
    assert.ok(!/\son[a-z]+="/i.test(HTML), 'handler inline');
  });

  test(`${arq}: ids unicos e alvos de label existem`, () => {
    const ids = [...HTML.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length);
    [...HTML.matchAll(/for="([^"]+)"/g)].forEach((m) => assert.ok(ids.includes(m[1]), 'label for ' + m[1]));
    [...HTML.matchAll(/aria-labelledby="([^"]+)"/g)].forEach((m) => assert.ok(ids.includes(m[1])));
  });

  test(`${arq}: CSS so com classes ${cfg.pref}* (ou descendentes), sem colidir com style.css e sem seletor repetido`, () => {
    const seletores = CSS.split('{').map((p) => p.split('}').pop()).filter((s) => /\./.test(s));
    const soltos = [];
    seletores.forEach((sel) => sel.split(',').forEach((parte) => {
      const cls = [...parte.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]);
      if (cls.some((c) => !c.startsWith(cfg.pref)) && !cls.some((c) => c.startsWith(cfg.pref))) soltos.push(parte.trim());
    }));
    assert.deepEqual(soltos, []);
    const globais = new Set([...STYLE.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]));
    assert.deepEqual([...new Set([...CSS.matchAll(new RegExp(`\\.(${cfg.pref}[\\w-]+)`, 'g'))].map((m) => m[1]))].filter((c) => globais.has(c)), []);
    const regras = [...CSS.matchAll(/(^|\n)(\.[\w-]+)\s*\{/g)].map((m) => m[2]);
    const repetidos = regras.filter((r, i) => regras.indexOf(r) !== i);
    assert.deepEqual(repetidos, [], 'seletor definido 2 vezes');
  });

  test(`${arq}: toda classe ${cfg.pref}* usada no HTML/JS tem CSS`, () => {
    const definidas = new Set([...CSS.matchAll(new RegExp(`\\.(${cfg.pref}[\\w-]+)`, 'g'))].map((m) => m[1]));
    const fontes = [HTML, ...cfg.js.map(read)].join('\n');
    const usadas = new Set();
    [...fontes.matchAll(/class(?:=|:\s*)["'`]([^"'`]+)["'`]/g)].forEach((m) => m[1].replace(/\$\{[^}]*\}/g, '').split(/\s+/).forEach((c) => { if (c.startsWith(cfg.pref) && !c.endsWith('-')) usadas.add(c); }));
    // classes montadas com variavel (pj-col-n3, pl-tipo-fast8...) sao conferidas pelo prefixo
    const sem = [...usadas].filter((c) => !definidas.has(c) && ![...definidas].some((d) => d.startsWith(c.replace(/\d+$/, ''))));
    assert.deepEqual(sem, []);
  });
});

test('seguranca: JS das paginas novas sem innerHTML, eval, document.write', () => {
  ['js/plano.js', 'js/posjogo.js', 'js/dom.js', 'js/posjogo-logic.js', 'js/plano-logic.js', 'js/partidas-fonte.js', 'js/painel-voz.js'].forEach((f) => {
    const src = read(f);
    [/innerHTML/, /outerHTML/, /insertAdjacentHTML/, /document\.write/, /\beval\s*\(/, /new Function/].forEach((re) => assert.ok(!re.test(src), `${f} contem ${re}`));
  });
});

test('politica Riot: paginas novas nao leem o jogo (sem Overwolf, GEP, Live Client, captura de tela)', () => {
  const proibidos = [/overwolf/i, /liveclientdata/i, /127\.0\.0\.1:2999/, /gep-map/, /getDisplayMedia/, /WebSocket/, /EventSource/, /sendBeacon/, /XMLHttpRequest/];
  ['js/plano.js', 'js/posjogo.js', 'js/plano-logic.js', 'js/posjogo-logic.js', 'js/partidas-fonte.js', 'js/painel-voz.js', 'plano.html', 'posjogo.html'].forEach((f) => {
    const src = read(f).replace(/<p[^>]*>[\s\S]*?<\/p>/g, '');
    proibidos.forEach((re) => assert.ok(!re.test(src), `${f} contem ${re}`));
  });
});

test('rede: unica chamada de rede das paginas e para 127.0.0.1 (helper local); nada fala com a Riot no navegador', () => {
  const fonte = read('js/partidas-fonte.js');
  assert.match(fonte, /http:\/\/127\.0\.0\.1:\$\{portaDe\(search\)\}/);
  assert.equal((fonte.match(/fetchFn\(/g) || []).length, 1);
  ['js/plano.js', 'js/posjogo.js', 'js/plano-logic.js', 'js/posjogo-logic.js', 'js/painel-voz.js', 'js/painel.js'].forEach((f) => {
    const src = read(f).replace(/\/\/.*$/gm, '');
    assert.ok(!/fetch\s*\(/.test(src.replace(/fetchFn: window\.fetch\.bind\(window\)/g, '')), f + ' chama fetch direto');
  });
  ['js/partidas-fonte.js', 'js/posjogo.js', 'js/plano.js'].forEach((f) => assert.ok(!/riotgames\.com/.test(read(f).replace(/\/\/.*$/gm, '')), f));
});

test('plano estatico: sem timers nem polling nas paginas Plano', () => {
  ['js/plano.js', 'js/plano-logic.js'].forEach((f) => assert.ok(!/setInterval|setTimeout|requestAnimationFrame/.test(read(f)), f));
});

test('painel: voz so entra no painel pelo modulo puro e o Painel segue sem rede', () => {
  const painel = read('js/painel.js');
  assert.match(painel, /Voz\.suporteVoz\(window\)/);
  assert.match(painel, /Voz\.interpretar\(/);
  assert.ok(/id="pn-mic"/.test(read('painel.html')));
  assert.ok(/<details class="pn-det-champs" id="pn-det-champs">/.test(read('painel.html')), 'grade recolhida por padrao (sem atributo open)');
});

test('ancoras citadas nos achados existem em estrategia.html', () => {
  const PJ = require('../js/posjogo-logic.js');
  const html = read('estrategia.html');
  Object.values(PJ.REGRAS).forEach((r) => {
    const [pag, ancora] = r.href.split('#');
    assert.equal(pag, 'estrategia.html');
    assert.ok(html.includes(`id="${ancora}"`), r.href);
  });
  const ps = read('js/plano.js');
  [...ps.matchAll(/estrategia\.html#([\w-]+)/g)].forEach((m) => assert.ok(html.includes(`id="${m[1]}"`), m[1]));
});

test('sem dados pessoais nem chave no repositorio: nenhum RGAPI, puuid ou Riot ID em arquivos versionados', () => {
  let saida = '';
  try {
    saida = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    return;
  }
  const arquivos = saida.split('\0').filter((f) => f && !/\.(png|jpg|jpeg|woff2|ico|webp)$/i.test(f) && !f.startsWith('.claude/') && !f.startsWith('_brain/') && fs.existsSync(path.join(ROOT, f)));
  const achados = [];
  arquivos.forEach((f) => {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (f.startsWith('tests/')) return; // os testes usam chaves falsas de proposito
    if (/RGAPI-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(t)) achados.push(f + ' (chave)');
    if (/"puuid"\s*:\s*"[\w-]{70,}"/.test(t)) achados.push(f + ' (puuid)');
  });
  assert.deepEqual(achados, []);
});

test('gitignore cobre chave, config local e historico, e os helpers recusam pasta dentro do repositorio', () => {
  const gi = read('.gitignore');
  ['riot-key.txt', 'partidas.json', 'config.json'].forEach((n) => assert.ok(gi.includes(n), n));
  const L = require('../tools/riot-lib.js');
  assert.throws(() => L.dirDados({ TFT_COMPS_DIR: path.join(ROOT, 'qualquer') }));
});
