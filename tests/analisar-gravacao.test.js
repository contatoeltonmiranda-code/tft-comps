const test = require('node:test');
const assert = require('node:assert/strict');
const { analisar, formatar } = require('../tools/analisar-gravacao.js');

global.window = {};
require('../data/catalog.js');
require('../data/seed.js');
require('../data/recipes.js');
const { TFT_CATALOG: catalog, TFT_SEED: seed, TFT_RECIPES: recipes } = global.window;
delete global.window;

const info = (t, feature, key, value) => ({ t, tipo: 'info', feature, key, value });
const round = (t, stage, name = 'Combat') => info(t, 'match_info', 'round_type', JSON.stringify({ stage, name, type: 'PVP' }));
const pecas = (...ids) => JSON.stringify(Object.fromEntries(ids.map((id, i) => ['cell_' + (i + 1), { name: id, level: '1', item_1: '', item_2: '', item_3: '' }])));

const doc = {
  versao: 1,
  entradas: [
    round(1, '1-1', 'Encounter'),
    info(2, 'me', 'gold', '2'),
    info(3, 'me', 'xp', '{"level":2,"current_xp":0,"xp_max":2}'),
    info(4, 'board', 'board_pieces', pecas('DA_18_Veigar')),
    round(5, '1-2'),
    info(6, 'me', 'gold', '8'),
    info(7, 'board', 'board_pieces', pecas('DA_18_Veigar', 'DA_18_LeBlanc', 'DA_18_Fantasma')),
    round(8, '2-1', 'Augment'),
    round(9, '2-2'),
  ],
};

test('analisar reproduz o estado ao fim de cada rodada e recomenda so ate 2-1', () => {
  const r = analisar(doc, catalog, seed, recipes);
  assert.deepEqual(r.pontos.map((p) => p.stage), ['1-1', '1-2', '2-1', '2-2']);
  assert.equal(r.pontos[0].estado.gold, 2);
  assert.equal(r.pontos[0].estado.board.length, 1);
  assert.equal(r.pontos[1].estado.gold, 8);
  assert.equal(r.pontos[1].estado.board.length, 2);
  assert.equal(r.pontos[0].resultado.top.length, 3);
  assert.equal(r.pontos[1].resultado.top.length, 3);
  assert.deepEqual(r.pontos[2].resultado.top, []);
  assert.equal(r.pontos[2].resultado.fase, 'aprimoramento');
  assert.equal(r.pontos[3].resultado.fase, 'encerrado');
});

test('analisar junta ids desconhecidos para conferir o mapeamento', () => {
  const r = analisar(doc, catalog, seed, recipes);
  assert.deepEqual(r.desconhecidos.map((d) => d.bruto), ['DA_18_Fantasma']);
});

test('analisar ignora entradas de erro/eventos e nao quebra com doc vazio', () => {
  assert.deepEqual(analisar({ entradas: [{ tipo: 'erro', mensagem: 'x' }, { tipo: 'evento', name: 'round_start' }] }, catalog, seed, recipes).pontos, []);
  assert.deepEqual(analisar(null, catalog, seed, recipes).pontos, []);
});

test('formatar escreve tabela em portugues sem dados de aprimoramento', () => {
  const txt = formatar(analisar(doc, catalog, seed, recipes), catalog);
  assert.match(txt, /1-1/);
  assert.match(txt, /sem recomendação/);
  assert.match(txt, /DA_18_Fantasma/);
  assert.equal(/augment/i.test(txt.replace('Augment', '')), false);
});
