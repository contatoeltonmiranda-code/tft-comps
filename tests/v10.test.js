const test = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../data/catalog.js');
require('../data/seed.js');
const L = require('../js/logic.js');
const CAT = window.TFT_CATALOG;
const SEED = window.TFT_SEED;

const ID = 'seed-28';
const comp = () => SEED.find((s) => s.id === ID);
const dstored = (comps, seedVersao, excluidos) => ({ versao: 1, seedVersao, excluidos: excluidos || [], comps });
const SEED9 = SEED.filter((s) => !(s.desde >= 10));
const champs = new Map(CAT.champs.map((c) => [c.id, c]));
const items = new Map(CAT.items.map((i) => [i.id, i]));
const jaccard = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};

test('seed v10: versao 10, 28 comps, Solar 8x 3★ logo abaixo da seed-27 (ordem 25, 26, 27, 28, 17...)', () => {
  assert.equal(window.TFT_SEED_VERSION, 10);
  assert.equal(SEED.length, 28);
  assert.deepEqual(SEED.slice(0, 5).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27', ID, 'seed-17']);
  assert.equal(SEED.filter((c) => c.desde === 10).length, 1);
  const c = comp();
  assert.equal(c.desde, 10);
  assert.equal(c.topo, true);
  assert.equal(c.abaixoDe, 'seed-27');
});

test('seed v10: seed-20 (Solar Yunara Karma) continua intacta e a comp nova e separada', () => {
  const s20 = SEED.find((s) => s.id === 'seed-20');
  assert.equal(s20.nome, 'Solar Yunara Karma');
  assert.equal(s20.main.length, 8);
  assert.deepEqual(s20.main.filter((u) => u.s === 3).map((u) => champs.get(u.c).n), ['Sejuani', 'Yorick', 'Leona', 'Yunara', 'Karma']);
  assert.equal(comp().nome, 'Solar 8x 3★');
});

test('seed v10: 7 unidades todas 3★ (Azir, nao Jarvan), 8o slot nao fixado, itens da seed-20 so nos 3 carries', () => {
  const c = comp();
  assert.equal(c.estilo, 'Reroll 3★');
  assert.deepEqual(
    c.main.map((u) => champs.get(u.c).n),
    ['LeBlanc', 'Sejuani', 'Leona', 'Yorick', 'Azir', 'Yunara', 'Karma'],
  );
  assert.ok(c.main.every((u) => u.s === 3 && !u.p));
  assert.deepEqual(c.flex, []);
  assert.equal(c.board, undefined);
  const by = Object.fromEntries(c.main.map((u) => [u.c, u]));
  assert.deepEqual(by.DA_18_Sejuani.i, ['DA_GargoyleStoneplate', 'DA_WarmogsArmor']);
  assert.deepEqual(by.DA_18_Yunara.i, ['DA_Deathblade', 'DA_SpearOfShojin', 'DA_LastWhisper']);
  assert.deepEqual(by.DA_Karma18.i, ['DA_BlueBuff', 'DA_RabadonsDeathcap', 'DA_JeweledGauntlet']);
  c.main.forEach((u) => u.i.forEach((id) => assert.ok(items.has(id), id)));
  const { comps, dropped } = L.sanitizeImport([c], CAT);
  assert.equal(dropped, 0);
  assert.deepEqual(comps[0].main.map((u) => u.s), [3, 3, 3, 3, 3, 3, 3]);
  assert.equal(comps[0].nome, 'Solar 8x 3★');
});

test('seed v10: a base tem so 2 Solares (traco inativo); Kayle, o Solar barato do 8o slot, ativa o Solar 3', () => {
  const c = comp();
  const trait = (extra) => {
    const x = Object.assign({}, c, { main: c.main.concat(extra ? [{ c: extra, s: 3, i: [], a: [] }] : []) });
    return Object.fromEntries(L.activeTraits(x, CAT).map((t) => [t.n, t.count]));
  };
  assert.equal(trait()['Solar'], undefined);
  assert.equal(trait('DA_18_Kayle')['Solar'], 3);
  const solares = CAT.champs.filter((u) => u.t.includes('DA_18_Solar'));
  assert.deepEqual(solares.map((u) => u.n).sort(), ['Kayle', 'Leona', 'Lux (Solar)', 'Sejuani']);
  assert.equal(champs.get('DA_18_Kayle').c, 2);
  const solar = CAT.traits.find((t) => t.id === 'DA_18_Solar');
  assert.deepEqual(solar.bp, [3]);
  assert.ok(!CAT.items.some((i) => /Solar/.test(i.id) && /Emblem/.test(i.id)), 'catalogo nao tem Emblema de Solar');
});

test('seed v10: dicas explicam a condicao (8 unicos de 3★, 4★ em combate), citam Kayle como sugestao e nao fixam o 8o', () => {
  const c = comp();
  const txt = c.dicas.linhas.join(' ');
  assert.match(txt, /8/);
  assert.match(txt, /3★/);
  assert.match(txt, /4★/);
  assert.match(txt, /combate/);
  assert.match(txt, /Kayle/);
  assert.match(txt, /sugestão/i);
  assert.match(txt, /flex/);
  assert.match(c.nota, /flex/);
  assert.doesNotMatch(JSON.stringify(c.main.concat(c.flex)), /Kayle/);
});

test('seed v10: fases derivadas do proprio board, custos dentro do limite, dicas curtas', () => {
  const c = comp();
  assert.equal(c.fases.origem, 'derivado');
  assert.equal(c.fases.url, undefined);
  assert.ok(c.fases.ref && c.fases.ref.length <= 100);
  assert.ok(c.fases.inicio.length >= 3 && c.fases.inicio.length <= 5);
  assert.ok(c.fases.meio.length >= 6 && c.fases.meio.length <= 7);
  assert.ok(c.fases.inicio.every((x) => champs.get(x).c <= 3));
  assert.ok(c.fases.meio.every((x) => champs.get(x).c <= 4));
  const own = new Set(c.main.concat(c.flex).map((x) => x.c));
  c.fases.inicio.concat(c.fases.meio).forEach((x) => assert.ok(own.has(x), x));
  assert.deepEqual(c.fases.inicio.map((x) => champs.get(x).n), ['Leona', 'Yorick', 'Karma', 'Sejuani', 'Yunara']);
  assert.ok(c.dicas.linhas.length >= 3 && c.dicas.linhas.length <= 8);
  c.dicas.linhas.forEach((l) => assert.ok(l.length <= 240, l.length + ' ' + l));
  assert.ok(c.dicas.ref && c.dicas.ref.length <= 100);
  assert.equal(c.dicas.url, undefined);
  assert.ok(c.nota && c.nota.length <= 500);
  assert.ok(c.fonte.length <= 100);
  assert.equal(c.fasesDesde, undefined);
  const sane = L.sanitizeImport([c], CAT).comps[0];
  assert.deepEqual(sane.fases.inicio, c.fases.inicio);
  assert.deepEqual(sane.fases.meio, c.fases.meio);
  assert.equal(sane.nota, c.nota);
});

test('seed v10: nenhum Riot ID de jogador na comp nova (repo publico)', () => {
  assert.doesNotMatch(JSON.stringify(comp()), /k1ozera|ntxstage|BaWzEr|Inefável/i);
});

test('seed v10: quem esta na v9 recebe a comp logo abaixo da seed-27, sem perder edicao; excluida nao volta; nao duplica', () => {
  const v9 = L.sanitizeImport(SEED9, CAT).comps;
  v9[3].nome = 'Editada';
  const r = L.mergeSeed(dstored(v9, 9), SEED, 10, CAT);
  assert.deepEqual(r.added, [ID]);
  assert.equal(r.seedVersao, 10);
  assert.equal(r.comps.length, 28);
  assert.deepEqual(r.comps.slice(0, 5).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27', ID, 'seed-17']);
  assert.equal(r.comps[4].nome, 'Editada');
  const again = L.mergeSeed(dstored(r.comps, 10), SEED, 10, CAT);
  assert.deepEqual(again.added, []);
  assert.equal(again.comps.length, 28);
  const ex = L.mergeSeed(dstored(v9, 9, [ID]), SEED, 10, CAT);
  assert.deepEqual(ex.added, []);
  assert.ok(!ex.comps.some((c) => c.id === ID));
});

test('seed v10: usuario que reordenou mantem a ordem dele; a nova entra logo abaixo da seed-27 onde ela estiver', () => {
  const v9 = L.sanitizeImport(SEED9, CAT).comps;
  const reord = v9.slice();
  const [mov] = reord.splice(0, 1);
  reord.push(mov);
  const r = L.mergeSeed(dstored(reord, 9), SEED, 10, CAT);
  assert.deepEqual(r.added, [ID]);
  const ids = r.comps.map((c) => c.id);
  assert.equal(ids[ids.indexOf('seed-27') + 1], ID);
  assert.deepEqual(ids.filter((x) => x !== ID), reord.map((c) => c.id));
});

test('seed v10: usuario novo recebe as 28 comps na ordem do seed', () => {
  const r = L.mergeSeed(null, SEED, 10, CAT);
  assert.equal(r.comps.length, 28);
  assert.deepEqual(r.comps.slice(0, 4).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27', ID]);
});

test('seed v10: a comp nova e variante assumida da seed-20 (Jaccard >= 0,70) e nao duplica as demais', () => {
  const nb = comp().main.map((u) => u.c);
  const s20 = SEED.find((s) => s.id === 'seed-20').main.map((u) => u.c);
  assert.ok(jaccard(nb, s20) >= 0.7);
  SEED.filter((s) => s.id !== ID && s.id !== 'seed-20').forEach((o) => {
    assert.ok(jaccard(nb, o.main.map((u) => u.c)) < 0.7, o.id);
  });
});
