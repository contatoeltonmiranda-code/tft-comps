const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

const catalog = {
  champs: [
    { id: 'rk', n: 'Rakan', c: 4, t: [] },
    { id: 'ta', n: 'Taric', c: 2, t: [] },
    { id: 'km', n: "Kog'Maw", c: 3, t: [] },
    { id: 'sv', n: 'Sivir', c: 1, t: [] },
    { id: 'rs', n: "Rek'Sai", c: 2, t: [] },
    { id: 'da', n: 'Dragão Ancião', c: 5, t: [] },
    { id: 'si', n: 'Sion', c: 1, t: [] },
    { id: 'sj', n: 'Sejuani', c: 2, t: [] },
    { id: 'sn', n: 'Senna', c: 2, t: [] },
  ],
  traits: [{ id: 'sol', n: 'Solar', bp: [2] }],
  items: [{ id: 'i1', n: 'Lâmina Mortal', k: 'completo' }],
};
const u = (c, extra = {}) => ({ c, s: 1, i: [], a: [], ...extra });
const comps = [
  { id: 'a', nome: 'Comp A', main: [u('rk'), u('sv')], flex: [u('ta')], fases: { inicio: ['km'], meio: ['rk'] } },
  { id: 'b', nome: 'Comp B', main: [u('rk'), u('ta')], flex: [] },
  { id: 'c', nome: 'Comp C', main: [u('sv')], flex: [] },
  { id: 'd', nome: 'Comp D', main: [u('km', { i: ['i1'] })], flex: [u('sv')] },
  { id: 'e', nome: 'Solar E', main: [u('si')], flex: [] },
];
const ids = (r) => r.results.map((x) => x.comp.id);

test('parse: virgula, espaco e + separam campeoes', () => {
  ['rakan, taric', 'rakan taric', 'rakan + taric', 'RAKAN,Taric', ' rakan ,, taric '].forEach((q) => {
    const p = L.parseChampQuery(q, catalog);
    assert.deepEqual(p.groups.map((g) => g.ids), [['rk'], ['ta']], q);
  });
});

test('parse: nomes com espaco e apostrofo, sem acento', () => {
  assert.deepEqual(L.parseChampQuery('kog maw sivir', catalog).groups.map((g) => g.ids), [['km'], ['sv']]);
  assert.deepEqual(L.parseChampQuery("kog'maw + rek sai", catalog).groups.map((g) => g.ids), [['km'], ['rs']]);
  assert.deepEqual(L.parseChampQuery('dragao anciao, taric', catalog).groups.map((g) => g.ids), [['da'], ['ta']]);
  assert.deepEqual(L.parseChampQuery('dragao anciao taric', catalog).groups.map((g) => g.ids), [['da'], ['ta']]);
});

test('parse: parcial por prefixo; ambiguo guarda todos os candidatos', () => {
  assert.deepEqual(L.parseChampQuery('rak, tar', catalog).groups.map((g) => g.ids), [['rk'], ['ta']]);
  const g = L.parseChampQuery('se, taric', catalog).groups[0];
  assert.deepEqual([...g.ids].sort(), ['sj', 'sn']);
});

test('parse: nome exato vence prefixo (Sion nao puxa outros)', () => {
  assert.deepEqual(L.parseChampQuery('sion, taric', catalog).groups[0].ids, ['si']);
});

test('parse: palavra que nao e campeao vira texto; grupos repetidos somem', () => {
  const p = L.parseChampQuery('rakan, taric, solar', catalog);
  assert.equal(p.rest, 'solar');
  assert.equal(L.parseChampQuery('rakan rakan', catalog).groups.length, 1);
});

test('multi AND: so comps com todos os campeoes; parciais nao aparecem', () => {
  const r = L.searchMulti(comps, 'rakan, taric, sivir', catalog);
  assert.equal(r.mode, 'multi');
  assert.deepEqual(ids(r), ['a']);
  assert.equal(r.total, 3);
  const r2 = L.searchMulti(comps, 'rakan sivir', catalog);
  assert.deepEqual(ids(r2), ['a']);
  assert.ok(!ids(r2).includes('b') && !ids(r2).includes('c') && !ids(r2).includes('d'));
});

test('multi AND: nenhuma comp com todos -> vazio, com labels para o aviso', () => {
  const r = L.searchMulti(comps, 'taric, kog maw', catalog);
  assert.equal(r.mode, 'multi');
  assert.deepEqual(ids(r), ['a']);
  const none = L.searchMulti(comps, 'sion, rakan', catalog);
  assert.deepEqual(ids(none), []);
  assert.deepEqual(none.labels, ['Sion', 'Rakan']);
});

test('multi AND: qualquer fase conta (inicio, meio, final, flex) e mostra onde', () => {
  const r = L.searchMulti(comps, 'rakan, taric, kog maw', catalog);
  assert.deepEqual(ids(r), ['a']);
  const a = r.results[0];
  const by = Object.fromEntries(a.where.map((w) => [w.ids[0], w.fases]));
  assert.deepEqual(by.rk, ['Meio', 'Final']);
  assert.deepEqual(by.ta, ['Flex']);
  assert.deepEqual(by.km, ['Início']);
  assert.deepEqual([...a.hits.champs].sort(), ['km', 'rk', 'ta']);
});

test('multi AND: token ambiguo e pendente e ignorado no filtro (nao vira "qualquer um")', () => {
  const comps2 = [{ id: 'x', nome: 'X', main: [u('rk'), u('sn')], flex: [] }, { id: 'y', nome: 'Y', main: [u('rk'), u('sj')], flex: [] }, { id: 'z', nome: 'Z', main: [u('ta')], flex: [] }];
  const p = L.parseChampQuery('rakan, se', catalog);
  assert.deepEqual(p.groups.map((g) => g.pending), [false, true]);
  const r = L.searchMulti(comps2, 'rakan, se', catalog);
  assert.equal(r.mode, 'multi');
  assert.deepEqual(ids(r), ['x', 'y']);
  assert.equal(r.total, 1);
  assert.deepEqual(r.results.map((x) => x.where.length), [1, 1]);
  const r2 = L.searchMulti(comps2, 'rakan, sen', catalog);
  assert.deepEqual(ids(r2), ['x']);
  assert.equal(r2.total, 2);
});

test('multi AND: so pendentes nao filtram nada', () => {
  const r = L.searchMulti(comps, 'se, s', catalog);
  assert.equal(r.mode, 'multi');
  assert.equal(r.results.length, comps.length);
});

test('exato vence prefixo: vi = Vi, nao Viego', () => {
  const cat = { ...catalog, champs: catalog.champs.concat([{ id: 'vi', n: 'Vi', c: 3, t: [] }, { id: 'vg', n: 'Viego', c: 4, t: [] }]) };
  const g = L.parseChampQuery('vi, taric', cat).groups[0];
  assert.deepEqual(g.ids, ['vi']);
  assert.equal(g.pending, false);
  const cs = [{ id: 'p', nome: 'P', main: [u('vg'), u('ta')], flex: [] }, { id: 'q', nome: 'Q', main: [u('vi'), u('ta')], flex: [] }];
  assert.deepEqual(ids(L.searchMulti(cs, 'vi, taric', cat)), ['q']);
  assert.equal(L.parseChampQuery('vie, taric', cat).groups[0].pending, false);
});

test('multi: texto restante filtra (AND) por traco/item/nome', () => {
  const r = L.searchMulti(comps, 'sion, sivir, solar', catalog);
  assert.deepEqual(ids(r), []);
  const r2 = L.searchMulti([{ id: 'e2', nome: 'Solar E', main: [u('si'), u('sv')], flex: [] }].concat(comps), 'sion, sivir, solar', catalog);
  assert.deepEqual(ids(r2), ['e2']);
});

test('1 campeao, vazio e texto: igual a searchComps', () => {
  ['diana', 'rakan', 'solar', 'lamina mortal', '  ', 'rakan,', 'kog maw'].forEach((q) => {
    const r = L.searchMulti(comps, q, catalog);
    assert.equal(r.mode, 'single', q);
    const legacy = L.searchComps(comps, q.replace(/[,+;]/g, ' '), catalog);
    assert.deepEqual(ids(r), legacy.map((x) => x.comp.id), q);
  });
  assert.equal(L.searchMulti(comps, '', catalog).results.length, comps.length);
});

test('removePart remove so o chip escolhido e preserva o resto', () => {
  assert.equal(L.removePart('rakan, taric, solar', catalog, 1), 'rakan, solar');
  assert.equal(L.removePart('kog maw sivir', catalog, 0), 'sivir');
  assert.equal(L.removePart('rakan', catalog, 0), '');
});

test('filterUnits: varios campeoes mostra qualquer um; 1 termo igual a antes', () => {
  const list = [u('rk'), u('ta'), u('sv')];
  assert.deepEqual(L.filterUnits(list, 'rakan, sivir', catalog).map((x) => x.c), ['rk', 'sv']);
  assert.deepEqual(L.filterUnits(list, 'rakan taric', catalog).map((x) => x.c), ['rk', 'ta']);
  assert.deepEqual(L.filterUnits(list, 'tar', catalog).map((x) => x.c), ['ta']);
  assert.deepEqual(L.filterUnits(list, '', catalog).length, 3);
});

test('chips da busca usam prefixo proprio e nao colidem com o .chip do editor (bug do circulo 34px)', () => {
  const fs = require('node:fs');
  const rd = (f) => fs.readFileSync(require('node:path').join(__dirname, '..', f), 'utf8');
  const css = rd('css/style.css');
  const html = rd('index.html');
  const js = rd('js/app.js');
  assert.match(html, /id="chips"\s+class="sq-chips"/);
  const bloco = js.slice(js.indexOf('function renderChips'), js.indexOf('function render() {'));
  const usadas = new Set([...bloco.matchAll(/'(sq-[\w-]+)/g)].map((m) => m[1]));
  ['sq-chip', 'sq-champ', 'sq-text', 'sq-chip-x', 'sq-chip-ico'].forEach((c) => assert.ok(bloco.includes(c), 'renderChips sem ' + c));
  assert.ok(!/class:\s*'chip/.test(bloco) && !/class: 'chip-x'/.test(bloco), 'renderChips voltou a usar .chip generico');
  // cada seletor sq-* da busca e definido uma unica vez como regra base
  ['.sq-chips', '.sq-chip', '.sq-chip-x', '.sq-chip-ico'].forEach((sel) => {
    const n = [...css.matchAll(new RegExp('(^|\n)' + sel.replace('.', '\.') + '\{', 'g'))].length;
    assert.equal(n, 1, sel + ' definido ' + n + ' vezes');
  });
  // nenhuma regra do editor (.chip / .chips genericos) casa com os elementos da busca
  const sq = css.split('\n').filter((l) => /^\.sq-chip/.test(l)).join('\n');
  assert.ok(!/(^|[\s,])\.chips?\b[^-]/m.test(sq), 'regras sq-* referenciam .chip generico');
  assert.ok(!/\.chip\s+button/.test(sq));
  assert.ok(usadas.size >= 5);
  // chip precisa crescer com o conteudo: sem width/height fixos no container
  const regraChip = css.match(/\n\.sq-chip\{([^}]*)\}/)[1];
  assert.ok(!/(^|;)\s*(width|height)\s*:/.test(regraChip), 'sq-chip com tamanho fixo');
  assert.ok(/white-space:nowrap/.test(regraChip));
});
