const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../js/logic.js');

const rd = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

// ---------------------------------------------------------------- debounce (logica da busca do topo)
test('debounce: varias chamadas seguidas rodam uma vez, com os argumentos da ultima', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [];
  const d = L.debounce((x) => calls.push(x), 100);
  d('k'); d('ka'); d('kar');
  assert.deepEqual(calls, []);
  t.mock.timers.tick(99);
  assert.deepEqual(calls, []);
  t.mock.timers.tick(1);
  assert.deepEqual(calls, ['kar']);
  t.mock.timers.tick(500);
  assert.equal(calls.length, 1);
});

test('debounce: nova chamada reinicia a espera', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let n = 0;
  const d = L.debounce(() => { n++; }, 100);
  d();
  t.mock.timers.tick(80);
  d();
  t.mock.timers.tick(80);
  assert.equal(n, 0);
  t.mock.timers.tick(20);
  assert.equal(n, 1);
});

test('debounce: cancel descarta a chamada pendente e flush roda na hora', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let n = 0;
  const d = L.debounce(() => { n++; }, 100);
  d();
  d.cancel();
  t.mock.timers.tick(200);
  assert.equal(n, 0);
  d();
  d.flush();
  assert.equal(n, 1);
  t.mock.timers.tick(200);
  assert.equal(n, 1, 'flush nao pode deixar uma segunda execucao agendada');
  d.flush();
  assert.equal(n, 1, 'flush sem pendencia nao roda nada');
});

// ---------------------------------------------------------------- imagens: toda <img> gerada e lazy + decoding async + tamanho
function imgLiterais(src) {
  // pega cada h('img', { ... }) ate a chave que fecha o objeto de atributos
  const out = [];
  const re = /h\('img',\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex, depth = 1;
    while (i < src.length && depth) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
    out.push(src.slice(m.index, i));
  }
  return out;
}

['js/posjogo.js', 'js/noticias.js'].forEach((arq) => {
  test(`${arq}: toda <img> tem loading lazy, decoding async, width e height`, () => {
    const lits = imgLiterais(rd(arq));
    assert.ok(lits.length >= 1, 'nenhuma <img> achada');
    lits.forEach((l) => {
      assert.match(l, /loading:\s*'lazy'/, 'sem lazy: ' + l);
      assert.match(l, /decoding:\s*'async'/, 'sem decoding: ' + l);
      assert.match(l, /width:/, 'sem width: ' + l);
      assert.match(l, /height:/, 'sem height: ' + l);
    });
  });
});

test('js/app.js: o helper img() sempre gera lazy + decoding async + width/height (sem parametro opcional)', () => {
  const js = rd('js/app.js');
  const corpo = js.slice(js.indexOf('function img('), js.indexOf('function itemImg('));
  assert.match(corpo, /loading:\s*'lazy'/);
  assert.ok(!/lazy\s*\?/.test(corpo), 'lazy ainda e condicional');
  assert.match(corpo, /decoding:\s*'async'/);
  assert.match(corpo, /width:\s*size/);
  assert.match(corpo, /height:\s*size/);
  assert.ok(!/h\('img'/.test(js.replace(corpo, '')), 'ha <img> criada fora do helper img()');
});

// ---------------------------------------------------------------- CSS do card pendente
test('style.css: card pendente reserva altura (min-height) para a rolagem nao encolher; .comp nao usa content-visibility', () => {
  const css = rd('css/style.css');
  const m = css.match(/\n\.comp\[data-pend\]\{min-height:(\d+)px\}/);
  assert.ok(m, 'falta .comp[data-pend]{min-height:<n>px}');
  assert.ok(Number(m[1]) >= 500 && Number(m[1]) <= 1000, 'altura reservada fora do plausivel: ' + m[1]);
  // medido: com a hidratacao, content-visibility nao deu ganho e deslocou o desenho em ate 1px (paint containment); o desenho do card tem de ficar pixel a pixel igual ao de antes
  const regra = css.match(/\n\.comp\{([^}]*)\}/);
  assert.ok(regra && !/content-visibility|contain:/.test(regra[1]), '.comp ganhou content-visibility/contain');
});

// ---------------------------------------------------------------- busca do topo nao renderiza a cada tecla
test('app.js: o campo de busca do topo usa debounce e render() cancela a pendencia', () => {
  const js = rd('js/app.js');
  assert.match(js, /const renderSoon = L\.debounce\(render,\s*\d+\)/);
  assert.match(js, /\$\('#q'\)\.addEventListener\('input',[^\n]*renderSoon\(\)/);
  const corpo = js.slice(js.indexOf('function render() {'), js.indexOf('/* ---------- dialogs genericos'));
  assert.match(corpo, /renderSoon\.cancel\(\)/);
});

// ---------------------------------------------------------------- hidratacao dos cards (so o que esta perto da tela nasce completo)
test('createHydrator: os N primeiros hidratam na hora, o resto fica pendente ate now() ou all()', () => {
  const feitos = [];
  const hy = L.createHydrator((x) => feitos.push(x));
  hy.reset(['a', 'b', 'c', 'd', 'e'], 2);
  assert.deepEqual(feitos, ['a', 'b']);
  assert.equal(hy.pending(), 3);
  hy.all();
  assert.deepEqual(feitos, ['a', 'b', 'c', 'd', 'e']);
  assert.equal(hy.pending(), 0);
  hy.all();
  assert.equal(feitos.length, 5, 'all() repetido nao hidrata de novo');
});

test('createHydrator: now() hidrata fora de ordem e nunca duas vezes o mesmo item', () => {
  const feitos = [];
  const hy = L.createHydrator((x) => feitos.push(x));
  hy.reset(['a', 'b', 'c', 'd'], 1);
  hy.now('c');
  hy.now('c');
  assert.deepEqual(feitos, ['a', 'c']);
  hy.all();
  assert.deepEqual(feitos, ['a', 'c', 'b', 'd']);
});

test('createHydrator: reset descarta a lista anterior (render novo da busca)', () => {
  const feitos = [];
  const hy = L.createHydrator((x) => feitos.push(x));
  hy.reset(['a', 'b', 'c'], 1);
  hy.reset(['x', 'y'], 1);
  hy.now('b');
  hy.all();
  assert.deepEqual(feitos, ['a', 'x', 'y'], 'item de lista antiga nao hidrata');
  assert.equal(hy.pending(), 0);
});

test('createHydrator: lista menor que o limite hidrata tudo e item desconhecido e ignorado', () => {
  const feitos = [];
  const hy = L.createHydrator((x) => feitos.push(x));
  hy.reset(['a', 'b'], 4);
  assert.deepEqual(feitos, ['a', 'b']);
  hy.now('zzz');
  assert.deepEqual(feitos, ['a', 'b']);
  assert.equal(hy.pending(), 0);
});

test('app.js: card pendente nasce so com o cabecalho; corpo (fases, campeoes, tabuleiro) hidrata perto da tela, no Ctrl+F e na impressao', () => {
  const js = rd('js/app.js');
  assert.match(js, /L\.createHydrator\(/);
  assert.match(js, /new IntersectionObserver\(/);
  assert.match(js, /'data-pend'/);
  assert.match(js, /hydrator\.all\(\)/);
  assert.match(js, /addEventListener\('beforeprint'/);
  assert.match(js, /e\.key === 'F3'|key === 'F3'/);
  const css = rd('css/style.css');
  assert.match(css, /\.comp\[data-pend\]/, 'falta regra para o card ainda pendente');
});
