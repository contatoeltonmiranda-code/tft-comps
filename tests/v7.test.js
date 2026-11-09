const test = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../data/catalog.js');
require('../data/seed.js');
require('../data/noticias.js');
const L = require('../js/logic.js');
const CAT = window.TFT_CATALOG;
const SEED = window.TFT_SEED;
const NEWS = window.TFT_NOTICIAS;

const u = (c, extra) => Object.assign({ c, s: 1, i: [], a: [] }, extra || {});
const champs = new Map(CAT.champs.map((c) => [c.id, c]));
const NOVAS = ['seed-20', 'seed-21', 'seed-22', 'seed-23', 'seed-24'];
const SEED7 = SEED.filter((s) => !(s.desde >= 8));

/* ---------- nome do set ---------- */
test('catalogo: set oficial 18 "Selvas Encantadas" (nao 17)', () => {
  assert.match(CAT.set, /Set 18/);
  assert.match(CAT.set, /Selvas Encantadas/);
  assert.doesNotMatch(CAT.set, /Set 17/);
});

/* ---------- dicas (campo novo da comp) ---------- */
test('sanitizeImport: dicas validas sobrevivem, texto vira linha limpa, url so https', () => {
  const raw = { nome: 'A', main: [], flex: [], dicas: { ref: 'Vladimin TFT · 18.5C', url: 'https://youtu.be/shtFyRruAHM?t=39', linhas: ['  Rolar no nível 6.  ', 'x\u0000y'] } };
  const { comps } = L.sanitizeImport([raw], CAT);
  assert.deepEqual(comps[0].dicas, { linhas: ['Rolar no nível 6.', 'x y'], ref: 'Vladimin TFT · 18.5C', url: 'https://youtu.be/shtFyRruAHM?t=39' });
});

test('sanitizeImport: dicas invalidas sao descartadas (sem linhas, url http/javascript, limites)', () => {
  const mk = (dicas) => L.sanitizeImport([{ nome: 'A', main: [], flex: [], dicas }], CAT).comps[0].dicas;
  assert.equal(mk(null), undefined);
  assert.equal(mk('texto'), undefined);
  assert.equal(mk({ linhas: [] }), undefined);
  assert.equal(mk({ linhas: [5, null, ''] }), undefined);
  assert.equal(mk({ linhas: ['ok'], url: 'javascript:alert(1)' }).url, undefined);
  assert.equal(mk({ linhas: ['ok'], url: 'http://x.com/a' }).url, undefined);
  const big = mk({ linhas: Array.from({ length: 20 }, (_, i) => 'l' + i + 'x'.repeat(400)), ref: 'r'.repeat(300) });
  assert.equal(big.linhas.length, 8);
  big.linhas.forEach((l) => assert.ok(l.length <= 240));
  assert.ok(big.ref.length <= 100);
});

const dseed = [
  { id: 'd1', nome: 'D1', main: [u('DA_18_Ornn')], flex: [], dicas: { linhas: ['dica seed'], ref: 'v' }, dicasDesde: 7 },
  { id: 'd2', nome: 'D2', main: [u('DA_18_Ornn')], flex: [], dicas: { linhas: ['outra'] }, dicasDesde: 7 },
];
const dstored = (comps, seedVersao, excluidos) => ({ versao: 1, seedVersao: seedVersao == null ? 6 : seedVersao, excluidos: excluidos || [], comps });

test('mergeSeed dicas: comp salva sem dicas recebe; com dicas (edicao) fica intacta', () => {
  const salvo = [
    { id: 'd1', nome: 'D1 editada', estilo: '', nota: 'minha nota', fonte: '', board: false, main: [u('DA_18_Ornn')], flex: [] },
    { id: 'd2', nome: 'D2', estilo: '', nota: '', fonte: '', board: false, main: [u('DA_18_Ornn')], flex: [], dicas: { linhas: ['minha dica'] } },
  ];
  const r = L.mergeSeed(dstored(salvo), dseed, 7, CAT);
  assert.deepEqual(r.dicasAplicadas, ['d1']);
  assert.equal(r.comps[0].nome, 'D1 editada');
  assert.equal(r.comps[0].nota, 'minha nota');
  assert.deepEqual(r.comps[0].dicas.linhas, ['dica seed']);
  assert.deepEqual(r.comps[1].dicas.linhas, ['minha dica']);
});

test('mergeSeed dicas: so aplica uma vez, ignora comp excluida e versao futura', () => {
  const salvo = [{ id: 'd1', nome: 'D1', estilo: '', nota: '', fonte: '', board: false, main: [u('DA_18_Ornn')], flex: [] }];
  assert.deepEqual(L.mergeSeed(dstored(salvo, 7), dseed, 7, CAT).dicasAplicadas, []);
  assert.deepEqual(L.mergeSeed(dstored(salvo, 6, ['d2']), dseed, 7, CAT).comps.map((c) => c.id), ['d1']);
  assert.deepEqual(L.mergeSeed(dstored(salvo, 6), dseed, 6, CAT).dicasAplicadas, []);
  assert.deepEqual(L.mergeSeed(null, dseed, 7, CAT).dicasAplicadas, []);
});

/* ---------- seed v7 ---------- */
test('seed v7: 5 comps novas no topo logo depois das 3 fixadas (a v8 acrescenta seed-25 acima de tudo)', () => {
  assert.ok(window.TFT_SEED_VERSION >= 7);
  assert.equal(SEED7.length, 24);
  assert.deepEqual(SEED7.slice(0, 8).map((c) => c.id), ['seed-17', 'seed-18', 'seed-19'].concat(NOVAS));
  NOVAS.forEach((id, k) => {
    const c = SEED.find((s) => s.id === id);
    assert.equal(c.desde, 7, id);
    assert.equal(c.topo, true, id);
    assert.equal(c.abaixoDe, k === 0 ? 'seed-19' : NOVAS[k - 1], id);
  });
  assert.equal(SEED7.filter((c) => c.topo).length, 8);
});

test('seed v7: comps novas completas (fim, estrelas, itens, inicio/meio, estilo, nota curta, fonte = video + minuto)', () => {
  NOVAS.forEach((id) => {
    const c = SEED.find((s) => s.id === id);
    assert.ok(c.nome && c.estilo, id + ' nome/estilo');
    assert.ok(c.nota && c.nota.length <= 500, id + ' nota curta');
    assert.match(c.fonte, /Vladimin/, id + ' fonte cita o video');
    assert.match(c.fonte, /\d+:\d\d/, id + ' fonte com timestamp');
    assert.ok(c.main.length >= 8 && c.main.length <= 10, id + ' board final');
    assert.ok(c.main.every((x) => x.s >= 1 && x.s <= 3), id + ' estrelas validas');
    assert.ok(c.main.some((x) => x.i.length > 0), id + ' tem itens do carry');
    assert.ok(c.fases && c.fases.inicio.length >= 3 && c.fases.meio.length >= 6, id + ' fases');
    assert.ok(c.dicas && c.dicas.linhas.length >= 3, id + ' dicas do video');
    assert.match(c.dicas.url, /^https:\/\/youtu\.be\/shtFyRruAHM\?t=\d+$/, id + ' link com minuto');
    assert.equal(c.board, true, id + ' mostra tabuleiro');
  });
});

test('seed v7: posicoes das comps novas validas, sem casas repetidas, so unidades do main', () => {
  NOVAS.forEach((id) => {
    const c = SEED.find((s) => s.id === id);
    const cells = c.main.filter((x) => x.p).map((x) => x.p.join(','));
    assert.ok(cells.length >= 7, id + ' posicoes');
    assert.equal(new Set(cells).size, cells.length, id + ' casas unicas');
    c.main.filter((x) => x.p).forEach((x) => assert.ok(x.p[0] >= 1 && x.p[0] <= 4 && x.p[1] >= 1 && x.p[1] <= 7, id));
    assert.ok(c.flex.every((x) => !x.p), id + ' flex sem posicao');
  });
});

test('seed v7: estrelas do tabuleiro do video (so a Solar Yunara mostra 3 estrelas) e nenhuma linha de dica truncada', () => {
  const solar = SEED.find((s) => s.id === 'seed-20');
  assert.deepEqual(solar.main.filter((x) => x.s === 3).map((x) => x.c).sort(), ['DA_18_Leona', 'DA_18_Sejuani', 'DA_18_Yorick', 'DA_18_Yunara', 'DA_Karma18']);
  SEED.filter((s) => s.dicas).forEach((s) => {
    assert.ok(s.dicas.linhas.length <= 8, s.id);
    s.dicas.linhas.forEach((l) => assert.ok(l.length <= 240, s.id + ' linha longa: ' + l.length));
    assert.ok(s.dicas.ref.length <= 100, s.id);
  });
});

test('seed v7: comp nova nao duplica comp existente (Jaccard do board < 0,70)', () => {
  const jac = (a, b) => {
    const A = new Set(a);
    const B = new Set(b);
    return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
  };
  const antigas = SEED7.filter((s) => !NOVAS.includes(s.id));
  NOVAS.forEach((id) => {
    const n = SEED.find((s) => s.id === id);
    antigas.forEach((o) => {
      const j = jac(n.main.map((x) => x.c), o.main.map((x) => x.c));
      assert.ok(j < 0.7, id + ' vs ' + o.id + ' = ' + j.toFixed(2));
    });
  });
});

test('seed v7: tracos das comps novas batem com o painel do tactics.tools (contagem de campeoes)', () => {
  const comps = L.sanitizeImport(SEED, CAT).comps;
  const tr = (id) => Object.fromEntries(L.activeTraits(comps.find((c) => c.id === id), CAT).map((t) => [t.n, t.count]));
  const solar = tr('seed-20');
  assert.equal(solar['Solar'], 3);
  assert.equal(solar['Florescer'], 3);
  assert.equal(solar['Carrasco'], 2);
  assert.equal(solar['Colosso'], 2);
  assert.equal(solar['Enfeitiçador'], 2);
  assert.equal(solar['Invocador'], 2);
  const ahri = tr('seed-21');
  assert.equal(ahri['Emanador'], 3);
  assert.equal(ahri['Florescer'], 3);
  assert.equal(ahri['Fera do Rift'], 3);
  assert.equal(ahri['Lutador'], 2);
  const lunar = tr('seed-24');
  assert.equal(lunar['Lunar'], 3); // painel do video mostra 4: a 4a fonte nao aparece no frame (ver nota da comp)
  assert.equal(lunar['Vanguarda'], 4);
  assert.equal(lunar['Defendente'], 2);
  assert.equal(lunar['Feérico'], 2);
  assert.equal(lunar['Emanador'], 2);
  assert.equal(lunar['Enfeitiçador'], 2);
});

test('seed v7: usuario na v6 recebe as 5 comps logo depois das 3 fixadas, sem perder edicao', () => {
  const v6 = L.sanitizeImport(SEED7.filter((s) => !NOVAS.includes(s.id)), CAT).comps;
  v6[0].nome = 'Editada';
  const r = L.mergeSeed(dstored(v6, 6), SEED7, 7, CAT);
  assert.deepEqual(r.added, NOVAS);
  assert.deepEqual(r.comps.slice(0, 8).map((c) => c.id), ['seed-17', 'seed-18', 'seed-19'].concat(NOVAS));
  assert.equal(r.comps[0].nome, 'Editada');
  assert.equal(r.comps.length, 24);
  assert.equal(r.seedVersao, 7);
  const again = L.mergeSeed(dstored(r.comps, 7), SEED7, 7, CAT);
  assert.deepEqual(again.added, []);
  assert.equal(again.comps.length, 24);
});

test('seed v7: comp nova excluida pelo usuario nao volta', () => {
  const v6 = L.sanitizeImport(SEED7.filter((s) => !NOVAS.includes(s.id)), CAT).comps;
  const r = L.mergeSeed(dstored(v6, 6, ['seed-22']), SEED7, 7, CAT);
  assert.ok(!r.comps.some((c) => c.id === 'seed-22'));
  assert.equal(r.added.length, 4);
});

test('seed v7: comps do video ja existentes recebem dicas e posicoes sem duplicar', () => {
  const EXISTENTES = ['seed-01', 'seed-10', 'seed-13', 'seed-14', 'seed-15', 'seed-18'];
  EXISTENTES.forEach((id) => {
    const s = SEED.find((x) => x.id === id);
    assert.equal(s.dicasDesde, 7, id);
    assert.ok(s.dicas.linhas.length >= 3 && /youtu\.be\/shtFyRruAHM\?t=\d+$/.test(s.dicas.url), id);
  });
  ['seed-13', 'seed-14', 'seed-15', 'seed-18'].forEach((id) => assert.equal(SEED.find((x) => x.id === id).posDesde, 7, id));
  const v6 = L.sanitizeImport(SEED7.filter((s) => !NOVAS.includes(s.id)), CAT).comps.map((c) => {
    const x = L.clone(c);
    delete x.dicas;
    x.main.forEach((m) => { delete m.p; });
    return x;
  });
  const sem = v6.find((c) => c.id === 'seed-01');
  sem.nota = 'nota do Elton';
  const r = L.mergeSeed(dstored(v6, 6), SEED7, 7, CAT);
  assert.deepEqual(r.dicasAplicadas.sort(), ['seed-01', 'seed-10', 'seed-13', 'seed-14', 'seed-15', 'seed-18']);
  assert.deepEqual(r.positioned.sort(), ['seed-13', 'seed-14', 'seed-15', 'seed-18']);
  assert.equal(r.comps.find((c) => c.id === 'seed-01').nota, 'nota do Elton');
  assert.equal(r.comps.filter((c) => c.id === 'seed-18').length, 1);
});

test('seed v7: posicoes novas das comps existentes conferem com o frame (spot check)', () => {
  const at = (id, champ) => SEED.find((s) => s.id === id).main.find((m) => m.c === champ).p;
  assert.deepEqual(at('seed-14', 'DA_Krug18'), [1, 4]);
  assert.deepEqual(at('seed-14', 'DA_Sentinel18'), [3, 1]);
  assert.deepEqual(at('seed-15', 'DA_Draven18'), [4, 7]);
  assert.deepEqual(at('seed-18', 'DA_18_MasterYi_AD'), [1, 1]);
});

/* ---------- noticias: filtros ---------- */
test('newsTypes: so tipos presentes, ordem fixa, com contagem', () => {
  const list = [{ tipo: 'nerf' }, { tipo: 'buff' }, { tipo: 'buff' }, { tipo: 'sistema' }];
  assert.deepEqual(L.newsTypes(list), [{ tipo: 'buff', n: 2 }, { tipo: 'nerf', n: 1 }, { tipo: 'sistema', n: 1 }]);
  assert.deepEqual(L.newsTypes([]), []);
  assert.deepEqual(L.newsTypes(null), []);
});

test('newsPatches: do mais novo para o mais antigo, numericamente (18.10 > 18.9)', () => {
  assert.deepEqual(L.newsPatches([{ patch: '18.5' }, { patch: '18.10' }, { patch: '18.9' }, { patch: '18.5' }]), ['18.10', '18.9', '18.5']);
});

test('filterNews: por tipo, por patch, combinado e "todos"', () => {
  const list = [
    { id: 1, tipo: 'buff', patch: '18.6' },
    { id: 2, tipo: 'nerf', patch: '18.6' },
    { id: 3, tipo: 'buff', patch: '18.5' },
  ];
  assert.deepEqual(L.filterNews(list, {}).map((n) => n.id), [1, 2, 3]);
  assert.deepEqual(L.filterNews(list, { tipo: 'buff' }).map((n) => n.id), [1, 3]);
  assert.deepEqual(L.filterNews(list, { patch: '18.6' }).map((n) => n.id), [1, 2]);
  assert.deepEqual(L.filterNews(list, { tipo: 'buff', patch: '18.5' }).map((n) => n.id), [3]);
  assert.deepEqual(L.filterNews(list, { tipo: 'item', patch: '18.6' }), []);
  assert.deepEqual(L.filterNews(null, {}), []);
});

test('newsIcon: primeiro alvo com id do catalogo vira icone; sem id nao tem icone', () => {
  const champ = CAT.champs[0];
  const trait = CAT.traits[0];
  const item = CAT.items[0];
  assert.deepEqual(L.newsIcon({ alvos: [{ tipo: 'campeao', id: champ.id, nome: champ.n }] }, CAT), { img: champ.img, alt: champ.n });
  assert.deepEqual(L.newsIcon({ alvos: [{ tipo: 'sistema', id: null, nome: 'X' }, { tipo: 'traco', id: trait.id, nome: trait.n }] }, CAT), { img: trait.img, alt: trait.n });
  assert.deepEqual(L.newsIcon({ alvos: [{ tipo: 'item', id: item.id, nome: item.n }] }, CAT), { img: item.img, alt: item.n });
  assert.equal(L.newsIcon({ alvos: [{ tipo: 'aprimoramento', id: null, nome: 'A' }] }, CAT), null);
  assert.equal(L.newsIcon({ alvos: [{ tipo: 'campeao', id: 'NAO_EXISTE', nome: 'Z' }] }, CAT), null);
  assert.equal(L.newsIcon({}, CAT), null);
});

test('noticias reais: icone existe para campeao/traco/item e atualizado em data valida', () => {
  assert.match(window.TFT_NOTICIAS_ATUALIZADO, /^2026-\d\d-\d\d$/);
  const comIcone = NEWS.filter((n) => L.newsIcon(n, CAT));
  assert.ok(comIcone.length >= 20);
  comIcone.forEach((n) => assert.match(L.newsIcon(n, CAT).img, /^assets\/(champs|traits|items)\/[\w.-]+\.png$/, n.id));
  const tipos = L.newsTypes(NEWS).map((t) => t.tipo);
  assert.ok(tipos.includes('buff') && tipos.includes('nerf'));
  assert.deepEqual(L.newsPatches(NEWS).slice(0, 2), ['18.6', '18.5']);
});

/* ---------- fases: resumo para a lista ---------- */
test('phaseBoards: linhas inicio/meio/fim prontas para a lista, fim = main', () => {
  const comp = L.sanitizeImport([SEED.find((s) => s.id === 'seed-20')], CAT).comps[0];
  const pb = L.phaseBoards(comp, CAT);
  assert.deepEqual(pb.fases.map((f) => f.key), ['inicio', 'meio', 'fim']);
  assert.equal(pb.fases[2].units.length, comp.main.length);
  assert.ok(champs.has(pb.fases[0].units[0].c));
});
