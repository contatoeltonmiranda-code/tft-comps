const test = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../data/catalog.js');
require('../data/seed.js');
const L = require('../js/logic.js');
const CAT = window.TFT_CATALOG;
const SEED = window.TFT_SEED;

const NOVAS = ['seed-26', 'seed-27'];
const get = (id) => SEED.find((s) => s.id === id);
const dstored = (comps, seedVersao, excluidos) => ({ versao: 1, seedVersao, excluidos: excluidos || [], comps });
const SEED8 = SEED.filter((s) => !(s.desde >= 9));
const champs = new Map(CAT.champs.map((c) => [c.id, c]));
const items = new Map(CAT.items.map((i) => [i.id, i]));
const jaccard = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};

test('seed v9: versao 9, 27 comps, seed-25 continua no topo e as 2 novas vem logo abaixo, na ordem pedida', () => {
  assert.equal(window.TFT_SEED_VERSION, 9);
  assert.equal(SEED.length, 27);
  assert.deepEqual(SEED.slice(0, 4).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27', 'seed-17']);
  assert.equal(SEED[0].abaixoDe, undefined);
  assert.equal(SEED.filter((c) => c.desde === 9).length, 2);
  NOVAS.forEach((id, k) => {
    const c = get(id);
    assert.equal(c.desde, 9, id);
    assert.equal(c.topo, true, id);
    assert.equal(c.abaixoDe, k === 0 ? 'seed-25' : NOVAS[k - 1], id);
  });
});

test('seed v9: lista do Elton (seed-26) tem as 9 unidades, Gnar como flex no lugar do Kobuko, nome com tracos + carry', () => {
  const c = get('seed-26');
  assert.equal(c.nome, 'Feérico Vivaz Tristana');
  assert.deepEqual(
    c.main.map((u) => champs.get(u.c).n),
    ['Tristana', 'Xayah', 'Rakan', 'Rammus', 'Vi', 'Lillia', 'Sivir', 'Kobuko', 'Taric'],
  );
  assert.deepEqual(c.flex.map((u) => champs.get(u.c).n), ['Gnar']);
  assert.ok(c.main.every((u) => u.s === 1 && u.i.length === 0 && !u.p));
  assert.equal(c.board, undefined);
  assert.equal(c.fonte, 'Lista do Elton (sem print)');
  const { comps, dropped } = L.sanitizeImport([c], CAT);
  assert.equal(dropped, 0);
  const t = Object.fromEntries(L.activeTraits(comps[0], CAT).map((x) => [x.n, x.count]));
  assert.equal(t['Feérico'], 4);
  assert.equal(t['Vivaz'], 3);
  assert.equal(t['Caçador'], 2);
  assert.equal(t['Aspecto Esmeralda'], 1);
});

test('seed v9: Colosso Reroll (seed-27): 7 unidades do Final lidas dos prints refs/25 e refs/26, estrelas e itens seguros', () => {
  const c = get('seed-27');
  assert.equal(c.nome, 'Colosso Reroll');
  assert.match(c.fonte, /refs\/25\.png/);
  assert.match(c.fonte, /refs\/26\.png/);
  assert.deepEqual(
    c.main.map((u) => champs.get(u.c).n),
    ['Rakan', 'Caitlyn', 'Sejuani', 'Aronguejo', 'Vi', 'Tristana', 'Sivir'],
  );
  assert.deepEqual(c.flex, []);
  const by = Object.fromEntries(c.main.map((u) => [u.c, u]));
  assert.deepEqual(Object.fromEntries(c.main.map((u) => [u.c, u.s])), {
    DA_18_Rakan: 1, DA_18_Caitlyn: 2, DA_18_Sejuani: 2, DA_Scuttlecrab18: 2, DA_Vi18: 1, DA_18_Tristana: 1, DA_18_Sivir: 1,
  });
  assert.deepEqual(by.DA_18_Caitlyn.i, ['DA_GuinsoosRageblade']);
  assert.deepEqual(by.DA_Scuttlecrab18.i, ['DA_GargoyleStoneplate', 'DA_HandOfJustice']);
  assert.deepEqual(by.DA_18_Sivir.i, ['DA_RedBuff']);
  c.main.forEach((u) => u.i.forEach((id) => assert.ok(items.has(id), id)));
  assert.ok(c.main.every((u) => !u.p));
  const { comps, dropped } = L.sanitizeImport([c], CAT);
  assert.equal(dropped, 0);
  const t = Object.fromEntries(L.activeTraits(comps[0], CAT).map((x) => [x.n, x.count]));
  assert.equal(t['Colosso'], 4);
  assert.equal(t['Caçador'], 3);
});

test('seed v9: fases derivadas do proprio board, custos dentro do limite, dicas curtas', () => {
  NOVAS.forEach((id) => {
    const c = get(id);
    assert.equal(c.fases.origem, 'derivado', id);
    assert.equal(c.fases.url, undefined, id);
    assert.ok(c.fases.ref && c.fases.ref.length <= 100, id);
    assert.ok(c.fases.inicio.length >= 3 && c.fases.inicio.length <= 5, id);
    assert.ok(c.fases.meio.length >= 6 && c.fases.meio.length <= 7, id);
    assert.ok(c.fases.inicio.every((x) => champs.get(x).c <= 3), id);
    assert.ok(c.fases.meio.every((x) => champs.get(x).c <= 4), id);
    const own = new Set(c.main.concat(c.flex).map((x) => x.c));
    c.fases.inicio.concat(c.fases.meio).forEach((x) => assert.ok(own.has(x), id + ' ' + x));
    assert.ok(c.dicas.linhas.length >= 3 && c.dicas.linhas.length <= 8, id);
    c.dicas.linhas.forEach((l) => assert.ok(l.length <= 240, id + ' ' + l.length));
    assert.ok(c.dicas.ref && c.dicas.ref.length <= 100, id);
    assert.equal(c.dicas.url, undefined, id);
    assert.ok(c.nota && c.nota.length <= 500, id);
    assert.ok(c.fonte.length <= 100, id);
    const sane = L.sanitizeImport([c], CAT).comps[0];
    assert.deepEqual(sane.fases.inicio, c.fases.inicio, id);
    assert.deepEqual(sane.fases.meio, c.fases.meio, id);
    assert.equal(sane.nota, c.nota, id);
  });
  assert.deepEqual(get('seed-27').fases.inicio.map((x) => champs.get(x).n), ['Rakan', 'Caitlyn', 'Sejuani', 'Aronguejo', 'Vi']);
});

test('seed v9: nenhuma comp nova duplica comp do seed (Jaccard do board < 0,70)', () => {
  const antigas = SEED.filter((s) => !NOVAS.includes(s.id));
  NOVAS.forEach((id) => {
    const n = get(id);
    const nb = n.main.concat(n.flex).map((u) => u.c);
    antigas.forEach((o) => {
      assert.ok(jaccard(nb, o.main.map((u) => u.c)) < 0.7, id + ' x ' + o.id);
    });
  });
  assert.ok(jaccard(get('seed-26').main.map((u) => u.c), get('seed-27').main.map((u) => u.c)) < 0.7);
});

test('seed v9: Solar 3 estrelas (LeBlanc, Sejuani, Leona, Yorick, Yunara, Karma) ja existe como seed-20 e nao foi duplicada; Jarvan nao existe no Set 18', () => {
  const s20 = get('seed-20');
  assert.equal(s20.nome, 'Solar Yunara Karma');
  const pedido = ['DA_18_LeBlanc', 'DA_18_Sejuani', 'DA_18_Leona', 'DA_18_Yorick', 'DA_18_Yunara', 'DA_Karma18'];
  assert.ok(pedido.every((id) => s20.main.some((u) => u.c === id)));
  assert.ok(jaccard(pedido, s20.main.map((u) => u.c)) >= 0.7);
  assert.equal(CAT.champs.filter((c) => /jarvan/i.test(c.id + c.n)).length, 0);
  assert.ok(!SEED.some((s) => s.fonte === 'refs/26.png' && /Solar/.test(s.nome)));
});

test('seed v9: nenhum Riot ID de jogador nas comps novas (repo publico)', () => {
  assert.doesNotMatch(JSON.stringify(NOVAS.map(get)), /k1ozera|ntxstage|BaWzEr|Inefável/i);
});

test('seed v9: quem esta na v8 recebe as 2 comps logo abaixo da seed-25, sem perder edicao; excluida nao volta; nao duplica', () => {
  const v8 = L.sanitizeImport(SEED8, CAT).comps;
  v8[1].nome = 'Editada';
  const r = L.mergeSeed(dstored(v8, 8), SEED, 9, CAT);
  assert.deepEqual(r.added, NOVAS);
  assert.equal(r.seedVersao, 9);
  assert.equal(r.comps.length, 27);
  assert.deepEqual(r.comps.slice(0, 4).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27', 'seed-17']);
  assert.equal(r.comps[3].nome, 'Editada');
  const again = L.mergeSeed(dstored(r.comps, 9), SEED, 9, CAT);
  assert.deepEqual(again.added, []);
  assert.equal(again.comps.length, 27);
  const ex = L.mergeSeed(dstored(v8, 8, ['seed-26']), SEED, 9, CAT);
  assert.deepEqual(ex.added, ['seed-27']);
  assert.ok(!ex.comps.some((c) => c.id === 'seed-26'));
});

test('seed v9: usuario que reordenou mantem a ordem dele; as novas entram no bloco fixado', () => {
  const v8 = L.sanitizeImport(SEED8, CAT).comps;
  const reord = v8.slice();
  const [mov] = reord.splice(0, 1);
  reord.push(mov);
  const r = L.mergeSeed(dstored(reord, 8), SEED, 9, CAT);
  assert.deepEqual(r.added, NOVAS);
  assert.deepEqual(r.comps.slice(0, 2).map((c) => c.id), ['seed-26', 'seed-27']);
  assert.deepEqual(r.comps.slice(2).map((c) => c.id), reord.map((c) => c.id));
});

test('seed v9: usuario novo recebe as 27 comps na ordem do seed', () => {
  const r = L.mergeSeed(null, SEED, 9, CAT);
  assert.equal(r.comps.length, 27);
  assert.deepEqual(r.comps.slice(0, 3).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27']);
});
