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

const ID = 'seed-37';
const ORDEM = ['seed-25', 'seed-26', 'seed-27', 'seed-28', 'seed-29', 'seed-30', 'seed-31', 'seed-32', 'seed-33', 'seed-34', 'seed-35', 'seed-36', ID, 'seed-17'];
const get = (id) => SEED.find((s) => s.id === id);
const dstored = (comps, seedVersao, excluidos) => ({ versao: 1, seedVersao, excluidos: excluidos || [], comps });
const SEED13 = SEED.filter((s) => !(s.desde >= 14));
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

test('seed v14: versao 14, 37 comps, a nova logo abaixo da seed-36 (..., 36, 37, 17...)', () => {
  assert.ok(window.TFT_SEED_VERSION >= 14);
  assert.equal(SEED14.length, 37);
  assert.deepEqual(SEED14.slice(0, 14).map((c) => c.id), ORDEM);
  assert.equal(SEED14.filter((c) => c.desde === 14).length, 1);
  const c = get(ID);
  assert.equal(c.desde, 14);
  assert.equal(c.topo, true);
  assert.equal(c.abaixoDe, 'seed-36');
});

test('seed v14: Figurante Rank S: 9 unidades (7 lidas no print 36 + Grompe do early 37 + Yorick pelos tracos do 38), estrelas e itens', () => {
  const c = get(ID);
  assert.equal(c.nome, 'Figurante Rank S');
  assert.deepEqual(names(c.main), ["Kog'Maw", 'Master Yi', 'Vi', 'Ashe', 'Azuporã', 'Nidalee', 'Maokai', 'Grompe', 'Yorick']);
  assert.deepEqual(c.main.map((u) => u.s), [3, 3, 3, 2, 2, 2, 2, 1, 1]);
  assert.deepEqual(c.flex, []);
  assert.deepEqual(iNames(c.main[0]), ['Lâmina da Fúria de Guinsoo', 'Fúria do Cráquem', 'Canhão Fumegante']);
  assert.deepEqual(iNames(c.main[1]), ['Machadinha Infernal', 'Força do Infinito', 'Limiar da Noite']);
  assert.deepEqual(iNames(c.main[2]), ['Placa Gargolítica', 'Armadura de Warmog', 'Garra do Dragão']);
  assert.deepEqual(iNames(c.main[3]), ['Luvas do Ladrão', 'Fúria do Cráquem', 'Cajado do Arcanjo']);
  assert.deepEqual(iNames(c.main[4]), ['Semblante Espiritual', 'Elmo Adaptativo', 'Juramento do Protetor']);
  assert.deepEqual(iNames(c.main[5]), ['Limiar da Noite', 'Efeito Vermelho', "Dente de Na'Shor"]);
  assert.deepEqual(iNames(c.main[6]), ['Luvas do Ladrão', 'Centelha Iônica', 'Morellonomicon']);
  assert.deepEqual(c.main[7].i, []);
  assert.deepEqual(c.main[8].i, []);
  c.main.forEach((u) => assert.deepEqual(u.a, []));
});

test('seed v14: tracos batem com o painel do print 38 (tabuleiro sem o Maokai, 8 unidades)', () => {
  const c = get(ID);
  const sem = Object.assign({}, c, { main: c.main.filter((u) => champs.get(u.c).n !== 'Maokai') });
  const t = traitsOf(sem);
  assert.equal(t.Adaptador, 4);
  assert.equal(t['Cáustico'], 1);
  assert.equal(t.Florescer, 3);
  assert.equal(t.Emanador, 2);
  assert.equal(t.Colosso, 2);
  assert.equal(t.Primordial, 2);
  assert.equal(t['Crescimento Antigo'], undefined);
  const raw = {};
  sem.main.forEach((u) => champs.get(u.c).t.forEach((id) => { raw[id] = (raw[id] || 0) + 1; }));
  assert.equal(raw.DA_Riftbeast18, 2, 'Fera do Rift (inativa: 2/3)');
  assert.equal(raw.DA_18_Hunter, 1, 'Cacador (1/2)');
  assert.equal(raw.DA_18_Summoner, 1, 'Invocador (1/2)');
  assert.equal(traitsOf(c).Colosso, 3, 'com o Maokai o Colosso sobe para 3');
});

test('seed v14: posicoes pendentes (print 38 e de combate): nenhuma casa inventada', () => {
  const c = get(ID);
  assert.ok(!c.board);
  c.main.forEach((u) => assert.equal(u.p, undefined, u.c));
  assert.match(c.nota, /Sem posi/);
});

test('seed v14: ids no catalogo, itens <= 3 e a comp sobrevive ao sanitizeImport', () => {
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
});

test('seed v14: fases derivadas do proprio board (early do print 37 = Grompe), dicas e textos dentro dos limites', () => {
  const c = get(ID);
  assert.equal(c.fases.origem, 'derivado');
  assert.equal(c.fasesDesde, undefined);
  assert.ok(c.fases.ref && c.fases.ref.length <= 100);
  assert.ok(c.fases.inicio.length >= 3 && c.fases.inicio.length <= 5);
  assert.ok(c.fases.meio.length >= 6 && c.fases.meio.length <= 7);
  assert.ok(c.fases.inicio.every((x) => champs.get(x).c <= 3));
  assert.ok(c.fases.meio.every((x) => champs.get(x).c <= 4));
  assert.ok(c.fases.inicio.includes('DA_Gromp18_AP'));
  const own = new Set(c.main.map((x) => x.c));
  c.fases.inicio.concat(c.fases.meio).forEach((x) => assert.ok(own.has(x), x));
  assert.ok(c.dicas.linhas.length >= 3 && c.dicas.linhas.length <= 8);
  c.dicas.linhas.forEach((l) => assert.ok(l.length <= 240, l.length));
  assert.ok(c.dicas.ref && c.dicas.ref.length <= 100);
  assert.equal(c.dicas.url, undefined);
  assert.ok(c.nota && c.nota.length <= 500);
  assert.ok(c.fonte.length <= 100);
  const sane = L.sanitizeImport([c], CAT).comps[0];
  assert.deepEqual(sane.fases.inicio, c.fases.inicio);
  assert.deepEqual(sane.fases.meio, c.fases.meio);
  assert.equal(sane.nota, c.nota);
  assert.equal(sane.dicas.linhas.length, c.dicas.linhas.length);
});

test('seed v14: variante (Jaccard < 0,70 contra todas as outras, board x main+flex)', () => {
  const nb = get(ID).main.map((u) => u.c);
  SEED.filter((o) => o.id !== ID).forEach((o) => {
    assert.ok(jaccard(nb, o.main.concat(o.flex).map((u) => u.c)) < 0.7, ID + ' x ' + o.id);
  });
});

test('seed v14: prints em refs/ (36, 37, 38) existem e a fonte aponta para eles', () => {
  ['36', '37', '38'].forEach((n) => assert.ok(fs.statSync(path.join(__dirname, '..', 'refs', n + '.png')).size > 10000, n));
  assert.match(get(ID).fonte, /refs\/36\.png/);
  assert.match(get(ID).fonte, /refs\/38\.png/);
});

test('seed v14: nenhum Riot ID de jogador na comp nova (repo publico)', () => {
  assert.doesNotMatch(JSON.stringify(get(ID)), /k1ozera|ntxstage|BaWzEr|Inefável/i);
});

test('seed v14: quem esta na v13 recebe a comp logo abaixo da seed-36, sem perder edicao; excluida nao volta; nao duplica', () => {
  const v13 = L.sanitizeImport(SEED13, CAT).comps;
  v13[8].nome = 'Editada';
  const r = L.mergeSeed(dstored(v13, 13), SEED14, 14, CAT);
  assert.deepEqual(r.added, [ID]);
  assert.equal(r.seedVersao, 14);
  assert.equal(r.comps.length, 37);
  assert.deepEqual(r.comps.slice(0, 14).map((c) => c.id), ORDEM);
  assert.equal(r.comps[8].nome, 'Editada');
  const again = L.mergeSeed(dstored(r.comps, 14), SEED14, 14, CAT);
  assert.deepEqual(again.added, []);
  assert.equal(again.comps.length, 37);
  const ex = L.mergeSeed(dstored(v13, 13, [ID]), SEED14, 14, CAT);
  assert.deepEqual(ex.added, []);
  assert.ok(!ex.comps.some((c) => c.id === ID));
});

test('seed v14: usuario que reordenou mantem a ordem dele; a nova entra logo abaixo da seed-36 onde ela estiver', () => {
  const v13 = L.sanitizeImport(SEED13, CAT).comps;
  const reord = v13.slice();
  const [mov] = reord.splice(0, 1);
  reord.push(mov);
  const r = L.mergeSeed(dstored(reord, 13), SEED14, 14, CAT);
  assert.deepEqual(r.added, [ID]);
  const ids = r.comps.map((c) => c.id);
  assert.equal(ids[ids.indexOf('seed-36') + 1], ID);
  assert.deepEqual(ids.filter((x) => x !== ID), reord.map((c) => c.id));
});

test('seed v14: usuario novo recebe as 37 comps na ordem do seed', () => {
  const r = L.mergeSeed(null, SEED14, 14, CAT);
  assert.equal(r.comps.length, 37);
  assert.deepEqual(r.comps.slice(0, 14).map((c) => c.id), ORDEM);
});
