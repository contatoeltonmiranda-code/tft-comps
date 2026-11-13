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

const NOVAS = ['seed-35', 'seed-36'];
const ORDEM = ['seed-25', 'seed-26', 'seed-27', 'seed-28', 'seed-29', 'seed-30', 'seed-31', 'seed-32', 'seed-33', 'seed-34', ...NOVAS, 'seed-17'];
const get = (id) => SEED.find((s) => s.id === id);
const dstored = (comps, seedVersao, excluidos) => ({ versao: 1, seedVersao, excluidos: excluidos || [], comps });
const SEED12 = SEED.filter((s) => !(s.desde >= 13));
const champs = new Map(CAT.champs.map((c) => [c.id, c]));
const items = new Map(CAT.items.map((i) => [i.id, i]));
const names = (list) => list.map((u) => champs.get(u.c).n);
const iNames = (u) => u.i.map((id) => items.get(id).n);
const jaccard = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};
const traits = (c) => Object.fromEntries(L.activeTraits(L.sanitizeImport([c], CAT).comps[0], CAT).map((t) => [t.n, t.count]));
const by = (c) => Object.fromEntries(c.main.map((u) => [u.c, u]));

test('seed v13: versao 13, 36 comps, as 2 novas logo abaixo da seed-34 na ordem 35, 36 (..., 34, 35, 36, 17...)', () => {
  assert.equal(window.TFT_SEED_VERSION, 13);
  assert.equal(SEED.length, 36);
  assert.deepEqual(SEED.slice(0, 13).map((c) => c.id), ORDEM);
  assert.equal(SEED.filter((c) => c.desde === 13).length, 2);
  NOVAS.forEach((id, k) => {
    const c = get(id);
    assert.equal(c.desde, 13, id);
    assert.equal(c.topo, true, id);
    assert.equal(c.abaixoDe, k === 0 ? 'seed-34' : NOVAS[k - 1], id);
  });
});

test('seed v13: Colosso Sivir Ashe (seed-35): 8 unidades do frame 0:14, posicoes, itens do video, 6 Colossos', () => {
  const c = get('seed-35');
  assert.equal(c.nome, 'Colosso Sivir Ashe');
  assert.equal(c.fonte, 'Vídeo Techzz (Short, 19/09/2026) · 0:14 · refs/33.png');
  assert.equal(c.board, true);
  assert.deepEqual(names(c.main), ['Rakan', 'Sejuani', 'Vi', 'Aronguejo', 'Maokai', 'Amumu', 'Ashe', 'Sivir']);
  assert.deepEqual(names(c.flex), ['Tristana', 'Malphite']);
  assert.ok(c.main.every((u) => u.s === 1));
  const b = by(c);
  assert.deepEqual(iNames(b.DA_18_Sivir), ['Gume do Infinito', 'Mangual do Guerreiro']);
  assert.deepEqual(iNames(b.DA_18_Ashe), ['Lança de Shojin', 'Último Sussurro', 'Efeito Vermelho']);
  c.main.filter((u) => !['DA_18_Sivir', 'DA_18_Ashe'].includes(u.c)).forEach((u) => assert.deepEqual(u.i, [], u.c));
  assert.deepEqual(c.main.map((u) => u.p), [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [4, 6], [4, 7]]);
  assert.equal(traits(c).Colosso, 6);
});

test('seed v13: Colosso Zyra Azir (seed-36): 9 unidades do frame 0:20, posicoes, itens da Zyra, 6 Colossos', () => {
  const c = get('seed-36');
  assert.equal(c.nome, 'Colosso Zyra Azir');
  assert.equal(c.fonte, 'Vídeo Techzz (Short, 19/09/2026) · 0:20 · refs/34.png');
  assert.equal(c.board, true);
  assert.deepEqual(names(c.main), ['Rakan', 'Yorick', 'Vi', 'Aronguejo', 'Maokai', 'Amumu', 'Kennen', 'Azir', 'Zyra']);
  assert.deepEqual(names(c.flex), ['Malphite']);
  assert.ok(c.main.every((u) => u.s === 1));
  const b = by(c);
  assert.deepEqual(iNames(b.DA_18_Zyra), ['Cajado do Arcanjo', 'Pistola Laminar Hextec', 'Lança de Shojin']);
  c.main.filter((u) => u.c !== 'DA_18_Zyra').forEach((u) => assert.deepEqual(u.i, [], u.c));
  assert.deepEqual(c.main.map((u) => u.p), [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 3], [4, 5], [4, 7]]);
  assert.equal(traits(c).Colosso, 6);
});

test('seed v13: as comps novas sao variantes (Jaccard < 0,70 contra todas as outras, board x main+flex)', () => {
  NOVAS.forEach((id) => {
    const nb = get(id).main.map((u) => u.c);
    SEED.filter((o) => o.id !== id).forEach((o) => {
      assert.ok(jaccard(nb, o.main.concat(o.flex).map((u) => u.c)) < 0.7, id + ' x ' + o.id);
    });
  });
});

test('seed v13: itens existem no catalogo, posicoes unicas e sobrevivem ao sanitizeImport', () => {
  NOVAS.forEach((id) => {
    const c = get(id);
    c.main.concat(c.flex).forEach((u) => {
      assert.ok(champs.has(u.c), id + ' ' + u.c);
      assert.ok(u.i.length <= 3, id);
      u.i.concat(u.a).forEach((x) => assert.ok(items.has(x), id + ' ' + x));
    });
    const pos = c.main.map((u) => u.p.join(','));
    assert.equal(new Set(pos).size, c.main.length, id + ' posicoes unicas');
    c.main.forEach((u) => assert.ok(u.p[0] >= 1 && u.p[0] <= 4 && u.p[1] >= 1 && u.p[1] <= 7, id));
    const { comps, dropped } = L.sanitizeImport([c], CAT);
    assert.equal(dropped, 0, id);
    assert.deepEqual(comps[0].main.map((u) => u.i), c.main.map((u) => u.i), id);
    assert.deepEqual(comps[0].main.map((u) => u.p), c.main.map((u) => u.p), id);
    assert.deepEqual(comps[0].flex.map((u) => u.c), c.flex.map((u) => u.c), id);
  });
});

test('seed v13: fases derivadas do proprio board, custos dentro do limite, dicas com link do Short', () => {
  NOVAS.forEach((id) => {
    const c = get(id);
    assert.equal(c.fases.origem, 'derivado', id);
    assert.equal(c.fasesDesde, undefined, id);
    assert.ok(c.fases.ref && c.fases.ref.length <= 100, id);
    assert.ok(c.fases.inicio.length >= 3 && c.fases.inicio.length <= 5, id);
    assert.ok(c.fases.meio.length >= 6 && c.fases.meio.length <= 7, id);
    assert.ok(c.fases.inicio.every((x) => champs.get(x).c <= 3), id);
    assert.ok(c.fases.meio.every((x) => champs.get(x).c <= 4), id);
    const own = new Set(c.main.map((x) => x.c));
    c.fases.inicio.concat(c.fases.meio).forEach((x) => assert.ok(own.has(x), id + ' ' + x));
    assert.ok(c.dicas.linhas.length >= 3 && c.dicas.linhas.length <= 8, id);
    c.dicas.linhas.forEach((l) => assert.ok(l.length <= 240, id + ' ' + l.length));
    assert.ok(c.dicas.ref && c.dicas.ref.length <= 100, id);
    assert.equal(c.dicas.url, 'https://www.youtube.com/shorts/1Y8J0Sj7H6o', id);
    assert.ok(c.nota && c.nota.length <= 500, id);
    assert.ok(c.fonte.length <= 100, id);
    const sane = L.sanitizeImport([c], CAT).comps[0];
    assert.deepEqual(sane.fases.inicio, c.fases.inicio, id);
    assert.deepEqual(sane.fases.meio, c.fases.meio, id);
    assert.equal(sane.nota, c.nota, id);
    assert.equal(sane.dicas.url, c.dicas.url, id);
    assert.equal(sane.dicas.linhas.length, c.dicas.linhas.length, id);
  });
});

test('seed v13: frames em refs/ (33, 34, 35) existem e as fontes apontam para eles', () => {
  ['33', '34', '35'].forEach((n) => assert.ok(fs.statSync(path.join(__dirname, '..', 'refs', n + '.png')).size > 10000, n));
  assert.match(get('seed-35').fonte, /refs\/33\.png/);
  assert.match(get('seed-36').fonte, /refs\/34\.png/);
  assert.match(get('seed-35').dicas.linhas.join(' '), /refs\/35\.png/);
});

test('seed v13: nenhum Riot ID de jogador nas comps novas (repo publico)', () => {
  assert.doesNotMatch(JSON.stringify(NOVAS.map(get)), /k1ozera|ntxstage|BaWzEr|Inefável/i);
});

test('seed v13: quem esta na v12 recebe as 2 comps logo abaixo da seed-34, sem perder edicao; excluida nao volta; nao duplica', () => {
  const v12 = L.sanitizeImport(SEED12, CAT).comps;
  v12[8].nome = 'Editada';
  const r = L.mergeSeed(dstored(v12, 12), SEED, 13, CAT);
  assert.deepEqual(r.added, NOVAS);
  assert.equal(r.seedVersao, 13);
  assert.equal(r.comps.length, 36);
  assert.deepEqual(r.comps.slice(0, 13).map((c) => c.id), ORDEM);
  assert.equal(r.comps[8].nome, 'Editada');
  const again = L.mergeSeed(dstored(r.comps, 13), SEED, 13, CAT);
  assert.deepEqual(again.added, []);
  assert.equal(again.comps.length, 36);
  const ex = L.mergeSeed(dstored(v12, 12, ['seed-35']), SEED, 13, CAT);
  assert.deepEqual(ex.added, ['seed-36']);
  assert.ok(!ex.comps.some((c) => c.id === 'seed-35'));
});

test('seed v13: usuario que reordenou mantem a ordem dele; as novas entram logo abaixo da seed-34 onde ela estiver', () => {
  const v12 = L.sanitizeImport(SEED12, CAT).comps;
  const reord = v12.slice();
  const [mov] = reord.splice(0, 1);
  reord.push(mov);
  const r = L.mergeSeed(dstored(reord, 12), SEED, 13, CAT);
  assert.deepEqual(r.added, NOVAS);
  const ids = r.comps.map((c) => c.id);
  assert.deepEqual(ids.slice(ids.indexOf('seed-34') + 1, ids.indexOf('seed-34') + 3), NOVAS);
  assert.deepEqual(ids.filter((x) => !NOVAS.includes(x)), reord.map((c) => c.id));
});

test('seed v13: usuario novo recebe as 36 comps na ordem do seed', () => {
  const r = L.mergeSeed(null, SEED, 13, CAT);
  assert.equal(r.comps.length, 36);
  assert.deepEqual(r.comps.slice(0, 13).map((c) => c.id), ORDEM);
});
