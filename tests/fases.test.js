const test = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../data/catalog.js');
require('../data/seed.js');
const L = require('../js/logic.js');
const CAT = window.TFT_CATALOG;
const SEED = window.TFT_SEED;

const catalog = {
  champs: [
    { id: 'A', n: 'Diana', c: 3, t: [], img: 'a.png' },
    { id: 'B', n: 'Aphelios', c: 4, t: [], img: 'b.png' },
    { id: 'C', n: 'Kayle', c: 2, t: [], img: 'c.png' },
    { id: 'D', n: 'Leona', c: 1, t: [], img: 'd.png' },
    { id: 'E', n: 'Sejuani', c: 2, t: [], img: 'e.png' },
    { id: 'F', n: 'Alune', c: 5, t: [], img: 'f.png' },
  ],
  traits: [],
  items: [],
};
const u = (c) => ({ c, s: 1, i: [], a: [] });
const fases = { inicio: ['D', 'C'], meio: ['D', 'C', 'E', 'A'], origem: 'fonte', ref: 'Mobalytics: Teste', url: 'https://mobalytics.gg/tft/x' };

/* ---------- sanitizeImport ---------- */
test('sanitizeImport preserva fases validas', () => {
  const { comps } = L.sanitizeImport([{ id: 'x', nome: 'X', main: [u('A')], flex: [], fases }], catalog);
  assert.deepEqual(comps[0].fases, fases);
});

test('sanitizeImport sem fases nao cria o campo', () => {
  const { comps } = L.sanitizeImport([{ id: 'x', nome: 'X', main: [u('A')], flex: [] }], catalog);
  assert.equal('fases' in comps[0], false);
});

test('sanitizeImport filtra ids desconhecidos, duplicados e limita o tamanho', () => {
  const raw = { inicio: ['D', 'D', 'ZZ', 5, null, 'C', 'E', 'A', 'B', 'F', 'D'], meio: [] };
  const { comps } = L.sanitizeImport([{ id: 'x', nome: 'X', main: [u('A')], flex: [], fases: raw }], catalog);
  assert.deepEqual(comps[0].fases.inicio, ['D', 'C', 'E', 'A', 'B', 'F'].slice(0, L.MAX_FASE.inicio));
  assert.deepEqual(comps[0].fases.meio, []);
});

test('sanitizeImport descarta fases vazias, lixo e tipos errados', () => {
  [{ inicio: [], meio: [] }, { inicio: ['ZZ'] }, 'texto', 7, [], null, { inicio: 'D' }].forEach((f) => {
    const { comps } = L.sanitizeImport([{ id: 'x', nome: 'X', main: [u('A')], flex: [], fases: f }], catalog);
    assert.equal('fases' in comps[0], false, JSON.stringify(f));
  });
});

test('sanitizeImport: origem so fonte/derivado/manual, ref curto e url so https', () => {
  const mk = (extra) => L.sanitizeImport([{ id: 'x', nome: 'X', main: [u('A')], flex: [], fases: { inicio: ['D'], meio: ['C'], ...extra } }], catalog).comps[0].fases;
  assert.equal(mk({ origem: 'derivado' }).origem, 'derivado');
  assert.equal(mk({ origem: 'qualquer' }).origem, 'manual');
  assert.equal(mk({}).origem, 'manual');
  assert.equal(mk({ ref: 'x'.repeat(300) }).ref.length, 100);
  assert.equal('url' in mk({ url: 'javascript:alert(1)' }), false);
  assert.equal('url' in mk({ url: 'http://exemplo.com' }), false);
  assert.equal(mk({ url: 'https://exemplo.com/a' }).url, 'https://exemplo.com/a');
  assert.equal('url' in mk({ url: 'https://' + 'a'.repeat(300) }), false);
});

test('fases entram no duplicateComp como copia independente', () => {
  const comp = L.sanitizeImport([{ id: 'x', nome: 'X', main: [u('A')], flex: [], fases }], catalog).comps[0];
  const copy = L.duplicateComp(comp, 'novo');
  assert.deepEqual(copy.fases, comp.fases);
  copy.fases.inicio.push('A');
  assert.equal(comp.fases.inicio.length, 2);
});

/* ---------- mergeSeed ---------- */
const stored = (comps, seedVersao) => ({ versao: 1, seedVersao, excluidos: [], comps });
const base = (id, extra = {}) => ({ id, nome: 'Comp ' + id, estilo: 'Edit', nota: 'minha nota', main: [u('A'), u('B')], flex: [], ...extra });
const seedF = [
  { id: 's1', nome: 'Seed 1', main: [u('A')], flex: [], fases, fasesDesde: 6 },
  { id: 's2', nome: 'Seed 2', main: [u('B')], flex: [], fases: { inicio: ['D'], meio: ['C'], origem: 'derivado' }, fasesDesde: 6 },
];

test('mergeSeed fases: comp salva sem fases recebe as do seed e preserva o resto', () => {
  const edit = base('s1', { nome: 'Meu nome', main: [u('F')] });
  const r = L.mergeSeed(stored([edit], 5), seedF, 6, catalog);
  const c = r.comps.find((x) => x.id === 's1');
  assert.deepEqual(c.fases, fases);
  assert.equal(c.nome, 'Meu nome');
  assert.equal(c.nota, 'minha nota');
  assert.deepEqual(c.main.map((x) => x.c), ['F']);
  assert.deepEqual(r.fasesAplicadas, ['s1']);
});

test('mergeSeed fases: nunca sobrescreve fases que o usuario ja tem', () => {
  const minhas = { inicio: ['A'], meio: ['B'], origem: 'manual' };
  const r = L.mergeSeed(stored([base('s1', { fases: minhas })], 5), seedF, 6, catalog);
  assert.deepEqual(r.comps[0].fases, minhas);
  assert.deepEqual(r.fasesAplicadas, []);
});

test('mergeSeed fases: comp excluida nao volta e nao cria comp', () => {
  const st = { ...stored([base('s2')], 5), excluidos: ['s1'] };
  const r = L.mergeSeed(st, seedF, 6, catalog);
  assert.deepEqual(r.comps.map((c) => c.id), ['s2']);
  assert.deepEqual(r.fasesAplicadas, ['s2']);
});

test('mergeSeed fases: so aplica uma vez (versao ja vista) e ignora versao futura', () => {
  assert.deepEqual(L.mergeSeed(stored([base('s1')], 6), seedF, 6, catalog).fasesAplicadas, []);
  assert.equal('fases' in L.mergeSeed(stored([base('s1')], 6), seedF, 6, catalog).comps[0], false);
  const fut = [{ ...seedF[0], fasesDesde: 9 }];
  assert.deepEqual(L.mergeSeed(stored([base('s1')], 5), fut, 6, catalog).fasesAplicadas, []);
});

test('mergeSeed fases: seed sem fasesDesde ou com fases invalidas nao aplica', () => {
  const sem = [{ id: 's1', nome: 'S', main: [u('A')], flex: [], fases }];
  assert.deepEqual(L.mergeSeed(stored([base('s1')], 5), sem, 6, catalog).fasesAplicadas, []);
  const ruim = [{ id: 's1', nome: 'S', main: [u('A')], flex: [], fases: { inicio: ['ZZ'], meio: [] }, fasesDesde: 6 }];
  assert.deepEqual(L.mergeSeed(stored([base('s1')], 5), ruim, 6, catalog).fasesAplicadas, []);
});

test('mergeSeed fases: comp nova do seed ja chega com fases', () => {
  const novo = [{ id: 's9', nome: 'Nova', main: [u('A')], flex: [], desde: 6, fases, fasesDesde: 6 }];
  const r = L.mergeSeed(stored([base('s1')], 5), novo, 6, catalog);
  assert.deepEqual(r.comps.find((c) => c.id === 's9').fases, fases);
  assert.deepEqual(r.added, ['s9']);
});

test('mergeSeed fases: sem dados salvos usa o seed inteiro com fases', () => {
  const r = L.mergeSeed(null, seedF, 6, catalog);
  assert.deepEqual(r.comps[0].fases, fases);
  assert.deepEqual(r.fasesAplicadas, []);
});

test('mergeSeed fases: nao mexe nas posicoes nem na ordem', () => {
  const st = stored([base('s2'), base('s1')], 5);
  const r = L.mergeSeed(st, seedF, 6, catalog);
  assert.deepEqual(r.comps.map((c) => c.id), ['s2', 's1']);
  assert.deepEqual(r.fasesAplicadas.sort(), ['s1', 's2']);
});

/* ---------- phaseBoards (funcao pura para a UI futura) ---------- */
test('phaseBoards devolve inicio, meio e fim com dados do catalogo', () => {
  const comp = L.sanitizeImport([{ id: 'x', nome: 'X', main: [u('A'), u('B')], flex: [], fases }], catalog).comps[0];
  const pb = L.phaseBoards(comp, catalog);
  assert.deepEqual(pb.fases.map((f) => f.key), ['inicio', 'meio', 'fim']);
  assert.deepEqual(pb.fases[0].units, [
    { c: 'D', n: 'Leona', cost: 1, img: 'd.png' },
    { c: 'C', n: 'Kayle', cost: 2, img: 'c.png' },
  ]);
  assert.deepEqual(pb.fases[2].units.map((x) => x.c), ['A', 'B']);
  assert.equal(pb.origem, 'fonte');
  assert.equal(pb.ref, 'Mobalytics: Teste');
  assert.equal(pb.url, 'https://mobalytics.gg/tft/x');
  pb.fases.forEach((f) => assert.ok(f.label && f.hint));
});

test('phaseBoards sem fases devolve null; ids sumidos do catalogo sao ignorados', () => {
  assert.equal(L.phaseBoards({ id: 'x', main: [u('A')], flex: [] }, catalog), null);
  assert.equal(L.phaseBoards(null, catalog), null);
  const comp = { id: 'x', main: [u('A')], flex: [], fases: { inicio: ['D', 'GONE'], meio: ['C'], origem: 'manual' } };
  assert.deepEqual(L.phaseBoards(comp, catalog).fases[0].units.map((x) => x.c), ['D']);
});

/* ---------- seed real ---------- */
test('seed: as 24 comps tem fases; as 19 anteriores com fasesDesde 6, as 5 novas (desde 7) ja nascem com fases', () => {
  assert.equal(window.TFT_SEED_VERSION, 7);
  assert.equal(SEED.length, 24);
  SEED.forEach((s) => {
    assert.ok(s.fases, s.id);
    if (s.desde === 7) assert.equal(s.fasesDesde, undefined, s.id);
    else assert.equal(s.fasesDesde, 6, s.id);
  });
});

test('seed: fases validas (ids no catalogo, tamanhos, custos, origem, fonte)', () => {
  const ch = new Map(CAT.champs.map((c) => [c.id, c]));
  SEED.forEach((s) => {
    const f = s.fases;
    ['inicio', 'meio'].forEach((k) => {
      assert.ok(Array.isArray(f[k]), s.id + ' ' + k);
      assert.equal(new Set(f[k]).size, f[k].length, s.id + ' ' + k + ' sem repetidos');
      f[k].forEach((id) => assert.ok(ch.has(id), s.id + ' ' + id));
    });
    assert.ok(f.inicio.length >= 3 && f.inicio.length <= 5, s.id + ' inicio 3-5 unidades');
    assert.ok(f.meio.length >= 6 && f.meio.length <= 7, s.id + ' meio 6-7 unidades');
    assert.ok(f.inicio.every((id) => ch.get(id).c <= 3), s.id + ' inicio custo <= 3');
    assert.ok(f.meio.every((id) => ch.get(id).c <= 4), s.id + ' meio custo <= 4');
    assert.ok(['fonte', 'derivado'].includes(f.origem), s.id + ' origem');
    assert.ok(typeof f.ref === 'string' && f.ref.length > 0 && f.ref.length <= 100, s.id + ' ref');
    if (f.origem === 'fonte') assert.match(f.url, /^https:\/\/mobalytics\.gg\/tft\/comps-guide\//, s.id + ' url da fonte');
    else assert.equal(f.url, undefined, s.id + ' derivado nao leva url');
  });
});

test('seed: fases derivadas usam so unidades do board da propria comp', () => {
  SEED.filter((s) => s.fases.origem === 'derivado').forEach((s) => {
    const own = new Set(s.main.concat(s.flex).map((x) => x.c));
    s.fases.inicio.concat(s.fases.meio).forEach((id) => assert.ok(own.has(id), s.id + ' ' + id));
  });
});

test('seed: fases sobrevivem ao sanitizeImport sem perdas', () => {
  const { comps, dropped } = L.sanitizeImport(SEED, CAT);
  assert.equal(dropped, 0);
  comps.forEach((c, i) => assert.deepEqual(c.fases, SEED[i].fases, c.id));
});

test('seed: quem ja tinha tudo ate a versao 5 recebe as fases das 19 comps sem perder edicao', () => {
  const originais = SEED.filter((s) => s.desde !== 7);
  const salvo = L.sanitizeImport(originais, CAT).comps.map((c) => {
    const x = L.clone(c);
    delete x.fases;
    return x;
  });
  salvo[0].nome = 'Renomeada pelo Elton';
  const r = L.mergeSeed({ versao: 1, seedVersao: 5, excluidos: [], comps: salvo }, originais, 6, CAT);
  assert.equal(r.seedVersao, 6);
  assert.equal(r.fasesAplicadas.length, 19);
  assert.equal(r.comps[0].nome, 'Renomeada pelo Elton');
  r.comps.forEach((c) => assert.deepEqual(c.fases, originais.find((s) => s.id === c.id).fases, c.id));
});
