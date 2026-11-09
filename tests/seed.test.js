const test = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../data/catalog.js');
require('../data/seed.js');
const L = require('../js/logic.js');
const CAT = window.TFT_CATALOG;
const SEED = window.TFT_SEED;

test('seed: ids unicos e todos os campeoes/itens existem no catalogo', () => {
  const ids = new Set(SEED.map((c) => c.id));
  assert.equal(ids.size, SEED.length);
  const { comps, dropped } = L.sanitizeImport(SEED, CAT);
  assert.equal(dropped, 0);
  assert.equal(comps.length, SEED.length);
});

test('seed: 15 comps originais intactas (ids 01..15 sem desde), seed-16 desde 2, seed-17 desde 3, seed-18 desde 4, seed-19 desde 5, seed-20..24 desde 7, seed-25 desde 8 e seed-26..27 desde 9 no topo', () => {
  assert.equal(SEED.length, 27);
  assert.deepEqual(SEED.slice(0, 3).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27']);
  const byId = (id) => SEED.find((c) => c.id === id);
  for (let i = 1; i <= 15; i++) assert.equal(byId('seed-' + String(i).padStart(2, '0')).desde, undefined);
  assert.equal(byId('seed-16').desde, 2);
  assert.equal(SEED[3].id, 'seed-17');
  assert.equal(SEED[3].desde, 3);
  assert.equal(SEED[3].topo, true);
  assert.equal(SEED[4].id, 'seed-18');
  assert.equal(SEED[4].desde, 4);
  assert.equal(SEED[4].topo, true);
  assert.equal(SEED[4].abaixoDe, 'seed-17');
  assert.equal(SEED[5].id, 'seed-19');
  assert.equal(SEED[5].desde, 5);
  assert.equal(SEED[5].topo, true);
  assert.equal(SEED[5].abaixoDe, 'seed-18');
  assert.equal(SEED.filter((c) => c.topo).length, 11);
  assert.equal(window.TFT_SEED_VERSION, 9);
});

test('seed-16 (print 14): tracos batem com o painel do print', () => {
  const comp = L.sanitizeImport(SEED, CAT).comps.find((c) => c.id === 'seed-16');
  assert.equal(comp.main.length, 8);
  const t = Object.fromEntries(L.activeTraits(comp, CAT).map((x) => [x.n, x.count]));
  assert.equal(t['Defendente'], 6);
  assert.equal(t['Rival'], 1);
  assert.equal(t['Enfeitiçador'], 2);
  assert.equal(t['Flora Fatalis'], 1);
  ['Congregação das Bruxas', 'Emanador', 'Feérico', 'Inferno'].forEach((n) => assert.equal(t[n], undefined, n + ' inativo no print'));
  const tn = Object.fromEntries(CAT.traits.map((x) => [x.id, x.n]));
  const cnt = {};
  comp.main.forEach((u) => CAT.champs.find((c) => c.id === u.c).t.forEach((id) => { cnt[tn[id]] = (cnt[tn[id]] || 0) + 1; }));
  assert.equal(cnt['Congregação das Bruxas'], 2);
  assert.equal(cnt['Emanador'], 1);
  assert.equal(cnt['Feérico'], 1);
  assert.equal(cnt['Inferno'], 1);
});

test('seed-17 (print 15): tracos batem com o painel (Enfeitiçador 5 + 1 emblema = 6)', () => {
  const comp = L.sanitizeImport(SEED, CAT).comps.find((c) => c.id === 'seed-17');
  assert.equal(comp.nome, 'Enfeitiçador 6');
  assert.equal(comp.main.length, 8);
  assert.equal(new Set(comp.main.map((u) => u.c)).size, 8);
  assert.ok(comp.main.every((u) => !u.p));
  const t = Object.fromEntries(L.activeTraits(comp, CAT).map((x) => [x.n, x.count]));
  assert.equal(t['Enfeitiçador'], 5);
  assert.equal(t['Sabugueiro'], 3);
  assert.equal(t['Defendente'], 2);
  assert.equal(t['Espinhos Negros'], 2);
  assert.equal(t['Lutador'], 2);
  assert.equal(t['Flora Fatalis'], 1);
  const tn = Object.fromEntries(CAT.traits.map((x) => [x.id, x.n]));
  const cnt = {};
  comp.main.forEach((u) => CAT.champs.find((c) => c.id === u.c).t.forEach((id) => { cnt[tn[id]] = (cnt[tn[id]] || 0) + 1; }));
  assert.equal(cnt['Comunhão'], 1);
  assert.equal(cnt['Lunar'], 1);
  assert.equal(cnt['Congregação das Bruxas'], 1);
});

test('seed-18 (print 16): tracos batem com o painel (1 Emblema de Lutador na Master Yi)', () => {
  const comp = L.sanitizeImport(SEED, CAT).comps.find((c) => c.id === 'seed-18');
  assert.equal(comp.nome, 'Lutador Florescer Adaptador');
  assert.equal(comp.main.length, 8);
  assert.equal(new Set(comp.main.map((u) => u.c)).size, 8);
  assert.equal(comp.main.filter((u) => u.p).length, 7, 'posicoes do frame do video 18.5C (Gnar nao aparece no frame)');
  assert.equal(comp.main.find((u) => u.c === 'DA_18_GnarSmall').p, undefined);
  const t = Object.fromEntries(L.activeTraits(comp, CAT).map((x) => [x.n, x.count]));
  assert.deepEqual(t, { 'Cáustico': 1, Lutador: 4, Adaptador: 3, Florescer: 3, Colosso: 2, Primordial: 2 });
  const tn = Object.fromEntries(CAT.traits.map((x) => [x.id, x.n]));
  const cnt = {};
  comp.main.forEach((u) => CAT.champs.find((c) => c.id === u.c).t.forEach((id) => { cnt[tn[id]] = (cnt[tn[id]] || 0) + 1; }));
  assert.equal(cnt['Emanador'], 1);
  assert.equal(cnt['Invocador'], 1);
  assert.equal(cnt['Fera do Rift'], 1);
  assert.equal(cnt['Sabugueiro'], 1);
  assert.equal(cnt['Vivaz'], 1);
  const yi = comp.main.find((u) => u.c === 'DA_18_MasterYi_AD');
  assert.ok(yi.i.includes('DA_18_EmblemBrawler'));
});

test('seed-19 (print 17+18): 10 unidades, tracos e itens batem com o placar', () => {
  const comp = L.sanitizeImport(SEED, CAT).comps.find((c) => c.id === 'seed-19');
  assert.equal(comp.nome, 'Vanguarda Congregação das Bruxas Devastador');
  assert.equal(comp.estilo, 'Nível 10');
  assert.equal(comp.main.length, 10);
  assert.equal(new Set(comp.main.map((u) => u.c)).size, 10);
  assert.ok(comp.main.every((u) => !u.p));
  assert.deepEqual(comp.main.map((u) => u.s), [3, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
  const t = Object.fromEntries(L.activeTraits(comp, CAT).map((x) => [x.n, x.count]));
  assert.deepEqual(t, { Vanguarda: 6, 'Congregação das Bruxas': 5, Devastador: 3, Emanador: 2, 'Aspecto Esmeralda': 1 });
  assert.ok(comp.main.find((u) => u.c === 'DA_18_Elise').i.includes('DA_18_EmblemSlayer'));
  assert.equal(comp.main.reduce((n, u) => n + u.i.length, 0), 16);
});
