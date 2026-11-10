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

const NOVAS = ['seed-33', 'seed-34'];
const get = (id) => SEED.find((s) => s.id === id);
const dstored = (comps, seedVersao, excluidos) => ({ versao: 1, seedVersao, excluidos: excluidos || [], comps });
const SEED11 = SEED.filter((s) => !(s.desde >= 12));
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

test('seed v12: versao 12, 34 comps, as 2 novas logo abaixo da seed-32 na ordem 33, 34 (..., 32, 33, 34, 17...)', () => {
  assert.equal(window.TFT_SEED_VERSION, 12);
  assert.equal(SEED.length, 34);
  assert.deepEqual(SEED.slice(0, 11).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27', 'seed-28', 'seed-29', 'seed-30', 'seed-31', 'seed-32', ...NOVAS, 'seed-17']);
  assert.equal(SEED.filter((c) => c.desde === 12).length, 2);
  NOVAS.forEach((id, k) => {
    const c = get(id);
    assert.equal(c.desde, 12, id);
    assert.equal(c.topo, true, id);
    assert.equal(c.abaixoDe, k === 0 ? 'seed-32' : NOVAS[k - 1], id);
  });
});

test('seed v12: Emanador Vanguarda Morgana Rubrivira (seed-33): 8 unidades do frame 0:18, posicoes, itens so do audio, tracos do painel', () => {
  const c = get('seed-33');
  assert.equal(c.nome, 'Emanador Vanguarda Morgana Rubrivira');
  assert.equal(c.fonte, 'Vídeo Techzz (Short, 09/10/2026) · 0:18 · refs/32.png');
  assert.equal(c.board, true);
  assert.deepEqual(names(c.main), ['Taric', 'Hecarim', 'Diana', 'Azuporã', 'Morgana', 'Rubrivira', 'Cascalho', "Kog'Maw"]);
  assert.deepEqual(c.flex, []);
  assert.ok(c.main.every((u) => u.s === 1));
  const b = by(c);
  assert.deepEqual(iNames(b.DA_Brambleback18), ['Limiar da Noite', 'Sinal de Sterak']);
  c.main.filter((u) => u.c !== 'DA_Brambleback18').forEach((u) => assert.deepEqual(u.i, [], u.c));
  assert.deepEqual(b.DA_Taric18.p, [1, 2]);
  assert.deepEqual(b.DA_Sentinel18.p, [1, 5]);
  assert.deepEqual(b.DA_18_Morgana.p, [3, 5]);
  assert.deepEqual(b.DA_Brambleback18.p, [3, 6]);
  assert.deepEqual(b.DA_18_Sentry.p, [4, 1]);
  assert.deepEqual(b.DA_KogMaw18_AD.p, [4, 5]);
  assert.deepEqual(traits(c), { Emanador: 4, Vanguarda: 4, 'Fera do Rift': 3, Devastador: 2, 'Aspecto Esmeralda': 1, Cáustico: 1 });
});

test('seed v12: seed-33 e variante (Jaccard < 0,70): 5/8 com a seed-19 (Taric, Hecarim, Diana, Azuporã, Morgana) e 4/8 com a seed-21', () => {
  const n = get('seed-33').main.map((u) => u.c);
  const comum = (id) => n.filter((x) => get(id).main.some((u) => u.c === x)).sort();
  assert.deepEqual(comum('seed-19'), ['DA_18_Diana', 'DA_18_Hecarim', 'DA_18_Morgana', 'DA_Sentinel18', 'DA_Taric18']);
  assert.deepEqual(comum('seed-21'), ['DA_18_Morgana', 'DA_18_Sentry', 'DA_Sentinel18', 'DA_Taric18']);
  ['seed-19', 'seed-21'].forEach((id) => assert.ok(jaccard(n, get(id).main.map((u) => u.c)) < 0.7, id));
});

test('seed v12: Sabugueiro Colosso LeBlanc (seed-34): 8 unidades do print 2o lugar, estrelas e itens com match >= 0,80', () => {
  const c = get('seed-34');
  assert.equal(c.nome, 'Sabugueiro Colosso LeBlanc');
  assert.equal(c.fonte, 'Print de partida (2º lugar) · refs/19.png');
  assert.equal(c.estilo, 'Final');
  assert.equal(c.board, undefined);
  assert.deepEqual(names(c.main), ['Vi', 'LeBlanc', 'Xayah', 'Amumu', 'Sivir', 'Zyra', 'Ornn', 'Soraka']);
  assert.deepEqual(c.main.map((u) => u.s), [3, 3, 3, 2, 2, 2, 2, 1]);
  assert.deepEqual(c.flex, []);
  assert.ok(c.main.every((u) => !u.p));
  const b = by(c);
  assert.deepEqual(iNames(b.DA_Vi18), ['Imbatível', 'Placa Gargolítica', 'Semblante Espiritual']);
  assert.deepEqual(iNames(b.DA_18_LeBlanc), ['Lança de Shojin', 'Cajado do Vazio', "Dente de Na'Shor"]);
  assert.deepEqual(iNames(b.DA_18_Xayah), ['Emblema de Caçador', 'Mata-Gigantes', 'Fúria do Cráquem']);
  assert.deepEqual(iNames(b.DA_18_Sivir), ['Mangual do Guerreiro', 'Lança de Shojin', 'Efeito Vermelho']);
  ['DA_Amumu18', 'DA_18_Zyra', 'DA_18_Ornn', 'DA_18_Soraka'].forEach((x) => assert.deepEqual(b[x].i, [], x));
  assert.deepEqual(traits(c), { Sabugueiro: 3, Caçador: 2, Colosso: 2, Primordial: 2, 'Dama de Espinhos': 1, 'Flora Fatalis': 1 });
});

test('seed v12: itens e alternativas das 2 comps novas existem no catalogo e sobrevivem ao sanitizeImport', () => {
  NOVAS.forEach((id) => {
    const c = get(id);
    c.main.forEach((u) => {
      assert.ok(u.i.length <= 3, id);
      u.i.concat(u.a).forEach((x) => assert.ok(items.has(x), id + ' ' + x));
    });
    if (c.board) {
      const pos = c.main.map((u) => u.p.join(','));
      assert.equal(new Set(pos).size, c.main.length, id + ' posicoes unicas');
      c.main.forEach((u) => assert.ok(u.p[0] >= 1 && u.p[0] <= 4 && u.p[1] >= 1 && u.p[1] <= 7, id));
    }
    const { comps, dropped } = L.sanitizeImport([c], CAT);
    assert.equal(dropped, 0, id);
    assert.deepEqual(comps[0].main.map((u) => u.i), c.main.map((u) => u.i), id);
    assert.deepEqual(comps[0].main.map((u) => u.s), c.main.map((u) => u.s), id);
    assert.deepEqual(comps[0].main.map((u) => u.p), c.main.map((u) => u.p), id);
  });
});

test('seed v12: fases derivadas do proprio board, custos dentro do limite, dicas curtas', () => {
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
    assert.ok(c.nota && c.nota.length <= 500, id);
    assert.ok(c.fonte.length <= 100, id);
    const sane = L.sanitizeImport([c], CAT).comps[0];
    assert.deepEqual(sane.fases.inicio, c.fases.inicio, id);
    assert.deepEqual(sane.fases.meio, c.fases.meio, id);
    assert.equal(sane.nota, c.nota, id);
    assert.equal(sane.dicas.linhas.length, c.dicas.linhas.length, id);
  });
  assert.equal(get('seed-33').dicas.url, 'https://youtu.be/ZbcIwkJpRJg?t=5');
  assert.equal(get('seed-34').dicas.url, undefined);
});

test('seed v12: frames em refs/ (32 novo, 19 do print) e as fontes apontam para eles', () => {
  ['19', '32'].forEach((n) => assert.ok(fs.statSync(path.join(__dirname, '..', 'refs', n + '.png')).size > 10000, n));
  assert.match(get('seed-33').fonte, /refs\/32\.png/);
  assert.match(get('seed-34').fonte, /refs\/19\.png/);
});

test('seed v12: nenhuma comp nova duplica comp do seed (Jaccard do board < 0,70)', () => {
  NOVAS.forEach((id) => {
    const nb = get(id).main.map((u) => u.c);
    SEED.filter((o) => o.id !== id).forEach((o) => {
      assert.ok(jaccard(nb, o.main.concat(o.flex).map((u) => u.c)) < 0.7, id + ' x ' + o.id);
    });
  });
});

test('seed v12: nenhum Riot ID de jogador nas comps novas (repo publico)', () => {
  assert.doesNotMatch(JSON.stringify(NOVAS.map(get)), /k1ozera|ntxstage|BaWzEr|Inefável/i);
});

test('seed v12: quem esta na v11 recebe as 2 comps logo abaixo da seed-32, sem perder edicao; excluida nao volta; nao duplica', () => {
  const v11 = L.sanitizeImport(SEED11, CAT).comps;
  v11[8].nome = 'Editada';
  const r = L.mergeSeed(dstored(v11, 11), SEED, 12, CAT);
  assert.deepEqual(r.added, NOVAS);
  assert.equal(r.seedVersao, 12);
  assert.equal(r.comps.length, 34);
  assert.deepEqual(r.comps.slice(0, 11).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27', 'seed-28', 'seed-29', 'seed-30', 'seed-31', 'seed-32', ...NOVAS, 'seed-17']);
  assert.equal(r.comps[10].nome, 'Editada');
  const again = L.mergeSeed(dstored(r.comps, 12), SEED, 12, CAT);
  assert.deepEqual(again.added, []);
  assert.equal(again.comps.length, 34);
  const ex = L.mergeSeed(dstored(v11, 11, ['seed-33']), SEED, 12, CAT);
  assert.deepEqual(ex.added, ['seed-34']);
  assert.ok(!ex.comps.some((c) => c.id === 'seed-33'));
});

test('seed v12: usuario que reordenou mantem a ordem dele; as novas entram logo abaixo da seed-32 onde ela estiver', () => {
  const v11 = L.sanitizeImport(SEED11, CAT).comps;
  const reord = v11.slice();
  const [mov] = reord.splice(0, 1);
  reord.push(mov);
  const r = L.mergeSeed(dstored(reord, 11), SEED, 12, CAT);
  assert.deepEqual(r.added, NOVAS);
  const ids = r.comps.map((c) => c.id);
  assert.deepEqual(ids.slice(ids.indexOf('seed-32') + 1, ids.indexOf('seed-32') + 3), NOVAS);
  assert.deepEqual(ids.filter((x) => !NOVAS.includes(x)), reord.map((c) => c.id));
});

test('seed v12: usuario novo recebe as 34 comps na ordem do seed', () => {
  const r = L.mergeSeed(null, SEED, 12, CAT);
  assert.equal(r.comps.length, 34);
  assert.deepEqual(r.comps.slice(0, 10).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27', 'seed-28', 'seed-29', 'seed-30', 'seed-31', 'seed-32', ...NOVAS]);
});
