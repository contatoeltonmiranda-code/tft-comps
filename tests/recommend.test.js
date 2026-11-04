const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/recommend.js');

const catalog = {
  champs: [
    { id: 'A', n: 'Alfa', c: 1, t: [] },
    { id: 'B', n: 'Beta', c: 2, t: [] },
    { id: 'C', n: 'Gama', c: 3, t: [] },
    { id: 'D', n: 'Delta', c: 4, t: [] },
    { id: 'E', n: 'Epsilon', c: 1, t: [] },
    { id: 'F', n: 'Zeta', c: 2, t: [] },
  ],
  traits: [],
  items: [
    { id: 'IE', n: 'Espada Dupla', k: 'completo' },
    { id: 'IR', n: 'Arco Veloz', k: 'completo' },
    { id: 'EM', n: 'Emblema X', k: 'emblema' },
    { id: 'KA', n: 'Artefato Y', k: 'artefato' },
    { id: 'CS', n: 'Espada', k: 'componente' },
    { id: 'CB', n: 'Arco', k: 'componente' },
  ],
};
const recipes = {
  componentes: { CS: { n: 'Espada' }, CB: { n: 'Arco' } },
  receitas: { IE: ['CS', 'CS'], IR: ['CS', 'CB'], EM: ['CB', 'CB'] },
};
const u = (c, extra = {}) => ({ c, s: 1, i: [], a: [], ...extra });
const seed = [
  { id: 'cheap', nome: 'Barata', main: [u('A'), u('B'), u('E', { i: ['IE'] })], flex: [] },
  { id: 'rich', nome: 'Cara', main: [u('C'), u('D'), u('B')], flex: [u('F')] },
  { id: 'nada', nome: 'Sem itens', main: [u('F')], flex: [] },
];
const estado = (o = {}) => ({ stage: '1-4', gold: 10, level: 3, board: [], bench: [], itens: [], ...o });

test('parseStage entende "2-1" e rejeita lixo', () => {
  assert.deepEqual(R.parseStage('2-1'), { a: 2, b: 1 });
  assert.equal(R.parseStage('x'), null);
  assert.equal(R.parseStage(undefined), null);
  assert.equal(R.parseStage('2-1-3'), null);
});

test('fase: ativa antes de 2-1, oculta em 2-1 (escolha de aprimoramento), encerrada depois', () => {
  assert.equal(R.fase('1-1'), 'ativo');
  assert.equal(R.fase('1-4'), 'ativo');
  assert.equal(R.fase('2-1'), 'aprimoramento');
  assert.equal(R.fase('2-2'), 'encerrado');
  assert.equal(R.fase('3-1'), 'encerrado');
  assert.equal(R.fase('???'), 'desconhecido');
});

test('em 2-1 e depois nao devolve comps (nada exibido na escolha de aprimoramento)', () => {
  assert.deepEqual(R.recommend(estado({ stage: '2-1', board: [{ c: 'A', s: 1, i: [] }] }), seed, catalog, recipes).top, []);
  assert.deepEqual(R.recommend(estado({ stage: '3-2' }), seed, catalog, recipes).top, []);
  assert.equal(R.recommend(estado({ stage: '2-1' }), seed, catalog, recipes).fase, 'aprimoramento');
});

test('campeoes no banco e no tabuleiro contam igual', () => {
  const a = R.recommend(estado({ board: [{ c: 'A', s: 1, i: [] }, { c: 'B', s: 1, i: [] }] }), seed, catalog, recipes);
  const b = R.recommend(estado({ bench: [{ c: 'A', s: 1, i: [] }, { c: 'B', s: 1, i: [] }] }), seed, catalog, recipes);
  assert.equal(a.top[0].id, 'cheap');
  assert.equal(a.top[0].score, b.top[0].score);
  assert.deepEqual(a.top[0].tem.sort(), ['A', 'B']);
  assert.deepEqual(a.top[0].faltam.map((f) => f.c), ['E']);
});

test('estrela 2 vale mais que estrela 1 e duas copias valem mais que uma', () => {
  const um = R.recommend(estado({ board: [{ c: 'C', s: 1, i: [] }] }), seed, catalog, recipes).top.find((x) => x.id === 'rich');
  const dois = R.recommend(estado({ board: [{ c: 'C', s: 2, i: [] }] }), seed, catalog, recipes).top.find((x) => x.id === 'rich');
  const copias = R.recommend(estado({ board: [{ c: 'C', s: 1, i: [] }], bench: [{ c: 'C', s: 1, i: [] }] }), seed, catalog, recipes).top.find((x) => x.id === 'rich');
  assert.ok(dois.partes.campeoes > um.partes.campeoes);
  assert.ok(copias.partes.campeoes > um.partes.campeoes);
});

test('item pronto > receita montavel > um componente > nada', () => {
  const base = { board: [{ c: 'E', s: 1, i: [] }] };
  const score = (itens, extra = {}) => R.recommend(estado({ ...base, itens, ...extra }), seed, catalog, recipes).top.find((x) => x.id === 'cheap').partes.itens;
  const pronto = score(['IE']);
  const montavel = score(['CS', 'CS']);
  const parcial = score(['CS']);
  const nada = score(['CB']);
  assert.equal(pronto, 1);
  assert.ok(montavel < pronto && montavel > parcial, `montavel ${montavel} parcial ${parcial}`);
  assert.ok(parcial > nada);
  assert.equal(nada, 0);
});

test('componente nao e usado duas vezes', () => {
  const dupla = { id: 'dupla', nome: 'Dois itens iguais', main: [u('A', { i: ['IE', 'IE'] })], flex: [] };
  const r = R.recommend(estado({ board: [{ c: 'A', s: 1, i: [] }], itens: ['CS', 'CS'] }), [dupla], catalog, recipes).top[0];
  assert.equal(r.itens.montaveis.length, 1);
  assert.equal(r.itens.faltando.length + r.itens.parciais.length, 1);
});

test('item equipado numa unidade conta como item pronto', () => {
  const r = R.recommend(estado({ board: [{ c: 'A', s: 1, i: ['IE'] }] }), seed, catalog, recipes).top.find((x) => x.id === 'cheap');
  assert.equal(r.partes.itens, 1);
  assert.deepEqual(r.itens.prontos, ['IE']);
});

test('comp sem itens avaliaveis ignora o eixo itens (artefato e radiante nao entram)', () => {
  const art = { id: 'art', nome: 'Artefato', main: [u('A', { i: ['KA'] })], flex: [] };
  const r = R.recommend(estado({ board: [{ c: 'A', s: 1, i: [] }] }), [art], catalog, recipes).top[0];
  assert.equal(r.partes.itens, null);
  assert.ok(r.score > 0);
});

test('nivel baixo penaliza campeoes caros que faltam; ouro ajuda', () => {
  const pobre = R.recommend(estado({ gold: 0, level: 3, board: [{ c: 'B', s: 1, i: [] }] }), seed, catalog, recipes).top.find((x) => x.id === 'rich');
  const rico = R.recommend(estado({ gold: 40, level: 3, board: [{ c: 'B', s: 1, i: [] }] }), seed, catalog, recipes).top.find((x) => x.id === 'rich');
  const nivel7 = R.recommend(estado({ gold: 40, level: 7, board: [{ c: 'B', s: 1, i: [] }] }), seed, catalog, recipes).top.find((x) => x.id === 'rich');
  assert.ok(rico.partes.economia > pobre.partes.economia);
  assert.ok(nivel7.partes.economia > rico.partes.economia);
  assert.equal(pobre.faltam.find((f) => f.c === 'D').alcancavel, false);
  assert.equal(nivel7.faltam.find((f) => f.c === 'D').alcancavel, true);
});

test('top 3 ordenado por score e desempata pela ordem do seed', () => {
  const r = R.recommend(estado(), seed, catalog, recipes);
  assert.equal(r.top.length, 3);
  for (let i = 1; i < r.top.length; i++) assert.ok(r.top[i - 1].score >= r.top[i].score);
  const iguais = R.recommend(estado(), [seed[0], { ...seed[0], id: 'copia' }], catalog, recipes);
  assert.deepEqual(iguais.top.map((x) => x.id), ['cheap', 'copia']);
});

test('estado vazio marca semDados e nao quebra', () => {
  const r = R.recommend(estado(), seed, catalog, recipes);
  assert.equal(r.semDados, true);
  assert.equal(r.fase, 'ativo');
});

test('entradas invalidas nao quebram (campeao desconhecido, estado nulo, seed vazio)', () => {
  assert.doesNotThrow(() => R.recommend(estado({ board: [{ c: 'ZZZ', s: 1, i: ['??'] }] }), seed, catalog, recipes));
  assert.doesNotThrow(() => R.recommend(null, seed, catalog, recipes));
  assert.deepEqual(R.recommend(estado(), [], catalog, recipes).top, []);
  assert.equal(R.recommend(null, seed, catalog, recipes).fase, 'desconhecido');
});

test('motivos em portugues citam campeoes que faltam e itens', () => {
  const r = R.recommend(estado({ board: [{ c: 'A', s: 1, i: [] }, { c: 'E', s: 1, i: [] }], itens: ['IE'] }), seed, catalog, recipes).top[0];
  assert.equal(r.id, 'cheap');
  const txt = r.motivos.join(' | ');
  assert.match(txt, /2\/3 campe/);
  assert.match(txt, /Espada Dupla/);
  assert.match(txt, /Beta/);
});

test('nao le nem expoe aprimoramentos: estado com augments e ignorado', () => {
  const sujo = estado({ board: [{ c: 'A', s: 1, i: [] }], augments: ['DA_X'], aprimoramentos: ['DA_Y'] });
  const r = R.recommend(sujo, seed, catalog, recipes);
  assert.equal(JSON.stringify(r).includes('DA_X'), false);
  assert.equal(JSON.stringify(r).includes('DA_Y'), false);
});

test('integracao com seed e catalogo reais', () => {
  global.window = {};
  delete require.cache[require.resolve('../data/catalog.js')];
  require('../data/catalog.js');
  require('../data/seed.js');
  require('../data/recipes.js');
  const { TFT_CATALOG: cat, TFT_SEED: sd, TFT_RECIPES: rec } = global.window;
  const seed16 = sd.find((s) => s.id === 'seed-16');
  const board = seed16.main.slice(0, 3).map((x) => ({ c: x.c, s: 1, i: [] }));
  const r = R.recommend({ stage: '1-4', gold: 8, level: 3, board, bench: [], itens: ['DA_Component_BFSword', 'DA_Component_BFSword'] }, sd, cat, rec);
  assert.equal(r.top.length, 3);
  assert.equal(r.top[0].id, 'seed-16');
  r.top.forEach((x) => assert.ok(x.score >= 0 && x.score <= 100));
  delete global.window;
});
