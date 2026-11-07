const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const HTML = read('painel.html');
const CSS = read('css/painel.css').replace(/\/\*[\s\S]*?\*\//g, '');
const STYLE = read('css/style.css');
const JS_FILES = ['js/painel.js', 'js/painel-logic.js', 'js/painel-comps.js', 'js/painel-regras.js'];

test('politica: o painel e 100% manual, sem rede, sem Overwolf, sem captura de tela, sem API do jogo', () => {
  const proibidos = [/overwolf/i, /fetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /getDisplayMedia/, /liveclientdata/i, /127\.0\.0\.1:2999/, /gep-map/, /GEP/, /augment/i, /EventSource/];
  JS_FILES.forEach((f) => {
    const src = read(f);
    proibidos.forEach((re) => assert.ok(!re.test(src), `${f} contem ${re}`));
  });
  // o HTML pode dizer "sem Overwolf" no texto, mas nao pode carregar nada do overwolf-app/ nem de fora
  assert.ok(!/overwolf-app|gep-map|recommend-overlay/.test(HTML), 'HTML referencia codigo do Overwolf');
  assert.ok(!/<script[^>]+src="(https?:|\/\/)/i.test(HTML), 'script externo');
  assert.ok(!/<link[^>]+href="https?:/i.test(HTML), 'css externo');
  assert.ok(!/<(iframe|video|canvas|object|embed)/i.test(HTML), 'elemento de captura ou embed');
});

test('seguranca: texto sempre por textContent (sem innerHTML, eval, document.write, handlers inline)', () => {
  JS_FILES.forEach((f) => {
    const src = read(f);
    [/innerHTML/, /outerHTML/, /insertAdjacentHTML/, /document\.write/, /\beval\s*\(/, /new Function/].forEach((re) => assert.ok(!re.test(src), `${f} contem ${re}`));
  });
  assert.ok(!/\son[a-z]+="/i.test(HTML), 'handler inline no HTML');
  assert.ok(!/<script(?![^>]*src)/i.test(HTML), 'script inline');
});

test('pagina: scripts na ordem das dependencias e todos os arquivos existem', () => {
  const scripts = [...HTML.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  scripts.forEach((s) => assert.ok(fs.existsSync(path.join(ROOT, s)), s));
  const pos = (n) => scripts.indexOf(n);
  assert.ok(pos('data/catalog.js') < pos('js/painel-logic.js'));
  assert.ok(pos('data/seed.js') < pos('js/painel.js'));
  assert.ok(pos('js/recommend.js') < pos('js/painel-comps.js'));
  assert.ok(pos('js/painel-regras.js') < pos('js/painel-logic.js'));
  assert.ok(pos('js/painel-comps.js') < pos('js/painel-logic.js'));
  assert.ok(pos('js/painel-logic.js') < pos('js/painel.js'));
  assert.ok(pos('js/logic.js') < pos('js/painel.js'));
  assert.match(HTML, /<link rel="stylesheet" href="css\/style\.css">\s*<link rel="stylesheet" href="css\/painel\.css">/);
});

test('css: nenhuma regra de painel.css mira classe global sozinha (so descendentes de uma classe pn-)', () => {
  const blocos = CSS.split('{').map((p) => p.split('}').pop()).filter((s) => /\./.test(s));
  const soltos = [];
  blocos.forEach((sel) => sel.split(',').forEach((parte) => {
    const classes = [...parte.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]);
    if (classes.some((c) => !c.startsWith('pn-')) && !classes.some((c) => c.startsWith('pn-'))) soltos.push(parte.trim());
  }));
  assert.deepEqual(soltos, []);
  // e nenhuma classe pn- colide com algo ja definido em style.css
  const globais = new Set([...STYLE.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]));
  const colidem = [...new Set([...CSS.matchAll(/\.(pn-[\w-]+)/g)].map((m) => m[1]))].filter((c) => globais.has(c));
  assert.deepEqual(colidem, []);
});

test('classes novas do JS e do HTML tem prefixo pn- ou vem do style.css', () => {
  const definidasGlobais = new Set([...STYLE.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]));
  const usadas = new Set();
  [...HTML.matchAll(/class="([^"]+)"/g)].forEach((m) => m[1].split(/\s+/).forEach((c) => usadas.add(c)));
  const js = read('js/painel.js');
  [...js.matchAll(/class: '([^']+)'/g), ...js.matchAll(/class: `([^`]+)`/g)].forEach((m) => m[1].replace(/\$\{[^}]*\}/g, '').split(/\s+/).filter(Boolean).forEach((c) => usadas.add(c)));
  [...js.matchAll(/ACT = \{([^}]+)\}/g)].forEach((m) => [...m[1].matchAll(/'(act-[a-z]+)'/g)].forEach((x) => usadas.add(x[1])));
  const estranhas = [...usadas].filter((c) => !c.startsWith('pn-') && !definidasGlobais.has(c));
  assert.deepEqual(estranhas, []);
});

function classesUsadas() {
  const js = read('js/painel.js');
  const estaticas = new Set();
  const prefixos = new Set();
  const add = (txt) => {
    [...txt.matchAll(/\$\{([^}]*)\}/g)].forEach((e) => [...e[1].matchAll(/pn-[\w-]+/g)].forEach((m) => estaticas.add(m[0])));
    txt.replace(/\$\{[^}]*\}/g, '${}').split(/\s+/).filter(Boolean).forEach((c) => {
      if (!c.startsWith('pn-')) return;
      if (c.includes('${}')) prefixos.add(c.split('${}')[0]);
      else estaticas.add(c);
    });
  };
  [...HTML.matchAll(/class="([^"]+)"/g)].forEach((m) => add(m[1]));
  [...js.matchAll(/class: '([^']+)'/g), ...js.matchAll(/class: `([^`]+)`/g)].forEach((m) => add(m[1]));
  return { estaticas, prefixos };
}

test('css: toda classe pn- usada no HTML/JS existe em painel.css e nao sobra regra morta', () => {
  const definidas = new Set([...CSS.matchAll(/\.(pn-[\w-]+)/g)].map((m) => m[1]));
  const { estaticas, prefixos } = classesUsadas();
  const sem = [...estaticas].filter((c) => !definidas.has(c));
  assert.deepEqual(sem, [], 'usadas sem CSS');
  prefixos.forEach((p) => assert.ok([...definidas].some((d) => d.startsWith(p)), 'prefixo dinamico sem CSS: ' + p));
  const classesJs = read('js/painel.js');
  const mortas = [...definidas].filter((d) => !estaticas.has(d) && ![...prefixos].some((p) => d.startsWith(p)) && !classesJs.includes(d));
  assert.deepEqual(mortas, [], 'regras sem uso');
});

test('o mesmo nome de classe nao e usado para dois elementos de papel diferente (bug do .item)', () => {
  // regressao: .pn-top foi usado no cabecalho e na lista de comps e zerou o padding do cabecalho
  const regras = [...CSS.matchAll(/(^|\n)(\.pn-[\w-]+)\s*\{([^}]*)\}/g)].map((m) => ({ sel: m[2], corpo: m[3] }));
  const contagem = {};
  regras.forEach((r) => { contagem[r.sel] = (contagem[r.sel] || 0) + 1; });
  const repetidos = Object.keys(contagem).filter((k) => contagem[k] > 1);
  assert.deepEqual(repetidos, [], 'seletor definido 2 vezes: ' + repetidos.join(', '));
  assert.ok(!/<header class="top pn-top"/.test(HTML));
});

test('ids do HTML sao unicos e os alvos de label existem', () => {
  const ids = [...HTML.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'ids repetidos: ' + ids.filter((x, i) => ids.indexOf(x) !== i).join());
  [...HTML.matchAll(/for="([^"]+)"/g)].forEach((m) => assert.ok(ids.includes(m[1]), 'label for ' + m[1]));
  [...HTML.matchAll(/aria-labelledby="([^"]+)"/g)].forEach((m) => m[1].split(/\s+/).forEach((id) => assert.ok(ids.includes(id), 'aria-labelledby ' + id)));
});

test('SEO e meta: title <= 60, description 140-160, noindex, og/twitter, um h1', () => {
  const title = HTML.match(/<title>([^<]+)<\/title>/)[1];
  const desc = HTML.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.ok(title.length <= 60, title.length + ' ' + title);
  assert.ok(desc.length >= 140 && desc.length <= 160, 'description ' + desc.length);
  assert.match(HTML, /<meta name="robots" content="noindex">/);
  assert.match(HTML, /og:title/);
  assert.match(HTML, /twitter:card/);
  assert.equal((HTML.match(/<h1\b/g) || []).length, 1);
});

test('layout: DOM com entrada antes da saida (teclado) e CSS inverte no mobile', () => {
  assert.ok(HTML.indexOf('id="pn-entrada"') < HTML.indexOf('id="pn-saida"'));
  assert.match(CSS, /\.pn-saida\{order:-1/);
  assert.match(CSS, /@media \(min-width:1000px\)\{[^}]*\.pn-layout\{grid-template-columns:minmax\(360px,430px\) minmax\(0,1fr\)\}/);
});

test('localStorage usa a chave tft-comps:painel:v1', () => {
  assert.match(read('js/painel-logic.js'), /'tft-comps:painel:v1'/);
});

test('comps do ranking: painel.js le a lista atual do Elton (carregarComps) e nunca grava nela', () => {
  const src = read('js/painel.js');
  assert.match(src, /CompsApi\.carregarComps\(/);
  assert.match(src, /STORAGE_KEY_COMPS/);
  assert.ok(!/seed:\s*window\.TFT_SEED\b/.test(src), 'dados.seed nao pode ser so o seed');
  assert.ok(!/setItem\([^)]*STORAGE_KEY_COMPS/.test(src), 'o painel so le a lista de comps');
  assert.ok(!/removeItem|localStorage\.clear/.test(src), 'o painel nao apaga armazenamento');
  assert.match(src, /addEventListener\('storage'/, 'acompanha mudancas feitas na pagina Comps em outra aba');
});
