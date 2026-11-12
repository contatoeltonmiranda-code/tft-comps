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

test('multi: todos primeiro, depois parciais por quantidade, indicador n/total', () => {
  const r = L.searchMulti(comps, 'rakan, taric, sivir', catalog);
  assert.equal(r.mode, 'multi');
  assert.deepEqual(ids(r), ['a', 'b', 'c', 'd']);
  assert.deepEqual(r.results.map((x) => x.score), [3, 2, 1, 1]);
  assert.equal(r.results[0].total, 3);
});

test('multi: empate mantem a ordem original; comp sem nenhum some', () => {
  const r = L.searchMulti(comps, 'rakan sivir', catalog);
  assert.deepEqual(ids(r), ['a', 'b', 'c', 'd']);
  assert.deepEqual(r.results.map((x) => x.score), [2, 1, 1, 1]);
  assert.ok(!ids(r).includes('e'));
});

test('multi: marca onde cada campeao aparece (inicio, meio, final, flex)', () => {
  const r = L.searchMulti(comps, 'rakan, taric, kog maw', catalog);
  const a = r.results.find((x) => x.comp.id === 'a');
  const by = Object.fromEntries(a.where.map((w) => [w.ids[0], w.fases]));
  assert.deepEqual(by.rk, ['Meio', 'Final']);
  assert.deepEqual(by.ta, ['Flex']);
  assert.deepEqual(by.km, ['Início']);
  assert.deepEqual([...a.hits.champs].sort(), ['km', 'rk', 'ta']);
});

test('multi: ambiguo conta o grupo achado se qualquer candidato bate', () => {
  const r = L.searchMulti([{ id: 'x', nome: 'X', main: [u('sn')], flex: [] }, { id: 'y', nome: 'Y', main: [u('sj'), u('ta')], flex: [] }], 'se, taric', catalog);
  assert.deepEqual(r.results.map((x) => [x.comp.id, x.score]), [['y', 2], ['x', 1]]);
});

test('multi: texto restante filtra (AND) por traco/item/nome', () => {
  const r = L.searchMulti(comps, 'sion, sivir, solar', catalog);
  assert.deepEqual(ids(r), ['e']);
  assert.equal(r.results[0].score, 1);
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
