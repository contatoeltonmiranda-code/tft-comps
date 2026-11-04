const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/gep-map.js');
const R = require('../js/recommend.js');

global.window = {};
require('../data/catalog.js');
require('../data/seed.js');
require('../data/recipes.js');
const { TFT_CATALOG: catalog, TFT_SEED: seed, TFT_RECIPES: recipes } = global.window;
delete global.window;

// Payloads copiados dos exemplos da doc oficial do Overwolf (supported-games/teamfight-tactics).
const DOC = {
  board: '{"cell_1":{"name":"DA_18_Varus","level":"1","item_1":"","item_2":"","item_3":""},"cell_3":{"name":"DA_18_Sentry","level":"2","item_1":"","item_2":"","item_3":""},"cell_5":{"name":"DA_CrimsonRaptor18","level":"1","item_1":"","item_2":"","item_3":""}}',
  bench: '{"cell_1":{"name":"DA_18_Diana","level":"1","item_1":"","item_2":"","item_3":""},"cell_2":{"name":"DA_18_Hecarim","level":"1","item_1":"","item_2":"","item_3":""}}',
  xp: '{"level":1,"current_xp":0,"xp_max":2}',
  round: '{"stage":"1-1","name":"Encounter","type":"PVE"}',
  itemBench: '[{"summoner":"Sperlingsprinz96","tag_line":"euww","bench_items":[{"name":"DA_Reforger","count":2},{"name":"DA_Consumable_ItemRemover","count":5},{"name":"DA_Riftbeast18_Selector","count":1},{"name":"DA_Component_SparringGloves","count":1}]},{"summoner":"Rammus","tag_line":"0815","bench_items":[{"name":"DA_Component_BFSword","count":4}]}]',
};

const upd = (feature, key, value) => ({ feature, category: feature, key, value });

test('acumular aceita o envelope plano (feature/key/value) e o aninhado (info.feature.key)', () => {
  let snap = {};
  snap = G.acumular(snap, upd('me', 'gold', '12'));
  snap = G.acumular(snap, { feature: 'me', info: { me: { xp: DOC.xp } } });
  snap = G.acumular(snap, { feature: 'match_info', category: 'match_info', key: 'round_type', data: DOC.round });
  assert.equal(snap.me.gold, 12);
  assert.deepEqual(snap.me.xp, { level: 1, current_xp: 0, xp_max: 2 });
  assert.equal(snap.match_info.round_type.stage, '1-1');
});

test('formato aninhado usa a feature de fora: augments/categoria "me" nao suja a feature "me"', () => {
  const snap = G.acumular({}, { feature: 'augments', info: { me: { picked_augment: '{"slot_1":{"name":"DA_X"}}' } } });
  assert.equal(snap.me, undefined);
  assert.deepEqual(Object.keys(snap.augments), ['picked_augment']);
  assert.deepEqual(G.expandir({ feature: 'minions', info: { game_info: { minionKills: '3' } } }), [{ feature: 'minions', key: 'minionKills', value: '3' }]);
});

test('acumular nao quebra com lixo e nao polui prototype', () => {
  let snap = {};
  assert.doesNotThrow(() => { snap = G.acumular(snap, null); snap = G.acumular(snap, { feature: '__proto__', key: 'x', value: 1 }); snap = G.acumular(snap, upd('board', 'board_pieces', '{quebrado')); });
  assert.equal({}.x, undefined);
  assert.equal(snap.board.board_pieces, '{quebrado');
});

test('mapId: exato, aproximado (caixa/prefixo legado), ignorado e desconhecido', () => {
  assert.deepEqual(G.mapId('champ', 'DA_18_Varus', catalog, recipes), { id: 'DA_18_Varus', certeza: 'exata' });
  assert.equal(G.mapId('champ', 'da_18_varus', catalog, recipes).certeza, 'aproximada');
  assert.equal(G.mapId('champ', 'DA_18_Nao_Existe', catalog, recipes).certeza, 'desconhecido');
  assert.deepEqual(G.mapId('item', 'DA_Component_BFSword', catalog, recipes), { id: 'DA_Component_BFSword', certeza: 'exata' });
  assert.deepEqual(G.mapId('item', 'DA_Deathblade', catalog, recipes), { id: 'DA_Deathblade', certeza: 'exata' });
  assert.deepEqual(G.mapId('item', 'TFT_Item_NeedlesslyLargeRod', catalog, recipes), { id: 'DA_Component_NeedlesslyLargeRod', certeza: 'aproximada' });
  assert.deepEqual(G.mapId('item', 'TFT_Item_Spatula', catalog, recipes), { id: 'DA_Component_Spatula', certeza: 'aproximada' });
  assert.equal(G.mapId('item', 'DA_Reforger', catalog, recipes).certeza, 'ignorado');
  assert.equal(G.mapId('item', 'DA_Consumable_ItemRemover', catalog, recipes).certeza, 'ignorado');
  assert.equal(G.mapId('item', 'DA_Riftbeast18_Selector', catalog, recipes).certeza, 'ignorado');
  assert.equal(G.mapId('item', 'DA_Item_Inventado', catalog, recipes).certeza, 'desconhecido');
  assert.equal(G.mapId('item', '', catalog, recipes).certeza, 'ignorado');
});

test('todos os ids de campeao dos exemplos da doc existem no catalogo (exatos)', () => {
  const ids = ['DA_18_Varus', 'DA_18_Rakan', 'DA_18_Sentry', 'DA_18_Xayah', 'DA_CrimsonRaptor18', 'DA_Gromp18_AP', 'DA_Cinderling18', 'DA_Scuttlecrab18', 'DA_Krug18', 'DA_Murkwolf18', 'DA_18_Tristana', 'DA_18_Ornn', 'DA_18_Veigar', 'DA_18_LeBlanc', 'DA_18_Diana', 'DA_18_Hecarim', 'DA_18_Yorick', 'DA_18_Leona', 'DA_18_Soraka', 'DA_Karma18', 'DA_18_Lillia'];
  ids.forEach((id) => assert.equal(G.mapId('champ', id, catalog, recipes).certeza, 'exata', id));
});

test('normalizar converte os payloads da doc em estado para o recomendador', () => {
  let snap = {};
  [upd('me', 'gold', '14'), upd('me', 'xp', DOC.xp), upd('me', 'summoner_name', 'Sperlingsprinz96'), upd('match_info', 'round_type', DOC.round), upd('board', 'board_pieces', DOC.board), upd('bench', 'bench_pieces', DOC.bench), upd('bench', 'item_bench', DOC.itemBench)].forEach((u) => { snap = G.acumular(snap, u); });
  const { estado, desconhecidos, avisos } = G.normalizar(snap, catalog, recipes);
  assert.equal(estado.stage, '1-1');
  assert.equal(estado.gold, 14);
  assert.equal(estado.level, 1);
  assert.deepEqual(estado.board.map((u) => [u.c, u.s, u.cell]), [['DA_18_Varus', 1, 1], ['DA_18_Sentry', 2, 3], ['DA_CrimsonRaptor18', 1, 5]]);
  assert.deepEqual(estado.bench.map((u) => u.c), ['DA_18_Diana', 'DA_18_Hecarim']);
  assert.deepEqual(estado.itens, ['DA_Component_SparringGloves']);
  assert.deepEqual(desconhecidos, []);
  assert.deepEqual(avisos, []);
  assert.equal(R.recommend(estado, seed, catalog, recipes).top.length, 3);
});

test('item_bench: so o jogador local entra; sem nome local nenhum item e usado', () => {
  let snap = G.acumular({}, upd('bench', 'item_bench', DOC.itemBench));
  let r = G.normalizar(snap, catalog, recipes);
  assert.deepEqual(r.estado.itens, []);
  assert.ok(r.avisos.some((a) => /item_bench/.test(a)));
  snap = G.acumular(snap, upd('me', 'summoner_name', 'rammus'));
  r = G.normalizar(snap, catalog, recipes);
  assert.deepEqual(r.estado.itens, ['DA_Component_BFSword', 'DA_Component_BFSword', 'DA_Component_BFSword', 'DA_Component_BFSword']);
});

test('normalizar nunca carrega oponentes nem aprimoramentos', () => {
  let snap = {};
  [upd('board', 'opponent_board_pieces', DOC.board), upd('augments', 'me', '{"augment_1":{"name":"DA_X"}}'), upd('augments', 'picked_augment', '{"slot_1":{"name":"DA_Y"}}'), upd('match_stats', 'board_players', '{"a":1}'), upd('match_info', 'opponent', '{"name":"Rival"}')].forEach((u) => { snap = G.acumular(snap, u); });
  const out = JSON.stringify(G.normalizar(snap, catalog, recipes));
  ['DA_X', 'DA_Y', 'Rival', 'Varus'].forEach((s) => assert.equal(out.includes(s), false, s));
});

test('ids desconhecidos e aproximados sao registrados, nao inventados', () => {
  const board = '{"cell_1":{"name":"DA_18_Fantasma","level":"1","item_1":"DA_Item_Novo","item_2":"TFT_Item_BFSword","item_3":""},"cell_2":{"name":"da_18_varus","level":"3","item_1":"","item_2":"","item_3":""}}';
  const { estado, desconhecidos, aproximados } = G.normalizar(G.acumular({}, upd('board', 'board_pieces', board)), catalog, recipes);
  assert.deepEqual(estado.board.map((u) => u.c), ['DA_18_Varus']);
  assert.equal(estado.board[0].s, 3);
  assert.deepEqual(desconhecidos.map((d) => d.bruto).sort(), ['DA_18_Fantasma', 'DA_Item_Novo']);
  assert.deepEqual(aproximados.map((d) => d.bruto).sort(), ['TFT_Item_BFSword', 'da_18_varus']);
});

test('estado parcial (sem dados ainda) nao quebra e vira estado vazio seguro', () => {
  const { estado } = G.normalizar({}, catalog, recipes);
  assert.deepEqual(estado, { stage: null, gold: 0, level: 1, board: [], bench: [], itens: [] });
  assert.equal(R.recommend(estado, seed, catalog, recipes).fase, 'desconhecido');
});

test('limparParaGravar: allowlist, sem augments, sem tokens, sem oponentes', () => {
  const ctx = { localName: 'Sperlingsprinz96' };
  assert.equal(G.limparParaGravar('me', 'gold', '5', ctx), '5');
  assert.equal(G.limparParaGravar('board', 'opponent_board_pieces', DOC.board, ctx), undefined);
  assert.equal(G.limparParaGravar('augments', 'me', '{}', ctx), undefined);
  assert.equal(G.limparParaGravar('lcu_info', 'token', 'abc', ctx), undefined);
  assert.equal(G.limparParaGravar('match_stats', 'board_players', '{}', ctx), undefined);
  assert.equal(G.limparParaGravar('match_info', 'opponent', '{}', ctx), undefined);
  assert.equal(G.limparParaGravar('match_info', 'round_outcome', '{}', ctx), undefined);
  assert.equal(G.limparParaGravar('roster', 'player_status', '{}', ctx), undefined);
  const ib = JSON.parse(G.limparParaGravar('bench', 'item_bench', DOC.itemBench, ctx));
  assert.deepEqual(ib.map((p) => p.summoner), ['Sperlingsprinz96']);
  assert.equal(G.limparParaGravar('bench', 'item_bench', DOC.itemBench, {}), undefined);
});

test('limparParaGravar remove chaves com "augment" em qualquer nivel (live_client_data, objetos)', () => {
  const v = { a: 1, customAugmentContainer: 'x', nested: { picked_augment: 1, ok: 2, list: [{ augments: [1], z: 3 }] } };
  const out = G.limparParaGravar('live_client_data', 'game_data', v, {});
  assert.deepEqual(out, { a: 1, nested: { ok: 2, list: [{ z: 3 }] } });
});

test('limparEvento: so eventos da allowlist', () => {
  assert.equal(G.limparEvento({ name: 'round_start', data: 'PVE' }).name, 'round_start');
  assert.equal(G.limparEvento({ name: 'picked_item', data: 'TFT_Item_Spatula' }).name, 'picked_item');
  assert.equal(G.limparEvento({ name: 'picked_augment', data: 'x' }), undefined);
  assert.equal(G.limparEvento(null), undefined);
});

test('features pedidas ao GEP nao incluem aprimoramentos, oponentes, credenciais nem roster', () => {
  ['augments', 'match_stats', 'roster', 'lcu_info', 'summoner_info', 'carousel', 'end_game'].forEach((f) => assert.equal(G.FEATURES_GRAVAR.includes(f), false, f));
  ['me', 'match_info', 'board', 'bench', 'store'].forEach((f) => assert.ok(G.FEATURES_GRAVAR.includes(f), f));
});
