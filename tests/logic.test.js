const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

const catalog = {
  champs: [
    { id: 'A', n: 'Diana', c: 3, t: ['DA_18_Lunar', 'slayer'] },
    { id: 'B', n: 'Aphelios', c: 4, t: ['DA_18_Lunar', 'rapid'] },
    { id: 'C', n: 'Kayle', c: 2, t: ['DA_18_Solar', 'rapid'] },
    { id: 'D', n: 'Leona', c: 1, t: ['DA_18_Solar', 'def'] },
    { id: 'E', n: 'Sejuani', c: 2, t: ['DA_18_Solar', 'jug'] },
    { id: 'F', n: 'Alune', c: 5, t: ['DA_18_Lunar', 'spell'] },
  ],
  traits: [
    { id: 'DA_18_Lunar', n: 'Lunar', bp: [2, 3, 4, 5] },
    { id: 'DA_18_Solar', n: 'Solar', bp: [3] },
    { id: 'rapid', n: 'Fumegante', bp: [2, 3] },
    { id: 'slayer', n: 'Devastador', bp: [2, 4] },
    { id: 'def', n: 'Defendente', bp: [2, 4] },
    { id: 'jug', n: 'Colosso', bp: [2, 4] },
    { id: 'spell', n: 'Enfeitiçador', bp: [2, 4] },
    { id: 'DA_18_Eclipse', n: 'Eclipse', bp: [] },
  ],
  items: [
    { id: 'i1', n: 'Lâmina Mortal', k: 'completo' },
    { id: 'i2', n: 'Guinsoo', k: 'completo' },
    { id: 'em', n: 'Emblema de Lunar', k: 'emblema', tr: 'DA_18_Lunar' },
  ],
};
const u = (c, extra = {}) => ({ c, s: 1, i: [], a: [], ...extra });

test('norm remove acentos e caixa', () => {
  assert.equal(L.norm('  Enfeitiçador Ã '), 'enfeiticador a');
});

test('activeTraits conta so tracos que chegam ao primeiro breakpoint', () => {
  const comp = { main: [u('C'), u('D'), u('E')], flex: [] };
  const t = L.activeTraits(comp, catalog);
  const solar = t.find((x) => x.id === 'DA_18_Solar');
  assert.equal(solar.count, 3);
  assert.equal(solar.tier, 1);
  assert.equal(t.find((x) => x.id === 'rapid'), undefined);
});

test('activeTraits ignora flex e conta emblema', () => {
  const comp = { main: [u('A'), u('B', { i: ['em'] })], flex: [u('F')] };
  const t = L.activeTraits(comp, catalog);
  const lunar = t.find((x) => x.id === 'DA_18_Lunar');
  assert.equal(lunar.count, 2);
  const comp2 = { main: [u('A'), u('B'), u('C', { i: ['em'] })], flex: [] };
  assert.equal(L.activeTraits(comp2, catalog).find((x) => x.id === 'DA_18_Lunar').count, 3);
});

test('emblema em unidade que ja tem o traco nao conta duas vezes', () => {
  const comp = { main: [u('A', { i: ['em'] }), u('B')], flex: [] };
  assert.equal(L.activeTraits(comp, catalog).find((x) => x.id === 'DA_18_Lunar').count, 2);
});

test('Eclipse aparece com Solar 3 e Lunar 3', () => {
  const comp = { main: [u('A'), u('B'), u('F'), u('C'), u('D'), u('E')], flex: [] };
  const t = L.activeTraits(comp, catalog);
  assert.ok(t.find((x) => x.id === 'DA_18_Eclipse'));
});

test('unidade repetida conta uma vez', () => {
  const comp = { main: [u('C'), u('C'), u('D')], flex: [] };
  assert.equal(L.activeTraits(comp, catalog).find((x) => x.id === 'DA_18_Solar'), undefined);
});

const comps = [
  { id: 'x1', nome: 'Solar Fumegante', main: [u('C'), u('D'), u('E', { i: ['i1'] })], flex: [u('A')] },
  { id: 'x2', nome: 'Lunar', main: [u('A', { a: ['i2'] }), u('B')], flex: [] },
];

test('busca por campeao inclui flex', () => {
  const r = L.searchComps(comps, 'diana', catalog);
  assert.deepEqual(r.map((x) => x.comp.id), ['x1', 'x2']);
  assert.ok(r[0].hits.champs.has('A'));
});

test('busca por item inclui alternativos e ignora acento', () => {
  assert.deepEqual(L.searchComps(comps, 'guinsoo', catalog).map((x) => x.comp.id), ['x2']);
  assert.deepEqual(L.searchComps(comps, 'lamina mortal', catalog).map((x) => x.comp.id), ['x1']);
});

test('busca por traco e por nome da comp', () => {
  assert.deepEqual(L.searchComps(comps, 'solar', catalog).map((x) => x.comp.id), ['x1']);
  assert.deepEqual(L.searchComps(comps, 'fumegante', catalog).map((x) => x.comp.id), ['x1']);
});

test('busca com varios termos exige todos; vazio devolve tudo', () => {
  assert.deepEqual(L.searchComps(comps, 'diana aphelios', catalog).map((x) => x.comp.id), ['x2']);
  assert.equal(L.searchComps(comps, '  ', catalog).length, 2);
});

test('duplicateComp gera copia profunda com novo id', () => {
  const copy = L.duplicateComp(comps[0], 'novo');
  assert.equal(copy.id, 'novo');
  assert.equal(copy.nome, 'Solar Fumegante (cópia)');
  copy.main[2].i.push('i2');
  assert.deepEqual(comps[0].main[2].i, ['i1']);
});

test('sanitizeImport descarta desconhecidos e limita valores', () => {
  const raw = {
    comps: [
      {
        id: 'a', nome: '<img src=x onerror=1>', estilo: 'Fast 8', nota: 'n', board: true,
        main: [
          { c: 'A', s: 9, i: ['i1', 'zzz', 'i1', 'i2', 'i2'], a: ['i2'], p: [1, 1] },
          { c: 'NAO', s: 1, i: [], a: [] },
          { c: 'B', s: 2, i: [], a: [], p: [1, 1] },
          { c: 'C', s: 1, i: [], a: [], p: [9, 9] },
        ],
        flex: [{ c: 'F' }],
      },
      'lixo',
      { nome: 5 },
    ],
  };
  const { comps: out, dropped } = L.sanitizeImport(raw, catalog);
  assert.equal(out.length, 1);
  assert.ok(dropped >= 2);
  const c = out[0];
  assert.equal(c.nome, '<img src=x onerror=1>');
  assert.equal(c.main.length, 3);
  assert.equal(c.main[0].s, 3);
  assert.deepEqual(c.main[0].i, ['i1', 'i1', 'i2']);
  assert.deepEqual(c.main[0].p, [1, 1]);
  assert.equal(c.main[1].p, undefined);
  assert.equal(c.main[2].p, undefined);
  assert.equal(c.flex.length, 1);
  assert.equal(c.flex[0].s, 1);
});

test('sanitizeImport aceita array puro e gera ids unicos', () => {
  const raw = [
    { id: 'dup', nome: 'a', main: [], flex: [] },
    { id: 'dup', nome: 'b', main: [], flex: [] },
  ];
  const { comps: out } = L.sanitizeImport(raw, catalog);
  assert.equal(out.length, 2);
  assert.notEqual(out[0].id, out[1].id);
});

test('sanitizeImport rejeita entrada que nao e objeto/array', () => {
  assert.deepEqual(L.sanitizeImport(null, catalog).comps, []);
  assert.deepEqual(L.sanitizeImport('x', catalog).comps, []);
});
