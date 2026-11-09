const test = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../data/catalog.js');
require('../data/seed.js');
const L = require('../js/logic.js');
const CAT = window.TFT_CATALOG;
const SEED = window.TFT_SEED;

const ID = 'seed-25';
const comp = () => SEED.find((s) => s.id === ID);
const dstored = (comps, seedVersao, excluidos) => ({ versao: 1, seedVersao, excluidos: excluidos || [], comps });
const SEED7 = SEED.filter((s) => s.id !== ID);

test('seed v8: versao 8, 25 comps, Fera do Rift Fast 10 e a primeira da lista, fixada no topo', () => {
  assert.equal(window.TFT_SEED_VERSION, 8);
  assert.equal(SEED.length, 25);
  assert.equal(SEED[0].id, ID);
  assert.equal(SEED[0].desde, 8);
  assert.equal(SEED[0].topo, true);
  assert.equal(SEED[0].abaixoDe, undefined);
  assert.equal(SEED[1].id, 'seed-17');
  assert.equal(SEED.filter((c) => c.desde === 8).length, 1);
});

test('seed v8: board do guia Fast 10 (refs/21): 7 unidades, estrelas, itens e casas lidas do print', () => {
  const c = comp();
  assert.equal(c.nome, 'Fera do Rift Rubrivira Fast 10');
  assert.equal(c.estilo, 'Fast 10');
  assert.equal(c.fonte, 'refs/21.png');
  assert.equal(c.board, true);
  const by = Object.fromEntries(c.main.map((u) => [u.c, u]));
  assert.deepEqual(Object.keys(by).sort(), ['DA_18_ElderDragon', 'DA_18_Sentry', 'DA_Brambleback18', 'DA_Krug18', 'DA_Murkwolf18', 'DA_Sentinel18', 'DA_Taric18']);
  assert.deepEqual(Object.fromEntries(c.main.map((u) => [u.c, u.s])), { DA_Brambleback18: 2, DA_18_ElderDragon: 1, DA_Krug18: 3, DA_Sentinel18: 2, DA_Taric18: 2, DA_Murkwolf18: 2, DA_18_Sentry: 2 });
  assert.deepEqual(by.DA_Krug18.i, ['DA_GargoyleStoneplate', 'DA_SpiritVisage', 'DA_WarmogsArmor']);
  assert.deepEqual(by.DA_18_ElderDragon.i, ['DA_InfinityEdge', 'DA_LastWhisper', 'DA_StrikersFlail']);
  assert.deepEqual(by.DA_Brambleback18.i, ['DA_EdgeOfNight', 'DA_GuinsoosRageblade', 'DA_Quicksilver']);
  assert.deepEqual(by.DA_Taric18.p, [1, 3]);
  assert.deepEqual(by.DA_Krug18.p, [1, 4]);
  assert.deepEqual(by.DA_Sentinel18.p, [1, 5]);
  assert.deepEqual(by.DA_18_ElderDragon.p, [2, 3]);
  assert.deepEqual(by.DA_Murkwolf18.p, [3, 2]);
  assert.deepEqual(by.DA_Brambleback18.p, [4, 1]);
  assert.deepEqual(by.DA_18_Sentry.p, [4, 2]);
  const cells = c.main.map((u) => u.p.join(','));
  assert.equal(new Set(cells).size, cells.length);
});

test('seed v8: tracos e flex (apoio da partida real), tudo validado no catalogo', () => {
  const { comps, dropped } = L.sanitizeImport([comp()], CAT);
  assert.equal(dropped, 0);
  const sane = comps[0];
  assert.deepEqual(sane.main, comp().main);
  assert.deepEqual(sane.flex.map((u) => u.c).sort(), ['DA_18_Ashe', 'DA_18_Ivern', 'DA_CrimsonRaptor18', 'DA_Cinderling18', 'DA_Gromp18_AP'].sort());
  assert.ok(sane.flex.every((u) => !u.p));
  const t = Object.fromEntries(L.activeTraits(sane, CAT).map((x) => [x.n, x.count]));
  assert.equal(t['Fera do Rift'], 6);
  assert.equal(t['Vanguarda'], 2);
});

test('seed v8: fases derivadas do proprio board; dicas curtas com a origem dita', () => {
  const c = comp();
  const ch = new Map(CAT.champs.map((x) => [x.id, x]));
  assert.equal(c.fases.origem, 'derivado');
  assert.equal(c.fases.url, undefined);
  assert.ok(c.fases.inicio.length >= 3 && c.fases.inicio.length <= 5);
  assert.ok(c.fases.meio.length >= 6 && c.fases.meio.length <= 7);
  assert.ok(c.fases.inicio.every((id) => ch.get(id).c <= 3));
  assert.ok(c.fases.meio.every((id) => ch.get(id).c <= 4));
  const own = new Set(c.main.concat(c.flex).map((x) => x.c));
  c.fases.inicio.concat(c.fases.meio).forEach((id) => assert.ok(own.has(id), id));
  assert.ok(c.dicas.linhas.length >= 3 && c.dicas.linhas.length <= 8);
  c.dicas.linhas.forEach((l) => assert.ok(l.length <= 240));
  assert.ok(c.dicas.ref && c.dicas.ref.length <= 100);
  assert.equal(c.dicas.url, undefined);
  assert.ok(c.nota && c.nota.length <= 500);
});

test('seed v8: nenhum Riot ID de jogador na comp nova (repo publico)', () => {
  assert.doesNotMatch(JSON.stringify(comp()), /k1ozera|ntxstage|BaWzEr/i);
});

test('seed v8: quem esta na v7 recebe a comp no topo, sem perder edicao; excluida nao volta; nao duplica', () => {
  const v7 = L.sanitizeImport(SEED7, CAT).comps;
  v7[0].nome = 'Editada';
  const r = L.mergeSeed(dstored(v7, 7), SEED, 8, CAT);
  assert.deepEqual(r.added, [ID]);
  assert.equal(r.seedVersao, 8);
  assert.equal(r.comps.length, 25);
  assert.equal(r.comps[0].id, ID);
  assert.equal(r.comps[1].nome, 'Editada');
  const again = L.mergeSeed(dstored(r.comps, 8), SEED, 8, CAT);
  assert.deepEqual(again.added, []);
  assert.equal(again.comps.length, 25);
  const ex = L.mergeSeed(dstored(v7, 7, [ID]), SEED, 8, CAT);
  assert.ok(!ex.comps.some((c) => c.id === ID));
});

test('seed v8: usuario que reordenou ou apagou comps fixadas mantem a ordem dele', () => {
  const v7 = L.sanitizeImport(SEED7, CAT).comps;
  const reord = v7.slice();
  const [mov] = reord.splice(0, 1);
  reord.push(mov);
  const r = L.mergeSeed(dstored(reord, 7), SEED, 8, CAT);
  assert.equal(r.comps[0].id, ID);
  assert.deepEqual(r.comps.slice(1).map((c) => c.id), reord.map((c) => c.id));
  const sem17 = v7.filter((c) => c.id !== 'seed-17');
  const r2 = L.mergeSeed(dstored(sem17, 7, ['seed-17']), SEED, 8, CAT);
  assert.equal(r2.comps[0].id, ID);
  assert.ok(!r2.comps.some((c) => c.id === 'seed-17'));
});

test('seed v8: usuario novo recebe as 25 comps com a nova no topo', () => {
  const r = L.mergeSeed(null, SEED, 8, CAT);
  assert.equal(r.comps.length, 25);
  assert.equal(r.comps[0].id, ID);
});
