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

const seedRaw = [
  { id: 's1', nome: 'Um', main: [u('A')], flex: [] },
  { id: 's2', nome: 'Dois', main: [u('B')], flex: [] },
  { id: 's3', nome: 'Tres', desde: 2, main: [u('C')], flex: [] },
];

test('mergeSeed sem dados salvos usa o seed inteiro', () => {
  const r = L.mergeSeed(null, seedRaw, 2, catalog);
  assert.deepEqual(r.comps.map((c) => c.id), ['s1', 's2', 's3']);
  assert.equal(r.seedVersao, 2);
  assert.deepEqual(r.excluidos, []);
});

test('mergeSeed legado (sem seedVersao) acrescenta so comps novas e preserva edicao', () => {
  const stored = { versao: 1, comps: [{ id: 's1', nome: 'Um editado', main: [u('A', { s: 3 })], flex: [] }, { id: 's2', nome: 'Dois', main: [u('B')], flex: [] }] };
  const r = L.mergeSeed(stored, seedRaw, 2, catalog);
  assert.deepEqual(r.comps.map((c) => c.id), ['s1', 's2', 's3']);
  assert.equal(r.comps[0].nome, 'Um editado');
  assert.equal(r.comps[0].main[0].s, 3);
  assert.equal(r.seedVersao, 2);
  assert.deepEqual(r.added, ['s3']);
});

test('mergeSeed nao recria comp que o usuario excluiu (legado e excluidos)', () => {
  const legado = { versao: 1, comps: [{ id: 's2', nome: 'Dois', main: [], flex: [] }] };
  assert.deepEqual(L.mergeSeed(legado, seedRaw, 2, catalog).comps.map((c) => c.id), ['s2', 's3']);
  const excl = { versao: 1, seedVersao: 1, excluidos: ['s3'], comps: [{ id: 's1', nome: 'Um', main: [], flex: [] }] };
  const r = L.mergeSeed(excl, seedRaw, 2, catalog);
  assert.deepEqual(r.comps.map((c) => c.id), ['s1']);
  assert.deepEqual(r.excluidos, ['s3']);
});

test('mergeSeed e idempotente quando a versao ja foi vista', () => {
  const stored = { versao: 1, seedVersao: 2, excluidos: [], comps: [{ id: 's1', nome: 'Um', main: [], flex: [] }] };
  const r = L.mergeSeed(stored, seedRaw, 2, catalog);
  assert.deepEqual(r.comps.map((c) => c.id), ['s1']);
  assert.deepEqual(r.added, []);
});

test('mergeSeed ignora excluidos invalidos e nao quebra com lixo', () => {
  const r = L.mergeSeed({ comps: [], excluidos: [5, null, 'x'.repeat(99), 's3'], seedVersao: 'a' }, seedRaw, 2, catalog);
  assert.deepEqual(r.excluidos, ['s3']);
  assert.deepEqual(r.comps, []);
  assert.deepEqual(L.mergeSeed('lixo', seedRaw, 2, catalog).comps.length, 3);
});

/* ---------- posicoes novas do seed (posDesde) ---------- */
const posSeed = [
  { id: 'p1', nome: 'Pos', posDesde: 3, main: [u('A', { p: [1, 1] }), u('B', { p: [4, 7] }), u('C', { p: [2, 2] })], flex: [u('D')] },
];
const posStored = (comps, extra = {}) => ({ versao: 1, seedVersao: 2, excluidos: [], comps, ...extra });

test('mergeSeed posicao: comp sem posicao recebe as posicoes do seed', () => {
  const stored = posStored([{ id: 'p1', nome: 'Pos editada', main: [u('A', { s: 3 }), u('B')], flex: [] }]);
  const r = L.mergeSeed(stored, posSeed, 3, catalog);
  const c = r.comps[0];
  assert.equal(c.nome, 'Pos editada');
  assert.equal(c.main[0].s, 3);
  assert.deepEqual(c.main[0].p, [1, 1]);
  assert.deepEqual(c.main[1].p, [4, 7]);
  assert.deepEqual(r.positioned, ['p1']);
  assert.equal(r.seedVersao, 3);
  assert.equal(r.comps.length, 1);
});

test('mergeSeed posicao: comp posicionada pelo usuario fica intacta', () => {
  const stored = posStored([{ id: 'p1', nome: 'Pos', main: [u('A', { p: [3, 3] }), u('B'), u('C')], flex: [] }]);
  const r = L.mergeSeed(stored, posSeed, 3, catalog);
  assert.deepEqual(r.comps[0].main[0].p, [3, 3]);
  assert.equal(r.comps[0].main[1].p, undefined);
  assert.equal(r.comps[0].main[2].p, undefined);
  assert.deepEqual(r.positioned, []);
});

test('mergeSeed posicao: nao ocupa casa ja usada e ignora campeao ausente ou flex', () => {
  const stored = posStored([{ id: 'p1', nome: 'Pos', main: [u('B')], flex: [u('A')] }]);
  const r = L.mergeSeed(stored, posSeed, 3, catalog);
  assert.deepEqual(r.comps[0].main[0].p, [4, 7]);
  assert.equal(r.comps[0].flex[0].p, undefined);
  assert.equal(r.comps[0].main.length, 1);
});

test('mergeSeed posicao: comp excluida nao volta', () => {
  const stored = posStored([{ id: 'x', nome: 'Outra', main: [], flex: [] }], { excluidos: ['p1'] });
  const r = L.mergeSeed(stored, posSeed, 3, catalog);
  assert.deepEqual(r.comps.map((c) => c.id), ['x']);
  assert.deepEqual(r.positioned, []);
});

test('mergeSeed posicao: so aplica uma vez (versao ja vista) e respeita unplace posterior', () => {
  const visto = posStored([{ id: 'p1', nome: 'Pos', main: [u('A'), u('B')], flex: [] }], { seedVersao: 3 });
  const r = L.mergeSeed(visto, posSeed, 3, catalog);
  assert.equal(r.comps[0].main[0].p, undefined);
  assert.deepEqual(r.positioned, []);
  const fut = [{ id: 'p1', nome: 'Pos', posDesde: 5, main: [u('A', { p: [1, 1] })], flex: [] }];
  assert.deepEqual(L.mergeSeed(posStored([{ id: 'p1', nome: 'Pos', main: [u('A')], flex: [] }]), fut, 3, catalog).positioned, []);
});

test('mergeSeed posicao: posicao invalida do seed e ignorada', () => {
  const ruim = [{ id: 'p1', nome: 'Pos', posDesde: 3, main: [u('A', { p: [9, 1] }), u('B', { p: [1, 1] }), u('C', { p: [1, 1] })], flex: [] }];
  const r = L.mergeSeed(posStored([{ id: 'p1', nome: 'Pos', main: [u('A'), u('B'), u('C')], flex: [] }]), ruim, 3, catalog);
  assert.equal(r.comps[0].main[0].p, undefined);
  assert.deepEqual(r.comps[0].main[1].p, [1, 1]);
  assert.equal(r.comps[0].main[2].p, undefined);
});

/* ---------- checks "ja peguei" e busca na comp ---------- */
const pickComp = { id: 'k1', nome: 'K', main: [u('A'), u('B'), u('C')], flex: [u('D'), u('E')] };

test('toggleCheck marca, desmarca e nao muta o estado anterior', () => {
  const a = {};
  const b = L.toggleCheck(a, 'k1', 'A');
  assert.deepEqual(a, {});
  assert.deepEqual(b, { k1: ['A'] });
  assert.equal(L.isChecked(b, 'k1', 'A'), true);
  assert.equal(L.isChecked(b, 'k1', 'B'), false);
  assert.equal(L.isChecked(b, 'k2', 'A'), false);
  const c = L.toggleCheck(b, 'k1', 'A');
  assert.deepEqual(c, {});
});

test('check e por comp + campeao', () => {
  let s = L.toggleCheck({}, 'k1', 'A');
  s = L.toggleCheck(s, 'k2', 'A');
  s = L.toggleCheck(s, 'k1', 'B');
  assert.deepEqual(s, { k1: ['A', 'B'], k2: ['A'] });
  s = L.toggleCheck(s, 'k2', 'A');
  assert.deepEqual(s, { k1: ['A', 'B'] });
});

test('clearChecks limpa so a comp pedida', () => {
  const s = { k1: ['A', 'B'], k2: ['A'] };
  assert.deepEqual(L.clearChecks(s, 'k1'), { k2: ['A'] });
  assert.deepEqual(s, { k1: ['A', 'B'], k2: ['A'] });
  assert.deepEqual(L.clearChecks(s, 'nada'), s);
});

test('clearAllChecks zera todas as comps sem mutar o estado anterior', () => {
  const s = { k1: ['A', 'B'], k2: ['A'] };
  assert.deepEqual(L.clearAllChecks(s), {});
  assert.deepEqual(s, { k1: ['A', 'B'], k2: ['A'] });
  assert.deepEqual(L.clearAllChecks({}), {});
  assert.deepEqual(L.clearAllChecks(null), {});
});

test('summarizeChecks conta checks e comps com check (inclui ids fora da comp)', () => {
  assert.deepEqual(L.summarizeChecks({}), { checks: 0, comps: 0 });
  assert.deepEqual(L.summarizeChecks(null), { checks: 0, comps: 0 });
  assert.deepEqual(L.summarizeChecks({ k1: ['A', 'B'], k2: ['A'], k3: [] }), { checks: 3, comps: 2 });
});

test('limpar tudo nao toca nas comps nem no save das comps', () => {
  const comps = [pickComp];
  const before = JSON.stringify(comps);
  L.clearAllChecks({ k1: ['A'] });
  assert.equal(JSON.stringify(comps), before);
});

test('countChecked conta main+flex, ignora ids que nao estao na comp e duplicados', () => {
  assert.deepEqual(L.countChecked({}, pickComp), { done: 0, total: 5 });
  assert.deepEqual(L.countChecked({ k1: ['A', 'D', 'ZZ'] }, pickComp), { done: 2, total: 5 });
  const dup = { id: 'k1', main: [u('A'), u('A')], flex: [u('A')] };
  assert.deepEqual(L.countChecked({ k1: ['A'] }, dup), { done: 1, total: 1 });
});

test('sanitizeChecks aceita so { compId: [champId] } valido', () => {
  assert.deepEqual(L.sanitizeChecks({ k1: ['A', 'B', 'A'], k2: [] }), { k1: ['A', 'B'] });
  assert.deepEqual(L.sanitizeChecks('lixo'), {});
  assert.deepEqual(L.sanitizeChecks(null), {});
  assert.deepEqual(L.sanitizeChecks([1, 2]), {});
  assert.deepEqual(L.sanitizeChecks({ k1: [1, null, 'x'.repeat(99), 'A'], ['y'.repeat(99)]: ['A'], k3: 'A' }), { k1: ['A'] });
  const evil = JSON.parse('{"__proto__":["A"],"k1":["A"]}');
  const out = L.sanitizeChecks(evil);
  assert.deepEqual(Object.keys(out), ['k1']);
  assert.equal({}.A, undefined);
});

test('filterUnits: vazio mostra todos; ignora acento, caixa e pontuacao', () => {
  const units = [u('A'), u('B'), u('C'), u('D')];
  assert.deepEqual(L.filterUnits(units, '', catalog).map((x) => x.c), ['A', 'B', 'C', 'D']);
  assert.deepEqual(L.filterUnits(units, '   ', catalog).map((x) => x.c), ['A', 'B', 'C', 'D']);
  assert.deepEqual(L.filterUnits(units, 'DIA', catalog).map((x) => x.c), ['A']);
  assert.deepEqual(L.filterUnits(units, 'ay', catalog).map((x) => x.c), ['C']);
  assert.deepEqual(L.filterUnits(units, 'zzz', catalog), []);
  const acc = { champs: [{ id: 'K', n: "Kog'Maw", c: 4, t: [] }, { id: 'N', n: 'Nunu', c: 1, t: [] }], traits: [], items: [] };
  assert.deepEqual(L.filterUnits([u('K'), u('N')], 'kog maw', acc).map((x) => x.c), ['K']);
  assert.deepEqual(L.filterUnits([u('K'), u('N')], 'KOGMAW', acc).map((x) => x.c), ['K']);
});

test('filterUnits ignora campeao fora do catalogo sem quebrar', () => {
  assert.deepEqual(L.filterUnits([u('XX'), u('A')], 'dia', catalog).map((x) => x.c), ['A']);
  assert.deepEqual(L.filterUnits(undefined, 'dia', catalog), []);
});

/* ---------- comp nova no topo (topo: true) ---------- */
const topSeed = seedRaw.concat([{ id: 's4', nome: 'Quatro', desde: 3, topo: true, main: [u('A')], flex: [] }, { id: 's5', nome: 'Cinco', desde: 3, main: [u('B')], flex: [] }]);

test('mergeSeed topo: comp nova com topo vai para a frente, preservando ordem e edicoes das demais', () => {
  const stored = { versao: 1, seedVersao: 2, excluidos: [], comps: [{ id: 's2', nome: 'Dois editado', main: [u('B', { s: 3 })], flex: [] }, { id: 'c-meu', nome: 'Minha', main: [], flex: [] }] };
  const r = L.mergeSeed(stored, topSeed, 3, catalog);
  assert.deepEqual(r.comps.map((c) => c.id), ['s4', 's2', 'c-meu', 's5']);
  assert.equal(r.comps[1].nome, 'Dois editado');
  assert.equal(r.comps[1].main[0].s, 3);
  assert.deepEqual(r.added.slice().sort(), ['s4', 's5']);
});

test('mergeSeed topo: nao volta se excluida, nao duplica e e idempotente', () => {
  const excl = { versao: 1, seedVersao: 2, excluidos: ['s4'], comps: [{ id: 's2', nome: 'Dois', main: [], flex: [] }] };
  assert.deepEqual(L.mergeSeed(excl, topSeed, 3, catalog).comps.map((c) => c.id), ['s2', 's5']);
  const vista = { versao: 1, seedVersao: 3, excluidos: [], comps: [{ id: 's2', nome: 'Dois', main: [], flex: [] }, { id: 's4', nome: 'Quatro', main: [], flex: [] }] };
  assert.deepEqual(L.mergeSeed(vista, topSeed, 3, catalog).comps.map((c) => c.id), ['s2', 's4']);
  const jaTem = { versao: 1, seedVersao: 2, excluidos: [], comps: [{ id: 's1', nome: 'Um', main: [], flex: [] }, { id: 's4', nome: 'Quatro movida', main: [], flex: [] }] };
  assert.deepEqual(L.mergeSeed(jaTem, topSeed, 3, catalog).comps.map((c) => c.id), ['s1', 's4', 's5']);
});

test('mergeSeed topo: sem dados salvos segue a ordem do seed', () => {
  const seedTopoPrimeiro = [topSeed[3]].concat(topSeed.slice(0, 3));
  assert.deepEqual(L.mergeSeed(null, seedTopoPrimeiro, 3, catalog).comps.map((c) => c.id), ['s4', 's1', 's2', 's3']);
});

/* ---------- comp nova logo abaixo de outra do topo (abaixoDe) ---------- */
const sA = { id: 'sA', nome: 'A', desde: 3, topo: true, main: [u('A')], flex: [] };
const sB = { id: 'sB', nome: 'B', desde: 4, topo: true, abaixoDe: 'sA', main: [u('B')], flex: [] };
const belowSeed = [sA, sB].concat(seedRaw);
const saved = (ids, v) => ({ versao: 1, seedVersao: v, excluidos: [], comps: ids.map((id) => ({ id, nome: id, main: [], flex: [] })) });

test('mergeSeed abaixoDe: sem dados salvos segue a ordem do seed (A, B)', () => {
  assert.deepEqual(L.mergeSeed(null, belowSeed, 4, catalog).comps.map((c) => c.id).slice(0, 2), ['sA', 'sB']);
});

test('mergeSeed abaixoDe: quem tem versao 3 (A no topo) recebe B em 2o, nao em 1o', () => {
  const r = L.mergeSeed(saved(['sA', 's1', 's2'], 3), belowSeed, 4, catalog);
  assert.deepEqual(r.comps.map((c) => c.id), ['sA', 'sB', 's1', 's2']);
  assert.deepEqual(r.added, ['sB']);
  assert.equal(r.seedVersao, 4);
});

test('mergeSeed abaixoDe: quem tem versao 2 recebe A em 1o e B em 2o', () => {
  const r = L.mergeSeed(saved(['s1', 's2'], 2), belowSeed, 4, catalog);
  assert.deepEqual(r.comps.map((c) => c.id), ['sA', 'sB', 's1', 's2']);
});

test('mergeSeed abaixoDe: A movida ou excluida pelo usuario nao quebra, B cai para o topo', () => {
  assert.deepEqual(L.mergeSeed(saved(['s1', 'sA', 's2'], 3), belowSeed, 4, catalog).comps.map((c) => c.id), ['sB', 's1', 'sA', 's2']);
  const excl = { versao: 1, seedVersao: 3, excluidos: ['sA'], comps: [{ id: 's1', nome: 's1', main: [], flex: [] }] };
  assert.deepEqual(L.mergeSeed(excl, belowSeed, 4, catalog).comps.map((c) => c.id), ['sB', 's1']);
  const excl2 = { versao: 1, seedVersao: 2, excluidos: ['sA'], comps: [{ id: 's1', nome: 's1', main: [], flex: [] }] };
  assert.deepEqual(L.mergeSeed(excl2, belowSeed, 4, catalog).comps.map((c) => c.id), ['sB', 's1']);
});

test('mergeSeed abaixoDe: preserva edicao, nao volta se B excluida e e idempotente', () => {
  const ed = { versao: 1, seedVersao: 3, excluidos: [], comps: [{ id: 'sA', nome: 'A editada', main: [u('A', { s: 3 })], flex: [] }, { id: 's1', nome: 's1', main: [], flex: [] }] };
  const r = L.mergeSeed(ed, belowSeed, 4, catalog);
  assert.equal(r.comps[0].nome, 'A editada');
  assert.equal(r.comps[0].main[0].s, 3);
  const exB = { versao: 1, seedVersao: 3, excluidos: ['sB'], comps: [{ id: 'sA', nome: 'A', main: [], flex: [] }] };
  assert.deepEqual(L.mergeSeed(exB, belowSeed, 4, catalog).comps.map((c) => c.id), ['sA']);
  const vista = L.mergeSeed(saved(['sA', 's1'], 3), belowSeed, 4, catalog);
  assert.deepEqual(L.mergeSeed({ ...vista }, belowSeed, 4, catalog).comps.map((c) => c.id), ['sA', 'sB', 's1']);
});

/* ---------- cadeia de topo: C abaixo de B (B na 2a posicao do bloco do topo) ---------- */
const sC = { id: 'sC', nome: 'C', desde: 5, topo: true, abaixoDe: 'sB', main: [u('A')], flex: [] };
const chainSeed = [sA, sB, sC].concat(seedRaw);

test('mergeSeed cadeia: sem dados salvos segue a ordem do seed (A, B, C)', () => {
  assert.deepEqual(L.mergeSeed(null, chainSeed, 5, catalog).comps.map((c) => c.id).slice(0, 3), ['sA', 'sB', 'sC']);
});

test('mergeSeed cadeia: quem ja tem versao 4 (A, B no topo) recebe C em 3o', () => {
  const r = L.mergeSeed(saved(['sA', 'sB', 's1', 's2'], 4), chainSeed, 5, catalog);
  assert.deepEqual(r.comps.map((c) => c.id), ['sA', 'sB', 'sC', 's1', 's2']);
  assert.deepEqual(r.added, ['sC']);
  assert.equal(r.seedVersao, 5);
});

test('mergeSeed cadeia: versoes 3 e 2 recebem B e C juntos na ordem do seed', () => {
  assert.deepEqual(L.mergeSeed(saved(['sA', 's1'], 3), chainSeed, 5, catalog).comps.map((c) => c.id), ['sA', 'sB', 'sC', 's1']);
  assert.deepEqual(L.mergeSeed(saved(['s1', 's2'], 2), chainSeed, 5, catalog).comps.map((c) => c.id), ['sA', 'sB', 'sC', 's1', 's2']);
});

test('mergeSeed cadeia: B movida, excluida ou fora do bloco do topo faz C cair para o topo sem quebrar', () => {
  assert.deepEqual(L.mergeSeed(saved(['sA', 's1', 'sB', 's2'], 4), chainSeed, 5, catalog).comps.map((c) => c.id), ['sC', 'sA', 's1', 'sB', 's2']);
  assert.deepEqual(L.mergeSeed(saved(['s1', 'sA', 'sB'], 4), chainSeed, 5, catalog).comps.map((c) => c.id), ['sC', 's1', 'sA', 'sB']);
  const excl = { versao: 1, seedVersao: 4, excluidos: ['sB'], comps: [{ id: 'sA', nome: 'A', main: [], flex: [] }, { id: 's1', nome: 's1', main: [], flex: [] }] };
  assert.deepEqual(L.mergeSeed(excl, chainSeed, 5, catalog).comps.map((c) => c.id), ['sC', 'sA', 's1']);
});

test('mergeSeed cadeia: preserva edicao, nao volta se C excluida e e idempotente', () => {
  const ed = { versao: 1, seedVersao: 4, excluidos: [], comps: [{ id: 'sA', nome: 'A', main: [], flex: [] }, { id: 'sB', nome: 'B editada', main: [u('B', { s: 3 })], flex: [] }, { id: 's1', nome: 's1', main: [], flex: [] }] };
  const r = L.mergeSeed(ed, chainSeed, 5, catalog);
  assert.equal(r.comps[1].nome, 'B editada');
  assert.equal(r.comps[1].main[0].s, 3);
  const exC = { versao: 1, seedVersao: 4, excluidos: ['sC'], comps: [{ id: 'sA', nome: 'A', main: [], flex: [] }, { id: 'sB', nome: 'B', main: [], flex: [] }] };
  assert.deepEqual(L.mergeSeed(exC, chainSeed, 5, catalog).comps.map((c) => c.id), ['sA', 'sB']);
  const vista = L.mergeSeed(saved(['sA', 'sB', 's1'], 4), chainSeed, 5, catalog);
  assert.deepEqual(L.mergeSeed({ ...vista }, chainSeed, 5, catalog).comps.map((c) => c.id), ['sA', 'sB', 'sC', 's1']);
});
