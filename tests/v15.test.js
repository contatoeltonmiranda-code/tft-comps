const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.window = {};
require('../data/catalog.js');
require('../data/seed.js');
const L = require('../js/logic.js');
const CAT = window.TFT_CATALOG;
const SEED = window.TFT_SEED;

const ID = 'seed-38';
const ORDEM = ['seed-25', 'seed-26', 'seed-27', 'seed-28', 'seed-29', 'seed-30', 'seed-31', 'seed-32', 'seed-33', 'seed-34', 'seed-35', 'seed-36', 'seed-37', ID, 'seed-17'];
const get = (id) => SEED.find((s) => s.id === id);
const dstored = (comps, seedVersao, excluidos) => ({ versao: 1, seedVersao, excluidos: excluidos || [], comps });
const SEED14 = SEED.filter((s) => !(s.desde >= 15));
const champs = new Map(CAT.champs.map((c) => [c.id, c]));
const items = new Map(CAT.items.map((i) => [i.id, i]));
const names = (list) => list.map((u) => champs.get(u.c).n);
const iNames = (u) => u.i.map((id) => items.get(id).n);
const jaccard = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};
const traitsOf = (c) => Object.fromEntries(L.activeTraits(L.sanitizeImport([c], CAT).comps[0], CAT).map((t) => [t.n, t.count]));
const by = (c) => Object.fromEntries(c.main.map((u) => [champs.get(u.c).n, u]));

test('seed v15: versao 15, 38 comps, a nova logo abaixo da seed-37 (..., 36, 37, 38, 17...)', () => {
  assert.equal(window.TFT_SEED_VERSION, 15);
  assert.equal(SEED.length, 38);
  assert.deepEqual(SEED.slice(0, 15).map((c) => c.id), ORDEM);
  assert.equal(SEED.filter((c) => c.desde === 15).length, 1);
  const c = get(ID);
  assert.equal(c.desde, 15);
  assert.equal(c.topo, true);
  assert.equal(c.abaixoDe, 'seed-37');
  assert.equal(c.board, true);
});

test('seed v15: Sabugueiro Carrasco Alune: 9 unidades, estrelas pelo icone da barra e itens por match de pixels', () => {
  const c = get(ID);
  assert.equal(c.nome, 'Sabugueiro Carrasco Alune');
  assert.equal(c.estilo, 'Nível 9');
  assert.deepEqual(names(c.main).sort(), ['Alune', 'Aphelios', 'Diana', 'Ezreal', 'Fiddlesticks', 'Hecarim', "Kha'Zix", 'Ornn', 'Soraka']);
  assert.deepEqual(c.flex, []);
  const u = by(c);
  assert.deepEqual(Object.fromEntries(Object.entries(u).map(([n, x]) => [n, x.s])), { Ezreal: 1, Alune: 2, Aphelios: 1, "Kha'Zix": 3, Diana: 1, Hecarim: 3, Fiddlesticks: 1, Ornn: 1, Soraka: 2 });
  assert.deepEqual(iNames(u.Ezreal), ['Cajado do Vazio', 'Limiar da Noite', 'Lâmina Mortal']);
  assert.deepEqual(iNames(u.Alune), ['Morellonomicon']);
  assert.deepEqual(iNames(u.Aphelios), ['Mata-Gigantes', 'Mercúrio', 'Emblema de Carrasco']);
  assert.deepEqual(iNames(u["Kha'Zix"]), ['Mão da Justiça', 'Capuz da Morte de Rabadon', 'Limiar da Noite']);
  assert.deepEqual(iNames(u.Hecarim), ['Proteção Imutável', 'Colete Espinhoso', 'Stemmaguarda']);
  assert.deepEqual(iNames(u.Fiddlesticks), ['Capa de Fogo Solar']);
  ['Diana', 'Ornn', 'Soraka'].forEach((n) => assert.deepEqual(u[n].i, [], n));
  c.main.forEach((x) => assert.deepEqual(x.a, []));
});

test('seed v15: posicoes lidas das casas hexagonais do print (linha 1 = frente), 9 casas distintas', () => {
  const u = by(get(ID));
  assert.deepEqual(Object.fromEntries(Object.entries(u).map(([n, x]) => [n, x.p])), {
    Hecarim: [1, 5], "Kha'Zix": [1, 6], Fiddlesticks: [2, 4], Diana: [2, 5], Ornn: [3, 4], Ezreal: [3, 6], Alune: [4, 5], Soraka: [4, 6], Aphelios: [4, 7]
  });
  assert.equal(new Set(Object.values(u).map((x) => x.p.join(','))).size, 9);
  const { comps } = L.sanitizeImport([get(ID)], CAT);
  comps[0].main.forEach((x) => assert.ok(Array.isArray(x.p) && x.p.length === 2));
});

test('seed v15: tracos do app contra o painel do print (6 batem; faltam 1 de Carrasco, Enfeiticador e Fumegante, nada inventado)', () => {
  const t = traitsOf(get(ID));
  assert.equal(t['Flora Fatalis'], 2);
  assert.equal(t.Rival, 1);
  assert.equal(t['Comunhão'], 1);
  assert.equal(t.Lunar, 3);
  assert.equal(t.Sabugueiro, 3);
  assert.equal(t.Defendente, 2);
  assert.equal(t.Carrasco, 3, 'painel mostra 4: a 4a vem de unidade nao identificada ou aprimoramento');
  assert.equal(t['Enfeitiçador'], 2, 'painel mostra 3');
  assert.equal(t.Fumegante, undefined, 'painel mostra 2 (aqui so 1, inativo)');
  assert.equal(t.Vanguarda, 2, 'bate com os 2 tracos ocultos do painel (Vanguarda 2 + Devastador 1)');
  assert.match(get(ID).nota, /não fecham/);
});

test('seed v15: unidade vermelha 2 estrelas (casa 4,1 e bancada) nao entra; Yunara so como pendencia no texto', () => {
  const c = get(ID);
  assert.ok(!c.main.concat(c.flex).some((x) => x.c === 'DA_18_Yunara'));
  assert.match(c.dicas.linhas.join(' '), /Yunara/);
  assert.match(c.dicas.linhas.join(' '), /4,1/);
});

test('seed v15: ids no catalogo, itens <= 3 e a comp sobrevive ao sanitizeImport', () => {
  const c = get(ID);
  c.main.forEach((u) => {
    assert.ok(champs.has(u.c), u.c);
    assert.ok(u.i.length <= 3);
    u.i.forEach((x) => assert.ok(items.has(x), x));
  });
  assert.equal(new Set(c.main.map((u) => u.c)).size, 9);
  const { comps, dropped } = L.sanitizeImport([c], CAT);
  assert.equal(dropped, 0);
  assert.deepEqual(comps[0].main.map((u) => u.i), c.main.map((u) => u.i));
  assert.deepEqual(comps[0].main.map((u) => u.s), c.main.map((u) => u.s));
  assert.deepEqual(comps[0].main.map((u) => u.p), c.main.map((u) => u.p));
});

test('seed v15: fases derivadas do proprio board, dicas e textos dentro dos limites', () => {
  const c = get(ID);
  assert.equal(c.fases.origem, 'derivado');
  assert.equal(c.fasesDesde, undefined);
  assert.ok(c.fases.ref && c.fases.ref.length <= 100);
  assert.ok(c.fases.inicio.length >= 3 && c.fases.inicio.length <= 5);
  assert.ok(c.fases.meio.length >= 6 && c.fases.meio.length <= 7);
  assert.ok(c.fases.inicio.every((x) => champs.get(x).c <= 3));
  assert.ok(c.fases.meio.every((x) => champs.get(x).c <= 4));
  const own = new Set(c.main.map((x) => x.c));
  c.fases.inicio.concat(c.fases.meio).forEach((x) => assert.ok(own.has(x), x));
  assert.ok(c.dicas.linhas.length >= 3 && c.dicas.linhas.length <= 8);
  c.dicas.linhas.forEach((l) => assert.ok(l.length <= 240, l.length));
  assert.ok(c.dicas.ref && c.dicas.ref.length <= 100);
  assert.equal(c.dicas.url, undefined);
  assert.ok(c.nota && c.nota.length <= 500, c.nota.length);
  assert.ok(c.fonte.length <= 100);
  const sane = L.sanitizeImport([c], CAT).comps[0];
  assert.deepEqual(sane.fases.inicio, c.fases.inicio);
  assert.deepEqual(sane.fases.meio, c.fases.meio);
  assert.equal(sane.nota, c.nota);
  assert.equal(sane.dicas.linhas.length, c.dicas.linhas.length);
});

test('seed v15: e evolucao da seed-05 (8 das 9 unidades; Jaccard >= 0,70 so com ela, pedido explicito do Elton) e nao duplica as demais', () => {
  const nb = get(ID).main.map((u) => u.c);
  const s05 = get('seed-05');
  assert.ok(jaccard(nb, s05.main.concat(s05.flex).map((u) => u.c)) >= 0.7);
  SEED.filter((o) => o.id !== ID && o.id !== 'seed-05').forEach((o) => {
    assert.ok(jaccard(nb, o.main.concat(o.flex).map((u) => u.c)) < 0.7, ID + ' x ' + o.id);
  });
});

test('seed v15: print refs/39.png existe e a fonte aponta para ele', () => {
  assert.ok(fs.statSync(path.join(__dirname, '..', 'refs', '39.png')).size > 10000);
  assert.match(get(ID).fonte, /refs\/39\.png/);
});

test('seed v15: nenhum Riot ID/nome de jogador na comp nova (repo publico)', () => {
  assert.doesNotMatch(JSON.stringify(get(ID)), /k1ozera|ntxstage|BaWzEr|Inefável|ErikLewis|DETETIVE|DobZ/i);
});

test('seed v15: quem esta na v14 recebe a comp logo abaixo da seed-37, sem perder edicao; excluida nao volta; nao duplica', () => {
  const v14 = L.sanitizeImport(SEED14, CAT).comps;
  v14[8].nome = 'Editada';
  const r = L.mergeSeed(dstored(v14, 14), SEED, 15, CAT);
  assert.deepEqual(r.added, [ID]);
  assert.equal(r.seedVersao, 15);
  assert.equal(r.comps.length, 38);
  assert.deepEqual(r.comps.slice(0, 15).map((c) => c.id), ORDEM);
  assert.equal(r.comps[8].nome, 'Editada');
  const again = L.mergeSeed(dstored(r.comps, 15), SEED, 15, CAT);
  assert.deepEqual(again.added, []);
  assert.equal(again.comps.length, 38);
  const ex = L.mergeSeed(dstored(v14, 14, [ID]), SEED, 15, CAT);
  assert.deepEqual(ex.added, []);
  assert.ok(!ex.comps.some((c) => c.id === ID));
});

test('seed v15: usuario que reordenou mantem a ordem dele; a nova entra logo abaixo da seed-37 onde ela estiver', () => {
  const v14 = L.sanitizeImport(SEED14, CAT).comps;
  const reord = v14.slice();
  const [mov] = reord.splice(0, 1);
  reord.push(mov);
  const r = L.mergeSeed(dstored(reord, 14), SEED, 15, CAT);
  assert.deepEqual(r.added, [ID]);
  const ids = r.comps.map((c) => c.id);
  assert.equal(ids[ids.indexOf('seed-37') + 1], ID);
  assert.deepEqual(ids.filter((x) => x !== ID), reord.map((c) => c.id));
});

test('seed v15: usuario novo recebe as 38 comps na ordem do seed', () => {
  const r = L.mergeSeed(null, SEED, 15, CAT);
  assert.equal(r.comps.length, 38);
  assert.deepEqual(r.comps.slice(0, 15).map((c) => c.id), ORDEM);
  assert.ok(r.comps.find((c) => c.id === ID).main.every((u) => u.p));
});
