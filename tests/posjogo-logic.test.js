const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PJ = require('../js/posjogo-logic.js');

const catalog = {
  champs: [
    { id: 'DA_18_Ahri', n: 'Ahri', c: 4, t: ['T1'] },
    { id: 'DA_18_Veigar', n: 'Veigar', c: 1, t: ['T1'] },
    { id: 'DA_Gromp18_AP', n: 'Grompe', c: 2, t: ['T2'] },
    { id: 'DA_18_Ornn', n: 'Ornn', c: 1, t: ['T2'] },
    { id: 'DA_18_Azir', n: 'Azir', c: 3, t: ['T2'] },
    { id: 'DA_18_Ezreal', n: 'Ezreal', c: 4, t: ['T2'] },
    { id: 'DA_18_Sett', n: 'Sett', c: 4, t: ['T2'] },
    { id: 'DA_18_Ashe', n: 'Ashe', c: 5, t: ['T2'] },
  ],
  traits: [],
  items: [
    { id: 'DA_InfinityEdge', n: 'Gume do Infinito', k: 'completo' },
    { id: 'DA_AdaptiveHelm_Radiant', n: 'Elmo Adaptativo Radiante', k: 'completo' },
    { id: 'DA_AdaptiveHelm', n: 'Elmo Adaptativo', k: 'completo' },
    { id: 'DA_Component_BFSword', n: 'Espada G.p.C.', k: 'componente' },
  ],
};
const recipes = { componentes: {}, receitas: { DA_InfinityEdge: ['DA_Component_BFSword', 'DA_Component_BFSword'] } };

test('normId: tira prefixos de set/item, digitos e simbolos', () => {
  assert.equal(PJ.normId('TFT18_Ahri'), 'ahri');
  assert.equal(PJ.normId('DA_18_Ahri'), 'ahri');
  assert.equal(PJ.normId('DA_Gromp18_AP'), 'grompap');
  assert.equal(PJ.normId('TFT_Item_InfinityEdge'), 'infinityedge');
  assert.equal(PJ.normId('TFT5_Item_AdaptiveHelmRadiant'), 'adaptivehelmradiant');
  assert.equal(PJ.normId('DA_AdaptiveHelm_Radiant'), 'adaptivehelmradiant');
  assert.equal(PJ.normId(null), '');
  assert.equal(PJ.normId(42), '');
});

test('mapearId: exato, prefixo unico e sem chute quando ha ambiguidade', () => {
  const idx = PJ.indexar(catalog);
  assert.equal(PJ.mapearId('TFT18_Ahri', idx.champs), 'DA_18_Ahri');
  assert.equal(PJ.mapearId('TFT18_Gromp', idx.champs), 'DA_Gromp18_AP');
  assert.equal(PJ.mapearId('TFT_Item_InfinityEdge', idx.items), 'DA_InfinityEdge');
  assert.equal(PJ.mapearId('TFT5_Item_AdaptiveHelmRadiant', idx.items), 'DA_AdaptiveHelm_Radiant');
  assert.equal(PJ.mapearId('TFT_Item_AdaptiveHelm', idx.items), 'DA_AdaptiveHelm', 'exato vence o prefixo');
  assert.equal(PJ.mapearId('TFT18_Xyz', idx.champs), null);
  assert.equal(PJ.mapearId('TFT18_A', idx.champs), null, 'prefixo curto demais nao vale');
  assert.equal(PJ.mapearId('', idx.champs), null);
});

test('normId: DA_Item_Artifact_* e DA_Component_* batem com o id do catalogo', () => {
  assert.equal(PJ.normId('DA_Item_Artifact_TalismanOfAscension'), 'artifacttalismanofascension');
  assert.equal(PJ.normId('DA_Item_Artifact_Fishbones'), PJ.normId('DA_Artifact_Fishbones'));
  assert.equal(PJ.normId('DA_Component_Spatula'), 'componentspatula');
});

test('catalogo real: ids de item que a Riot manda (artefato, espatula) resolvem', () => {
  const cat = { items: [] };
  global.window = {};
  delete require.cache[require.resolve('../data/catalog.js')];
  require('../data/catalog.js');
  Object.assign(cat, global.window.TFT_CATALOG);
  delete global.window;
  const idx = PJ.indexar(cat);
  assert.equal(PJ.mapearId('DA_Item_Artifact_TalismanOfAscension', idx.items), 'DA_Item_Artifact_TalismanOfAscension');
  assert.equal(idx.itemById.get('DA_Item_Artifact_TalismanOfAscension').k, 'artefato');
  assert.equal(PJ.mapearId('DA_Component_Spatula', idx.items), 'DA_Component_Spatula');
  assert.equal(idx.itemById.get('DA_Component_Spatula').k, 'componente');
  // padrao geral: todo artefato/componente do catalogo resolve para si mesmo quando a Riot manda DA_Item_Artifact_* / DA_Component_*
  cat.items.filter((i) => /^DA_Artifact_/.test(i.id)).forEach((i) => {
    assert.equal(PJ.mapearId(i.id.replace('DA_Artifact_', 'DA_Item_Artifact_'), idx.items), i.id, i.id);
  });
  cat.items.filter((i) => /^DA_Component_/.test(i.id)).forEach((i) => assert.equal(PJ.mapearId(i.id, idx.items), i.id, i.id));
  cat.items.filter((i) => i.k === 'componente' || i.k === 'artefato').forEach((i) => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', i.img)), 'imagem ausente: ' + i.img);
  });
});

function rawMatch(over = {}) {
  return {
    metadata: { match_id: 'BR1_100', participants: ['pA', 'pB'] },
    info: {
      game_datetime: 1762500000000,
      game_length: 1873.4,
      game_version: 'Version 18.6.123 (Nov 04 2026/12:00:00) [PUBLIC]',
      queue_id: 1100,
      tft_game_type: 'standard',
      tft_set_number: 18,
      participants: [
        {
          puuid: 'pB', placement: 8, level: 5, last_round: 20, gold_left: 3, players_eliminated: 0, total_damage_to_players: 10,
          units: [], traits: [], augments: [],
        },
        {
          puuid: 'pA',
          placement: 3,
          level: 8,
          last_round: 38,
          gold_left: 12,
          players_eliminated: 1,
          total_damage_to_players: 77,
          time_eliminated: 1800.2,
          augments: ['TFT18_Augment_PandorasItems', 'TFT9_Augment_RichGetRicherPlus'],
          traits: [{ name: 'TFT18_Elderwood', num_units: 4, style: 2, tier_current: 2, tier_total: 4 }],
          units: [
            { character_id: 'TFT18_Ahri', tier: 2, rarity: 3, itemNames: ['TFT_Item_InfinityEdge'], name: '' },
            { character_id: 'TFT18_Veigar', tier: 3, rarity: 0, itemNames: [] },
          ],
          riotIdGameName: 'Fulano',
          riotIdTagline: 'BR1',
        },
      ],
    },
    ...over,
  };
}

test('normalizarPartida: guarda so o jogador, sem Riot ID nem outros participantes', () => {
  const p = PJ.normalizarPartida(rawMatch(), 'pA');
  assert.equal(p.id, 'BR1_100');
  assert.equal(p.quando, 1762500000000);
  assert.equal(p.duracao, 1873);
  assert.equal(p.fila, 1100);
  assert.equal(p.set, 18);
  assert.equal(p.eu.colocacao, 3);
  assert.equal(p.eu.nivel, 8);
  assert.equal(p.eu.ultimaRodada, 38);
  assert.equal(p.eu.ouroRestante, 12);
  assert.equal(p.eu.unidades.length, 2);
  assert.deepEqual(p.eu.unidades[0], { id: 'TFT18_Ahri', tier: 2, itens: ['TFT_Item_InfinityEdge'] });
  assert.deepEqual(p.eu.augments, ['TFT18_Augment_PandorasItems', 'TFT9_Augment_RichGetRicherPlus']);
  assert.deepEqual(p.eu.tracos[0], { id: 'TFT18_Elderwood', unidades: 4, estilo: 2, atual: 2, total: 4 });
  const txt = JSON.stringify(p);
  assert.ok(!/"pA"|"pB"|Fulano|riotId|puuid/.test(txt), 'sem dados de identidade: ' + txt);
});

test('normalizarPartida: devolve null se o jogador nao esta ou o formato e invalido', () => {
  assert.equal(PJ.normalizarPartida(rawMatch(), 'outro'), null);
  assert.equal(PJ.normalizarPartida({}, 'pA'), null);
  assert.equal(PJ.normalizarPartida(null, 'pA'), null);
  const sem = rawMatch();
  sem.info.participants[1].placement = 0;
  assert.equal(PJ.normalizarPartida(sem, 'pA'), null, 'colocacao fora de 1-8');
});

test('normalizarPartida: campos opcionais ausentes viram null/vazio, sem quebrar', () => {
  const raw = rawMatch();
  const eu = raw.info.participants[1];
  delete eu.augments;
  delete eu.gold_left;
  delete eu.level;
  delete eu.traits;
  const p = PJ.normalizarPartida(raw, 'pA');
  assert.deepEqual(p.eu.augments, []);
  assert.equal(p.eu.ouroRestante, null);
  assert.equal(p.eu.nivel, null);
  assert.deepEqual(p.eu.tracos, []);
});

test('normalizarPartida: nivel fora de 1-10 vira null (a doc fala em Little Legend)', () => {
  const raw = rawMatch();
  raw.info.participants[1].level = 33;
  assert.equal(PJ.normalizarPartida(raw, 'pA').eu.nivel, null);
});

test('rodadaEstimada: estagio 1 tem 4 rodadas, os demais 7', () => {
  assert.equal(PJ.rodadaEstimada(1), '1-1');
  assert.equal(PJ.rodadaEstimada(4), '1-4');
  assert.equal(PJ.rodadaEstimada(5), '2-1');
  assert.equal(PJ.rodadaEstimada(11), '2-7');
  assert.equal(PJ.rodadaEstimada(12), '3-1');
  assert.equal(PJ.rodadaEstimada(25), '4-7');
  assert.equal(PJ.rodadaEstimada(26), '5-1');
  assert.equal(PJ.rodadaEstimada(0), null);
  assert.equal(PJ.rodadaEstimada(null), null);
  assert.equal(PJ.rodadaEstimada(999), null);
});

test('ordemRodada compara rodadas', () => {
  assert.ok(PJ.ordemRodada('4-2') > PJ.ordemRodada('3-7'));
  assert.ok(PJ.ordemRodada('2-1') > PJ.ordemRodada('1-4'));
  assert.equal(PJ.ordemRodada('x'), null);
});

test('sanitizarPartidas: valida formato, limita tamanho e remove duplicadas', () => {
  const ok = PJ.normalizarPartida(rawMatch(), 'pA');
  const lixo = [null, 5, 'x', {}, { id: 'a', eu: null }, { id: '<script>', quando: 1, eu: { colocacao: 9 } }];
  const dup = JSON.parse(JSON.stringify(ok));
  const res = PJ.sanitizarPartidas({ partidas: [ok, dup, ...lixo] });
  assert.equal(res.partidas.length, 1);
  assert.equal(res.descartadas, lixo.length);
  assert.equal(PJ.sanitizarPartidas(null).partidas.length, 0);
  assert.equal(PJ.sanitizarPartidas({ partidas: 'x' }).partidas.length, 0);
});

test('sanitizarPartidas: trunca strings e listas gigantes e ordena da mais nova para a mais antiga', () => {
  const base = PJ.normalizarPartida(rawMatch(), 'pA');
  const a = JSON.parse(JSON.stringify(base));
  a.id = 'BR1_1';
  a.quando = 100;
  a.eu.augments = Array.from({ length: 50 }, (_, i) => 'AUG' + 'x'.repeat(500) + i);
  a.eu.unidades = Array.from({ length: 50 }, () => ({ id: 'TFT18_Ahri', tier: 2, itens: ['a', 'b', 'c', 'd', 'e'] }));
  const b = JSON.parse(JSON.stringify(base));
  b.id = 'BR1_2';
  b.quando = 200;
  const res = PJ.sanitizarPartidas({ partidas: [a, b] });
  assert.deepEqual(res.partidas.map((p) => p.id), ['BR1_2', 'BR1_1']);
  const x = res.partidas[1];
  assert.ok(x.eu.augments.length <= 8 && x.eu.augments.every((s) => s.length <= 80));
  assert.ok(x.eu.unidades.length <= 14 && x.eu.unidades.every((u) => u.itens.length <= 3));
});

test('sanitizarPartidas: id so aceita caracteres seguros', () => {
  const p = PJ.normalizarPartida(rawMatch({ metadata: { match_id: 'BR1_<img onerror=1>' } }), 'pA');
  assert.equal(p, null);
});

function estadoResolvido(over = {}) {
  const base = PJ.normalizarPartida(rawMatch(), 'pA');
  Object.assign(base.eu, over);
  return PJ.resolver(base, catalog);
}

test('resolver: mapeia campeoes e itens para o catalogo e preserva o que nao mapeou', () => {
  const r = estadoResolvido();
  assert.equal(r.eu.unidades[0].c, 'DA_18_Ahri');
  assert.equal(r.eu.unidades[0].nome, 'Ahri');
  assert.equal(r.eu.unidades[0].custo, 4);
  assert.equal(r.eu.unidades[0].itens[0].id, 'DA_InfinityEdge');
  assert.equal(r.eu.unidades[0].itens[0].n, 'Gume do Infinito');
  assert.equal(r.eu.rodada, '6-6', 'last_round 38: 4 rodadas no estagio 1 e 7 por estagio depois');
  const sem = estadoResolvido({ unidades: [{ id: 'TFT18_Coisa', tier: 1, itens: ['TFT_Item_Zzz'] }] });
  assert.equal(sem.eu.unidades[0].c, null);
  assert.equal(sem.eu.unidades[0].nome, 'Coisa');
  assert.equal(sem.eu.unidades[0].itens[0].id, null);
  assert.equal(sem.naoMapeados, 2);
});

test('resolver: aprimoramentos ganham nome legivel (CamelCase) sem prefixo', () => {
  const r = estadoResolvido();
  assert.deepEqual(r.eu.aprimoramentos, ['Pandoras Items', 'Rich Get Richer Plus']);
});

test('estiloDe: reroll, fast 9, fast 8, nivel baixo e queda cedo', () => {
  const u = (id, tier) => ({ id, tier, itens: [] });
  assert.equal(estadoResolvidoEstilo({ nivel: 7, unidades: [u('TFT18_Veigar', 3), u('TFT18_Ornn', 2)] }), 'reroll');
  assert.equal(estadoResolvidoEstilo({ nivel: 9, unidades: [u('TFT18_Ahri', 2)] }), 'fast9');
  assert.equal(estadoResolvidoEstilo({ nivel: 8, unidades: [u('TFT18_Ahri', 2)] }), 'fast8');
  assert.equal(estadoResolvidoEstilo({ nivel: 6, ultimaRodada: 25, unidades: [u('TFT18_Ahri', 1)] }), 'nivel-baixo');
  assert.equal(estadoResolvidoEstilo({ nivel: 5, ultimaRodada: 12, unidades: [u('TFT18_Ahri', 1)] }), 'caiu-cedo');
  assert.equal(estadoResolvidoEstilo({ nivel: null, unidades: [] }), 'indefinido');
});
function estadoResolvidoEstilo(over) {
  return PJ.estiloDe(estadoResolvido(over)).id;
}

const comps = [
  { id: 'c1', nome: 'Ahri Solo', estilo: 'Nível 8', main: [{ c: 'DA_18_Ahri', s: 2, i: ['DA_InfinityEdge'] }, { c: 'DA_18_Veigar', s: 1, i: [] }, { c: 'DA_18_Ornn', s: 1, i: [] }], flex: [] },
  { id: 'c2', nome: 'Outra', estilo: 'Nível 9', main: [{ c: 'DA_18_Sett', s: 2, i: [] }, { c: 'DA_18_Ashe', s: 2, i: [] }, { c: 'DA_18_Ezreal', s: 2, i: [] }], flex: [] },
];

test('compativeis: ordena pelas comps do usuario usando a pontuacao do recommend', () => {
  const r = estadoResolvido({ unidades: [{ id: 'TFT18_Ahri', tier: 2, itens: ['TFT_Item_InfinityEdge'] }, { id: 'TFT18_Veigar', tier: 2, itens: [] }, { id: 'TFT18_Ornn', tier: 2, itens: [] }] });
  const rank = PJ.compativeis(r, comps, catalog, recipes);
  assert.equal(rank[0].id, 'c1');
  assert.equal(rank[0].tem, 3);
  assert.equal(rank[0].total, 3);
  assert.ok(rank[0].sim > 90 && rank[0].sim <= 100);
  assert.ok(rank[1].sim < 20);
  assert.equal(rank[0].reconhecida, true);
  assert.equal(rank[1].reconhecida, false);
});

test('compativeis: sem comps ou sem campeoes mapeados devolve lista vazia ou zerada', () => {
  assert.deepEqual(PJ.compativeis(estadoResolvido(), [], catalog, recipes), []);
  const r = estadoResolvido({ unidades: [{ id: 'TFT18_Nada', tier: 1, itens: [] }] });
  assert.equal(PJ.compativeis(r, comps, catalog, recipes)[0].tem, 0);
});

test('analisar: acha que "morreu com ouro" so quando perdeu e sobrou ouro, e cita o guia', () => {
  const dados = { catalog, recipes, comps };
  const a = PJ.analisar(PJ.normalizarPartida(Object.assign(rawMatch(), {}), 'pA'), dados);
  assert.ok(!a.achados.some((x) => x.id === 'ouro-parado'), 'top 3 com 12 de ouro nao e erro');
  const raw = rawMatch();
  raw.info.participants[1].placement = 6;
  raw.info.participants[1].gold_left = 45;
  const b = PJ.analisar(PJ.normalizarPartida(raw, 'pA'), dados);
  const ach = b.achados.find((x) => x.id === 'ouro-parado');
  assert.ok(ach);
  assert.match(ach.texto, /45/);
  assert.ok(ach.regra.trecho.length > 10 && ach.regra.ref);
});

test('analisar: nivel baixo tarde e queda antes do 4-1 apontam a curva do guia', () => {
  const dados = { catalog, recipes, comps };
  const raw = rawMatch();
  Object.assign(raw.info.participants[1], { placement: 7, level: 6, last_round: 24 });
  const a = PJ.analisar(PJ.normalizarPartida(raw, 'pA'), dados);
  assert.ok(a.achados.some((x) => x.id === 'nivel-baixo-tarde'));
  const raw2 = rawMatch();
  Object.assign(raw2.info.participants[1], { placement: 8, level: 5, last_round: 14 });
  const b = PJ.analisar(PJ.normalizarPartida(raw2, 'pA'), dados);
  assert.ok(b.achados.some((x) => x.id === 'caiu-antes-do-4-1'));
  assert.ok(!b.achados.some((x) => x.id === 'nivel-baixo-tarde'), 'nao julga nivel de quem caiu no estagio 3');
});

test('analisar: sempre lista o que a API nao permite saber e nunca inventa ouro por rodada', () => {
  const a = PJ.analisar(PJ.normalizarPartida(rawMatch(), 'pA'), { catalog, recipes, comps });
  const txt = a.naoSabe.join(' | ');
  assert.match(txt, /ouro (a cada|por) rodada/i);
  assert.match(txt, /rolagens/i);
  assert.match(txt, /scout|contest/i);
  assert.match(txt, /vida/i);
});

test('aprimoramentos: a tft-match-v1 nao manda o campo; a pagina diz isso e nao promete nem inventa', () => {
  const a = PJ.analisar(PJ.normalizarPartida(rawMatch(), 'pA'), { catalog, recipes, comps });
  assert.match(a.naoSabe.join(' | '), /aprimoramentos.*(n[aã]o (envia|devolve|informa)|n[aã]o vem)/i);
  const html = fs.readFileSync(path.join(__dirname, '..', 'posjogo.html'), 'utf8');
  assert.doesNotMatch(html, /augments?,|, augments?|aprimoramentos, comp/i, 'posjogo.html nao pode prometer aprimoramentos');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'js', 'posjogo.js'), 'utf8');
  assert.match(ui, /a API da Riot não informa/, 'cartao da partida avisa quando nao ha aprimoramentos');
});

test('analisar: aviso quando a rodada e o nivel sao estimados', () => {
  const a = PJ.analisar(PJ.normalizarPartida(rawMatch(), 'pA'), { catalog, recipes, comps });
  assert.ok(a.avisos.some((x) => /estimad/i.test(x)));
});

test('estatisticas: media, top 4, vitorias, ultimas N e por comp/estilo', () => {
  const dados = { catalog, recipes, comps };
  const mk = (i, col, units, nivel) => {
    const raw = rawMatch({ metadata: { match_id: 'BR1_' + i } });
    Object.assign(raw.info, { game_datetime: 1000 + i });
    Object.assign(raw.info.participants[1], { placement: col, level: nivel, units: units.map((id) => ({ character_id: id, tier: 2, itemNames: [] })) });
    return PJ.analisar(PJ.normalizarPartida(raw, 'pA'), dados);
  };
  const aps = [
    mk(1, 1, ['TFT18_Ahri', 'TFT18_Veigar', 'TFT18_Ornn'], 8),
    mk(2, 2, ['TFT18_Ahri', 'TFT18_Veigar', 'TFT18_Ornn'], 8),
    mk(3, 6, ['TFT18_Sett', 'TFT18_Ashe', 'TFT18_Ezreal'], 9),
    mk(4, 8, ['TFT18_Azir'], 7),
  ];
  const e = PJ.estatisticas(aps, 2);
  assert.equal(e.total, 4);
  assert.equal(e.media, 4.25);
  assert.equal(e.top4, 50);
  assert.equal(e.vitorias, 25);
  assert.equal(e.ultimas.n, 2);
  assert.equal(e.ultimas.media, 7, 'as 2 mais novas: partidas 4 e 3');
  const c1 = e.porComp.find((x) => x.id === 'c1');
  assert.equal(c1.n, 2);
  assert.equal(c1.media, 1.5);
  assert.equal(c1.top4, 100);
  assert.ok(e.porEstilo.find((x) => x.id === 'fast8').n >= 2);
  assert.equal(PJ.estatisticas([], 10).total, 0);
});

test('regras citadas nos achados existem, palavra por palavra, em estrategia-padrao.md', () => {
  const md = fs.readFileSync(path.join(__dirname, '../data/estrategia-padrao.md'), 'utf8')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => (/^\s*\|/.test(l) ? l.split('|').map((c) => c.trim()).filter(Boolean).join(' | ') : l))
    .join('\n')
    .replace(/\*/g, '')
    .replace(/[ \t]+/g, ' ');
  Object.values(PJ.REGRAS).forEach((r) => {
    assert.ok(md.includes(r.trecho), r.id + ' -> ' + r.trecho);
    assert.ok(r.ref.length > 3);
  });
  assert.ok(Object.keys(PJ.REGRAS).length >= 4);
});

test('resolver: tracos ativos com nome do catalogo, do mais forte ao mais fraco; inativos ficam de fora', () => {
  const cat = { ...catalog, traits: [{ id: 'DA_18_Elderwood', n: 'Sabugueiro', img: 'assets/traits/e.png' }, { id: 'DA_18_Solar', n: 'Solar', img: 'assets/traits/s.png' }] };
  const base = PJ.normalizarPartida(rawMatch(), 'pA');
  base.eu.tracos = [
    { id: 'TFT18_Solar', unidades: 3, estilo: 1, atual: 1, total: 3 },
    { id: 'TFT18_Elderwood', unidades: 5, estilo: 2, atual: 2, total: 5 },
    { id: 'TFT18_Nada', unidades: 1, estilo: 0, atual: 0, total: 3 },
    { id: 'TFT18_Estranho', unidades: 2, estilo: 1, atual: 1, total: 2 },
  ];
  const r = PJ.resolver(base, cat);
  assert.deepEqual(r.eu.tracosAtivos.map((t) => [t.nome, t.unidades, t.estilo]), [['Sabugueiro', 5, 2], ['Solar', 3, 1], ['Estranho', 2, 1]]);
  assert.equal(r.eu.tracosAtivos[0].img, 'assets/traits/e.png');
  assert.equal(r.eu.tracosAtivos[2].img, null);
});

test('analisar: nivel 7 tarde com top 4 nao e erro; estilo reroll precisa de 3★ barato (1 so no nivel 8 nao conta)', () => {
  const dados = { catalog, recipes, comps };
  const raw = rawMatch();
  Object.assign(raw.info.participants[1], { placement: 2, level: 7, last_round: 38 });
  assert.ok(!PJ.analisar(PJ.normalizarPartida(raw, 'pA'), dados).achados.some((x) => x.id === 'nivel-baixo-tarde'));
  assert.equal(estadoResolvidoEstilo({ nivel: 8, unidades: [{ id: 'TFT18_Veigar', tier: 3, itens: [] }] }), 'fast8');
  assert.equal(estadoResolvidoEstilo({ nivel: 8, unidades: [{ id: 'TFT18_Veigar', tier: 3, itens: [] }, { id: 'TFT18_Ornn', tier: 3, itens: [] }] }), 'reroll');
});
