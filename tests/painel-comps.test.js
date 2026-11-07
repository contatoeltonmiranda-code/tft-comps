const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const P = require('../js/painel-logic.js');
const C = require('../js/painel-comps.js');
const R = require('../js/recommend.js');

const catalog = {
  champs: [
    { id: 'A', n: 'Alfa', c: 1 },
    { id: 'B', n: 'Beta', c: 2 },
    { id: 'C', n: 'Gama', c: 3 },
    { id: 'D', n: 'Delta', c: 4 },
    { id: 'E', n: 'Epsilon', c: 1 },
    { id: 'F', n: 'Zeta', c: 2 },
    { id: 'G', n: 'Eta', c: 5 },
    { id: 'H', n: 'Teta', c: 3 },
  ],
  traits: [],
  items: [
    { id: 'IE', n: 'Espada Dupla', k: 'completo' },
    { id: 'IR', n: 'Arco Veloz', k: 'completo' },
    { id: 'CS', n: 'Espada', k: 'componente' },
    { id: 'CB', n: 'Arco', k: 'componente' },
  ],
};
const recipes = {
  componentes: { CS: { n: 'Espada' }, CB: { n: 'Arco' } },
  receitas: { IE: ['CS', 'CS'], IR: ['CS', 'CB'] },
};
const u = (c, extra = {}) => ({ c, s: 1, i: [], a: [], ...extra });
const seed = [
  { id: 'x1', nome: 'Comp X', estilo: 'Fast 8', main: [u('C'), u('D', { i: ['IE'] }), u('G'), u('H')], flex: [], fases: { inicio: ['A', 'E'], meio: ['B', 'C', 'F'], origem: 'derivado' } },
  { id: 'y1', nome: 'Comp Y', estilo: 'Slowroll Nvl 6', main: [u('A', { i: ['IR'] }), u('B'), u('F'), u('C')], flex: [], fases: { inicio: ['A', 'B'], meio: ['A', 'B', 'F', 'C'], origem: 'derivado' } },
  { id: 'z1', nome: 'Comp Z', estilo: 'Fast 9', main: [u('G'), u('D'), u('H')], flex: [] },
];
const dados = { seed, catalog, recipes };
const est = (o = {}) => Object.assign(P.estadoInicial(), { stage: '2-2', level: 3 }, o);

test('faseDaRodada: estagios 1-2 = inicio, 3-4 = meio, 5+ = fim', () => {
  ['1-1', '1-4', '2-1', '2-7'].forEach((s) => assert.equal(C.faseDaRodada(s), 'inicio', s));
  ['3-1', '3-7', '4-1', '4-7'].forEach((s) => assert.equal(C.faseDaRodada(s), 'meio', s));
  ['5-1', '6-3', '7-7'].forEach((s) => assert.equal(C.faseDaRodada(s), 'fim', s));
  assert.equal(C.faseDaRodada('lixo'), 'inicio');
});

test('estadoParaRecommend: copias viram unidades; 3 copias = 1 unidade 2 estrelas; componentes viram itens', () => {
  const e = est({ champs: { A: 2, B: 3, C: 1, D: 9, E: 4 }, comps: { CS: 2, CB: 1 } });
  const r = C.estadoParaRecommend(e, catalog);
  const por = (id) => r.board.filter((x) => x.c === id);
  assert.equal(por('A').length, 2);
  assert.ok(por('A').every((x) => x.s === 1));
  assert.deepEqual(por('B').map((x) => x.s), [2]);
  assert.deepEqual(por('C').map((x) => x.s), [1]);
  assert.deepEqual(por('D').map((x) => x.s), [3]);
  assert.deepEqual(por('E').map((x) => x.s).sort(), [1, 2]);
  assert.deepEqual(r.itens.slice().sort(), ['CB', 'CS', 'CS']);
  assert.equal(r.level, 3);
});

test('rankear: devolve todas as comps do seed, ordenadas por score, com a fase da rodada', () => {
  const r = C.rankear(est({ champs: { A: 1, E: 1 } }), dados);
  assert.equal(r.fase, 'inicio');
  assert.equal(r.itens.length, seed.length);
  const scores = r.itens.map((x) => x.score);
  assert.deepEqual(scores, scores.slice().sort((a, b) => b - a));
  assert.equal(r.itens[0].id, 'x1');
});

test('rankear: no estagio 2 usa fases.inicio; no estagio 3-4 usa fases.meio; no 5+ usa o board final', () => {
  const e2 = C.rankear(est({ stage: '2-3', champs: { A: 1, E: 1 } }), dados).itens.find((x) => x.id === 'x1');
  assert.deepEqual(e2.unidadesFase, ['A', 'E']);
  assert.equal(e2.coberturaFase, 1);
  const e3 = C.rankear(est({ stage: '3-2', level: 6, champs: { A: 1, E: 1 } }), dados).itens.find((x) => x.id === 'x1');
  assert.deepEqual(e3.unidadesFase, ['B', 'C', 'F']);
  assert.equal(e3.coberturaFase, 0);
  const e5 = C.rankear(est({ stage: '5-1', level: 8, champs: { C: 1, D: 1 } }), dados).itens.find((x) => x.id === 'x1');
  assert.deepEqual(e5.unidadesFase, ['C', 'D', 'G', 'H']);
  assert.equal(e5.coberturaFase, 0.5);
});

test('rankear: comp sem fases cai no board final', () => {
  const z = C.rankear(est({ champs: { G: 1 } }), dados).itens.find((x) => x.id === 'z1');
  assert.deepEqual(z.unidadesFase, ['G', 'D', 'H']);
});

test('rankear: par vale mais que 1 copia; 3 copias (2 estrelas) valem mais que o par', () => {
  const sc = (n) => C.rankear(est({ champs: { A: n } }), dados).itens.find((x) => x.id === 'y1').partes.campeoes;
  assert.ok(sc(2) > sc(1));
  assert.ok(sc(3) > sc(2));
  assert.equal(C.rankear(est({ champs: { A: 2 } }), dados).itens.find((x) => x.id === 'y1').pares, 1);
});

test('rankear: itens por componente (receita): montavel, parcial e o que falta', () => {
  const y = (comps) => C.rankear(est({ stage: '3-2', level: 6, champs: { A: 1 }, comps }), dados).itens.find((x) => x.id === 'y1');
  const montavel = y({ CS: 1, CB: 1 });
  assert.equal(montavel.itensStatus[0].id, 'IR');
  assert.equal(montavel.itensStatus[0].estado, 'montavel');
  const parcial = y({ CS: 1 });
  assert.equal(parcial.itensStatus[0].estado, 'parcial');
  assert.deepEqual(parcial.itensStatus[0].faltam.map((c) => c.id), ['CB']);
  assert.equal(parcial.itensStatus[0].faltam[0].n, 'Arco');
  const nada = y({});
  assert.equal(nada.itensStatus[0].estado, 'falta');
  assert.deepEqual(nada.itensStatus[0].faltam.map((c) => c.id).sort(), ['CB', 'CS']);
  assert.ok(montavel.partes.itens > parcial.partes.itens);
  assert.ok(parcial.partes.itens > nada.partes.itens);
});

test('rankear: faltam traz nome, custo e se o nivel alcanca; contest e favorita acompanham a comp', () => {
  const e = est({ stage: '3-2', level: 5, champs: { C: 1 }, contest: { x1: 2 }, favorita: 'y1' });
  const r = C.rankear(e, dados);
  const x = r.itens.find((i) => i.id === 'x1');
  assert.equal(x.contest, 2);
  assert.equal(x.favorita, false);
  assert.equal(r.itens.find((i) => i.id === 'y1').favorita, true);
  assert.deepEqual(x.faltam.map((f) => f.n).sort(), ['Beta', 'Zeta']);
  assert.ok(x.faltam.every((f) => typeof f.custo === 'number'));
  assert.equal(x.coberturaFim.total, 4);
  assert.equal(x.coberturaFim.tem, 1);
});

test('rankear: estado vazio nao quebra e ainda lista todas as comps', () => {
  const r = C.rankear(est(), dados);
  assert.equal(r.itens.length, seed.length);
  assert.equal(r.vazio, true);
});

// ---------------------------------------------------------------- forcar

test('avaliarForca: sem comp escolhida', () => {
  assert.equal(C.avaliarForca(est(), dados).semComp, true);
});

test('avaliarForca: comp quase pronta, sem contest, vida segura = ok', () => {
  const e = est({ stage: '3-2', level: 6, hp: 70, champs: { B: 1, C: 1, F: 1 }, favorita: 'x1' });
  const f = C.avaliarForca(e, dados);
  assert.equal(f.veredito, 'ok');
  assert.equal(f.compId, 'x1');
});

test('avaliarForca: 3+ jogadores na comp = nao force (guia: pivote)', () => {
  const e = est({ stage: '3-2', level: 6, hp: 70, champs: { B: 1, C: 1, F: 1 }, favorita: 'x1', contest: { x1: 3 } });
  const f = C.avaliarForca(e, dados);
  assert.equal(f.veredito, 'nao');
  assert.ok(f.motivos.some((m) => /3\+|3 ou mais/.test(m.texto)));
});

test('avaliarForca: 2 jogadores = arriscado em fast 8, nao force em slow roll', () => {
  const base = { stage: '3-2', level: 6, hp: 70, champs: { A: 1, B: 1, F: 1, C: 1 } };
  assert.equal(C.avaliarForca(est({ ...base, favorita: 'x1', contest: { x1: 2 } }), dados).veredito, 'arriscado');
  assert.equal(C.avaliarForca(est({ ...base, favorita: 'y1', contest: { y1: 2 } }), dados).veredito, 'nao');
});

test('avaliarForca: 1 jogador pesa no slow roll, nao no fast 8', () => {
  const base = { stage: '3-2', level: 6, hp: 70, champs: { A: 1, B: 1, F: 1, C: 1 } };
  assert.equal(C.avaliarForca(est({ ...base, favorita: 'x1', contest: { x1: 1 } }), dados).veredito, 'ok');
  assert.equal(C.avaliarForca(est({ ...base, favorita: 'y1', contest: { y1: 1 } }), dados).veredito, 'arriscado');
});

test('avaliarForca: sem base depois do 3-2 = nao force; no estagio 2 qualquer comp vale', () => {
  const sem = est({ stage: '4-2', level: 7, hp: 50, champs: { A: 1 }, favorita: 'x1' });
  assert.equal(C.avaliarForca(sem, dados).veredito, 'nao');
  const cedo = est({ stage: '2-3', champs: {}, favorita: 'x1' });
  assert.equal(C.avaliarForca(cedo, dados).veredito, 'ok');
});

test('avaliarForca: vida critica rebaixa; atencao rebaixa para arriscado', () => {
  const base = { stage: '3-5', level: 6, champs: { B: 1, C: 1, F: 1 }, favorita: 'x1' };
  assert.equal(C.avaliarForca(est({ ...base, hp: 38 }), dados).veredito, 'arriscado');
  assert.equal(C.avaliarForca(est({ ...base, hp: 25 }), dados).veredito, 'arriscado');
  assert.equal(C.avaliarForca(est({ ...base, hp: 25, champs: { B: 1 } }), dados).veredito, 'nao');
});

test('avaliarForca: diz o que buscar (unidades que faltam, alcancaveis primeiro) e os componentes', () => {
  const e = est({ stage: '3-2', level: 5, hp: 70, champs: { B: 1 }, comps: { CS: 1 }, favorita: 'y1' });
  const f = C.avaliarForca(e, dados);
  assert.ok(f.buscar.unidades.length > 0);
  assert.ok(f.buscar.unidades.every((x) => x.n));
  assert.ok(f.buscar.componentes.some((c) => c.n === 'Arco'));
  assert.ok(f.buscar.unidades[0].custo <= f.buscar.unidades[f.buscar.unidades.length - 1].custo || f.buscar.unidades[0].alcancavel);
});

test('avaliarForca: comp escolhida por parametro vence a favorita', () => {
  const e = est({ stage: '3-2', level: 6, hp: 70, favorita: 'x1', contest: { y1: 3 } });
  assert.equal(C.avaliarForca(e, dados, 'y1').compId, 'y1');
  assert.equal(C.avaliarForca(e, dados, 'y1').veredito, 'nao');
});

// ---------------------------------------------------------------- BIS

test('bisDoCampeao: itens dos seeds em que o campeao aparece no main, so os que tem receita', () => {
  assert.deepEqual(C.bisDoCampeao('D', seed, recipes), ['IE']);
  assert.deepEqual(C.bisDoCampeao('A', seed, recipes), ['IR']);
  assert.deepEqual(C.bisDoCampeao('B', seed, recipes), []);
});

test('bisAvaliacao: confirma quando os componentes montam um item BIS', () => {
  assert.equal(C.bisAvaliacao('D', est({ comps: { CS: 2 } }), dados).estado, 'ok');
  assert.equal(C.bisAvaliacao('D', est({ comps: { CS: 1 } }), dados).estado, 'falta');
  assert.equal(C.bisAvaliacao('B', est({ comps: { CS: 2 } }), dados).estado, 'desconhecido');
});

// ---------------------------------------------------------------- dados reais

function carregar() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  ['catalog', 'recipes', 'seed'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '../data/' + f + '.js'), 'utf8'), ctx));
  return { seed: ctx.window.TFT_SEED, catalog: ctx.window.TFT_CATALOG, recipes: ctx.window.TFT_RECIPES };
}

test('dados reais: ranking cobre as 24 comps em todas as fases, sem NaN', () => {
  const d = carregar();
  ['2-3', '3-4', '4-2', '5-1'].forEach((stage) => {
    const e = P.sanitizarEstado({ stage, level: 6, gold: 30, champs: { DA_18_Veigar: 2, DA_18_Ornn: 3 }, comps: { DA_Component_BFSword: 2 } }, d.catalog);
    const r = C.rankear(e, d);
    assert.equal(r.itens.length, d.seed.length, stage);
    r.itens.forEach((x) => assert.ok(Number.isFinite(x.score) && x.score >= 0 && x.score <= 100, x.id + ' ' + x.score));
  });
});

test('dados reais: quem tem os campeoes do inicio de uma comp a coloca no topo', () => {
  const d = carregar();
  const alvo = d.seed.find((c) => c.id === 'seed-17');
  const champs = {};
  alvo.fases.inicio.forEach((id) => { champs[id] = 2; });
  const e = P.sanitizarEstado({ stage: '2-5', level: 4, gold: 10, champs }, d.catalog);
  const r = C.rankear(e, d);
  assert.ok(r.itens.slice(0, 3).some((x) => x.id === 'seed-17'), r.itens.slice(0, 3).map((x) => x.id).join());
});

test('pontuarComp (recommend.js) continua exportado e aceita unidades da fase', () => {
  assert.equal(typeof R.pontuarComp, 'function');
  const comp = seed[0];
  const estado = { stage: '2-2', gold: 10, level: 3, board: [{ c: 'A', s: 1, i: [] }], bench: [], itens: [] };
  const base = R.pontuarComp(comp, estado, catalog, recipes);
  const fase = R.pontuarComp(comp, estado, catalog, recipes, { unidades: ['A', 'E'] });
  assert.ok(fase.partes.campeoes > base.partes.campeoes);
});

// -------------------------------------------------------------- slamaveis e comps atuais do Elton

test('itensSlamaveis: itens completos que os componentes na mao montam (qualquer receita, nao so os dos seeds)', () => {
  assert.deepEqual(C.itensSlamaveis(est({ comps: {} }), dados), []);
  assert.deepEqual(C.itensSlamaveis(est({ comps: { CS: 1 } }), dados), []);
  assert.deepEqual(C.itensSlamaveis(est({ comps: { CS: 2 } }), dados), ['IE']);
  assert.deepEqual(C.itensSlamaveis(est({ comps: { CS: 1, CB: 1 } }), dados), ['IR']);
  assert.deepEqual(C.itensSlamaveis(est({ comps: { CS: 2, CB: 1 } }), dados).sort(), ['IE', 'IR']);
  assert.deepEqual(C.itensSlamaveis(est({ comps: { CS: 2 } }), { seed: [], catalog, recipes: { componentes: {}, receitas: {} } }), []);
});

const guardado = (o) => JSON.stringify(Object.assign({ versao: 1, seedVersao: 1, excluidos: [], comps: [] }, o));
const compU = (c, extra) => ({ c, s: 1, i: [], a: [], ...extra });

test('carregarComps: sem nada salvo (ou lixo) devolve as comps do seed', () => {
  [null, '', 'nao e json', '{"a":1}', '[]', 'null'].forEach((raw) => {
    const r = C.carregarComps(raw, seed, 1, catalog);
    assert.deepEqual(r.map((c) => c.id), ['x1', 'y1', 'z1'], String(raw));
  });
});

test('carregarComps: usa a lista salva do Elton: comp editada, comp nova e comp excluida', () => {
  const raw = guardado({
    excluidos: ['y1', 'z1'],
    comps: [
      { id: 'x1', nome: 'Comp X do Elton', estilo: 'Fast 8', main: [compU('C'), compU('D')], flex: [] },
      { id: 'minha-1', nome: 'Minha comp nova', estilo: 'Slowroll Nvl 6', main: [compU('A'), compU('E')], flex: [] },
    ],
  });
  const r = C.carregarComps(raw, seed, 1, catalog);
  assert.deepEqual(r.map((c) => c.id), ['x1', 'minha-1']);
  assert.equal(r[0].nome, 'Comp X do Elton');
  assert.deepEqual(r[0].main.map((u) => u.c), ['C', 'D']);
  assert.ok(!r.some((c) => c.id === 'y1' || c.id === 'z1'), 'excluidas ficam de fora');
});

test('carregarComps: comp nova do seed (desde > versao vista) entra; excluida de proposito nao volta', () => {
  const seed2 = seed.concat([{ id: 'n1', nome: 'Comp N', estilo: 'Fast 8', desde: 2, main: [u('D')], flex: [] }, { id: 'n2', nome: 'Comp N2', estilo: 'Fast 8', desde: 2, main: [u('G')], flex: [] }]);
  const raw = guardado({ seedVersao: 1, excluidos: ['n2'], comps: seed });
  const r = C.carregarComps(raw, seed2, 2, catalog);
  assert.ok(r.some((c) => c.id === 'n1'));
  assert.ok(!r.some((c) => c.id === 'n2'));
});

test('carregarComps: lista salva vazia = nenhuma comp (o Elton apagou todas); nao volta o seed', () => {
  assert.deepEqual(C.carregarComps(guardado({ excluidos: ['x1', 'y1', 'z1'], comps: [] }), seed, 1, catalog), []);
});

test('rankear com as comps atuais: ranking, contest e favorita usam a lista do Elton, nao o seed', () => {
  const comps = C.carregarComps(guardado({
    excluidos: ['x1', 'y1', 'z1'],
    comps: [{ id: 'minha-1', nome: 'Minha comp nova', estilo: 'Fast 8', main: [compU('A'), compU('E'), compU('B')], flex: [] }],
  }), seed, 1, catalog);
  const r = C.rankear(est({ champs: { A: 2 }, contest: { 'minha-1': 2, x1: 3 }, favorita: 'minha-1' }), { seed: comps, catalog, recipes });
  assert.deepEqual(r.itens.map((x) => x.id), ['minha-1']);
  assert.equal(r.itens[0].nome, 'Minha comp nova');
  assert.equal(r.itens[0].contest, 2);
  assert.equal(r.itens[0].favorita, true);
  const vazio = C.rankear(est({ champs: { A: 2 } }), { seed: [], catalog, recipes });
  assert.deepEqual(vazio.itens, []);
  assert.equal(C.avaliarForca(est({ favorita: 'x1' }), { seed: comps, catalog, recipes }).semComp, true);
});
