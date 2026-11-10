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

const NOVAS = ['seed-29', 'seed-30', 'seed-31', 'seed-32'];
const get = (id) => SEED.find((s) => s.id === id);
const dstored = (comps, seedVersao, excluidos) => ({ versao: 1, seedVersao, excluidos: excluidos || [], comps });
const SEED10 = SEED.filter((s) => !(s.desde >= 11));
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

test('seed v11: versao 11, 32 comps, as 4 novas logo abaixo da seed-28 na ordem 1-4 (25, 26, 27, 28, 29, 30, 31, 32, 17...)', () => {
  assert.equal(window.TFT_SEED_VERSION, 11);
  assert.equal(SEED.length, 32);
  assert.deepEqual(SEED.slice(0, 9).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27', 'seed-28', ...NOVAS, 'seed-17']);
  assert.equal(SEED.filter((c) => c.desde === 11).length, 4);
  NOVAS.forEach((id, k) => {
    const c = get(id);
    assert.equal(c.desde, 11, id);
    assert.equal(c.topo, true, id);
    assert.equal(c.abaixoDe, k === 0 ? 'seed-28' : NOVAS[k - 1], id);
  });
});

test('seed v11: Primitiva Sivir Nidalee Amumu (seed-29): 8 unidades do frame 0:50, itens do audio, tracos do painel', () => {
  const c = get('seed-29');
  assert.equal(c.nome, 'Primitiva Sivir Nidalee Amumu');
  assert.equal(c.estilo, 'Fast 8');
  assert.equal(c.fonte, 'Vídeo Vladimin TFT (18.6) · 0:50 · refs/27.png');
  assert.deepEqual(names(c.main), ['Lillia', 'Rakan', 'Shen', 'Azuporã', 'Amumu', 'Nidalee', "Kog'Maw", 'Sivir']);
  assert.deepEqual(c.flex, []);
  assert.ok(c.main.every((u) => u.s === 1));
  const by = Object.fromEntries(c.main.map((u) => [u.c, u]));
  assert.deepEqual(iNames(by.DA_Nidalee18_AP), ['Sedenta por Sangue', 'Limiar da Noite', 'Sinal de Sterak']);
  assert.deepEqual(by.DA_Nidalee18_AP.a, ['DA_InfinityEdge', 'DA_18_EmblemHunter']);
  assert.deepEqual(iNames(by.DA_18_Sivir), ['Gume do Infinito', 'Lâmina Mortal', 'Efeito Azul']);
  assert.deepEqual(by.DA_18_Sivir.a, ['DA_SpearOfShojin', 'DA_StrikersFlail']);
  assert.deepEqual(iNames(by.DA_Amumu18), ['Armadura de Warmog', 'Semblante Espiritual', 'Juramento do Protetor']);
  assert.deepEqual(by.DA_18_Lillia.p, [1, 1]);
  assert.deepEqual(by.DA_Nidalee18_AP.p, [3, 7]);
  assert.deepEqual(by.DA_18_Sivir.p, [4, 7]);
  assert.deepEqual(traits(c), { Adaptador: 2, Colosso: 2, Defendente: 2, Emanador: 2, Feérico: 2, Inferno: 2, Primordial: 2, Vanguarda: 2, Cáustico: 1 });
});

test('seed v11: Primitiva Sivir Nidalee Malphite (seed-30): 8 unidades do frame 1:52, sem Inferno, Sivir com corta-cura', () => {
  const c = get('seed-30');
  assert.equal(c.nome, 'Primitiva Sivir Nidalee Malphite');
  assert.equal(c.fonte, 'Vídeo Vladimin TFT (18.6) · 1:52 · refs/28.png');
  assert.deepEqual(names(c.main), ['Malphite', 'Azuporã', "Rek'Sai", 'Krugue', 'Rubrivirim', 'Nidalee', "Kog'Maw", 'Sivir']);
  assert.deepEqual(c.flex, []);
  const by = Object.fromEntries(c.main.map((u) => [u.c, u]));
  assert.deepEqual(iNames(by.DA_18_Malphite), ['Stemmaguarda', 'Placa Gargolítica', 'Armadura de Warmog']);
  assert.deepEqual(iNames(by.DA_18_Sivir), ['Efeito Vermelho', 'Gume do Infinito', 'Mangual do Guerreiro']);
  assert.deepEqual(iNames(by.DA_Nidalee18_AP), ['Sedenta por Sangue', 'Limiar da Noite', 'Sinal de Sterak']);
  assert.deepEqual(by.DA_18_Malphite.p, [1, 5]);
  assert.deepEqual(by.DA_Cinderling18.p, [4, 4]);
  const t = traits(c);
  assert.deepEqual(t, { 'Fera do Rift': 3, Adaptador: 2, Caçador: 2, Emanador: 2, 'Espinhos Negros': 2, Lutador: 2, Primordial: 2, Cáustico: 1, Monólito: 1 });
  assert.equal(t.Inferno, undefined);
});

test('seed v11: as duas versoes Sivir/Nidalee sao comps distintas (Jaccard < 0,70) e partilham so os 4 do nucleo', () => {
  const a = get('seed-29').main.map((u) => u.c);
  const b = get('seed-30').main.map((u) => u.c);
  assert.ok(jaccard(a, b) < 0.7);
  assert.deepEqual(a.filter((x) => b.includes(x)).sort(), ['DA_18_Sivir', 'DA_KogMaw18_AD', 'DA_Nidalee18_AP', 'DA_Sentinel18'].sort());
});

test('seed v11: Florescer Ahri Zyra (seed-31): nivel 8 do frame 8:40 + Taric do nivel 9, flex das trocas citadas', () => {
  const c = get('seed-31');
  assert.equal(c.nome, 'Florescer Ahri Zyra');
  assert.equal(c.estilo, 'Fast 8 → 9');
  assert.match(c.fonte, /^Vídeo Vladimin TFT \(18\.6\) · 8:40/);
  assert.deepEqual(names(c.main), ['Lillia', 'Krugue', 'Yorick', 'Fiddlesticks', 'Rakan', 'Sett', 'Taric', 'Ahri', 'Zyra']);
  assert.deepEqual(names(c.flex), ['Amumu', 'Shen', 'Gnar', 'Alune']);
  assert.deepEqual(c.flex.map((u) => u.s), [1, 1, 1, 2]);
  assert.ok(c.flex.every((u) => !u.p));
  const by = Object.fromEntries(c.main.map((u) => [u.c, u]));
  assert.deepEqual(iNames(by.DA_18_Ahri), ['Lança de Shojin', 'Manopla Adornada', 'Mangual do Guerreiro']);
  assert.deepEqual(by.DA_18_Ahri.a, ['DA_RabadonsDeathcap']);
  assert.deepEqual(iNames(by.DA_18_Zyra), ['Morellonomicon', 'Cajado do Vazio', 'Lança de Shojin']);
  assert.deepEqual(iNames(by.DA_18_Sett), ['Armadura de Warmog', 'Semblante Espiritual', 'Placa Gargolítica']);
  assert.deepEqual(by.DA_18_Ahri.p, [4, 5]);
  assert.deepEqual(by.DA_18_Zyra.p, [4, 7]);
  assert.deepEqual(by.DA_Taric18.p, [1, 7]);
  const nivel8 = Object.assign({}, c, { main: c.main.filter((u) => u.c !== 'DA_Taric18') });
  assert.deepEqual(traits(nivel8), { Florescer: 3, Colosso: 2, Defendente: 2, Enfeitiçador: 2, Feérico: 2, Invocador: 2, Lutador: 2, 'Dama de Espinhos': 1, 'Flora Fatalis': 1 });
});

test('seed v11: Invocador Soraka Zyra Malphite (seed-32): 8 unidades do frame 12:10 e tracos do painel', () => {
  const c = get('seed-32');
  assert.equal(c.nome, 'Invocador Soraka Zyra Malphite');
  assert.equal(c.fonte, 'Vídeo Vladimin TFT (18.6) · 12:10 · refs/31.png');
  assert.deepEqual(names(c.main), ['Malphite', 'Amumu', 'Fiddlesticks', 'Yorick', 'Zyra', 'Soraka', 'Kennen', 'Azir']);
  assert.deepEqual(names(c.flex), ['Shen', 'Lillia']);
  const by = Object.fromEntries(c.main.map((u) => [u.c, u]));
  assert.deepEqual(iNames(by.DA_18_Malphite), ['Stemmaguarda', 'Placa Gargolítica', 'Armadura de Warmog']);
  assert.deepEqual(iNames(by.DA_18_Zyra), ['Lança de Shojin', 'Cajado do Arcanjo', 'Cajado do Vazio']);
  assert.deepEqual(iNames(by.DA_18_Soraka), ['Lança de Shojin', 'Capuz da Morte de Rabadon', 'Cajado do Vazio']);
  assert.deepEqual(by.DA_18_Soraka.a, ['DA_JeweledGauntlet', 'DA_NashorsTooth']);
  assert.deepEqual(by.DA_18_Zyra.a, ['DA_RabadonsDeathcap', 'DA_18_EmblemExecutioner']);
  assert.deepEqual(by.DA_18_Zyra.p, [4, 1]);
  assert.deepEqual(by.DA_18_Azir.p, [4, 7]);
  const t = traits(c);
  assert.deepEqual(t, { Carrasco: 3, Invocador: 3, 'Flora Fatalis': 2, Colosso: 2, 'Espinhos Negros': 2, Inferno: 2, 'Dama de Espinhos': 1, Monólito: 1 });
});

test('seed v11: tabuleiro completo e valido nas 4 (board, p unicos nos main, itens e alternativas no catalogo)', () => {
  NOVAS.forEach((id) => {
    const c = get(id);
    assert.equal(c.board, true, id);
    const pos = c.main.map((u) => u.p.join(','));
    assert.equal(new Set(pos).size, c.main.length, id + ' posicoes unicas');
    c.main.forEach((u) => {
      assert.ok(u.p[0] >= 1 && u.p[0] <= 4 && u.p[1] >= 1 && u.p[1] <= 7, id);
      assert.ok(u.i.length <= 3, id);
      u.i.concat(u.a).forEach((x) => assert.ok(items.has(x), id + ' ' + x));
    });
    const { comps, dropped } = L.sanitizeImport([c], CAT);
    assert.equal(dropped, 0, id);
    assert.deepEqual(comps[0].main.map((u) => u.p), c.main.map((u) => u.p), id);
    assert.deepEqual(comps[0].main.map((u) => u.i), c.main.map((u) => u.i), id);
  });
});

test('seed v11: fases derivadas do proprio board, custos dentro do limite, dicas curtas com link do video no minuto', () => {
  const T = { 'seed-29': 14, 'seed-30': 95, 'seed-31': 462, 'seed-32': 719 };
  NOVAS.forEach((id) => {
    const c = get(id);
    assert.equal(c.fases.origem, 'derivado', id);
    assert.equal(c.fases.url, undefined, id);
    assert.equal(c.fasesDesde, undefined, id);
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
    assert.equal(c.dicas.url, 'https://youtu.be/cnOw7GHt7D4?t=' + T[id], id);
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

test('seed v11: os 5 frames de tabuleiro estao em refs/ (27 a 31) e as fontes apontam para eles', () => {
  for (let n = 27; n <= 31; n++) assert.ok(fs.statSync(path.join(__dirname, '..', 'refs', n + '.png')).size > 10000, String(n));
  const ref = (id) => get(id).fonte;
  assert.match(ref('seed-29'), /refs\/27\.png/);
  assert.match(ref('seed-30'), /refs\/28\.png/);
  assert.match(ref('seed-31'), /refs\/29\.png e refs\/30\.png/);
  assert.match(ref('seed-32'), /refs\/31\.png/);
});

test('seed v11: nenhuma comp nova duplica comp do seed (Jaccard do board < 0,70, incluindo flex)', () => {
  const antigas = SEED.filter((s) => !NOVAS.includes(s.id));
  NOVAS.forEach((id) => {
    const n = get(id);
    const nb = n.main.concat(n.flex).map((u) => u.c);
    antigas.forEach((o) => {
      assert.ok(jaccard(nb, o.main.map((u) => u.c)) < 0.7, id + ' x ' + o.id);
    });
    NOVAS.filter((x) => x !== id).forEach((x) => assert.ok(jaccard(nb, get(x).main.map((u) => u.c)) < 0.7, id + ' x ' + x));
  });
});

test('seed v11: a Aphelios/Nidalee do mesmo video nao virou comp (ja e a seed-04) e a seed-04 continua intacta', () => {
  const s04 = get('seed-04');
  assert.equal(s04.nome, 'Lunar Primitiva Aphelios');
  assert.equal(s04.main.length, 8);
  assert.ok(!SEED.some((s) => /Aphelios/.test(s.nome) && s.desde === 11));
});

test('seed v11: nenhum Riot ID de jogador nas comps novas (repo publico)', () => {
  assert.doesNotMatch(JSON.stringify(NOVAS.map(get)), /k1ozera|ntxstage|BaWzEr|Inefável/i);
});

test('seed v11: quem esta na v10 recebe as 4 comps logo abaixo da seed-28, sem perder edicao; excluida nao volta; nao duplica', () => {
  const v10 = L.sanitizeImport(SEED10, CAT).comps;
  v10[4].nome = 'Editada';
  const r = L.mergeSeed(dstored(v10, 10), SEED, 11, CAT);
  assert.deepEqual(r.added, NOVAS);
  assert.equal(r.seedVersao, 11);
  assert.equal(r.comps.length, 32);
  assert.deepEqual(r.comps.slice(0, 9).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27', 'seed-28', ...NOVAS, 'seed-17']);
  assert.equal(r.comps[8].nome, 'Editada');
  const again = L.mergeSeed(dstored(r.comps, 11), SEED, 11, CAT);
  assert.deepEqual(again.added, []);
  assert.equal(again.comps.length, 32);
  const ex = L.mergeSeed(dstored(v10, 10, ['seed-30']), SEED, 11, CAT);
  assert.deepEqual(ex.added, ['seed-29', 'seed-31', 'seed-32']);
  assert.ok(!ex.comps.some((c) => c.id === 'seed-30'));
});

test('seed v11: usuario que reordenou mantem a ordem dele; as novas entram logo abaixo da seed-28 onde ela estiver', () => {
  const v10 = L.sanitizeImport(SEED10, CAT).comps;
  const reord = v10.slice();
  const [mov] = reord.splice(0, 1);
  reord.push(mov);
  const r = L.mergeSeed(dstored(reord, 10), SEED, 11, CAT);
  assert.deepEqual(r.added, NOVAS);
  const ids = r.comps.map((c) => c.id);
  assert.deepEqual(ids.slice(ids.indexOf('seed-28') + 1, ids.indexOf('seed-28') + 5), NOVAS);
  assert.deepEqual(ids.filter((x) => !NOVAS.includes(x)), reord.map((c) => c.id));
});

test('seed v11: usuario novo recebe as 32 comps na ordem do seed', () => {
  const r = L.mergeSeed(null, SEED, 11, CAT);
  assert.equal(r.comps.length, 32);
  assert.deepEqual(r.comps.slice(0, 8).map((c) => c.id), ['seed-25', 'seed-26', 'seed-27', 'seed-28', ...NOVAS]);
});
