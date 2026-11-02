const test = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../data/catalog.js');
require('../data/seed.js');
const L = require('../js/logic.js');
const CAT = window.TFT_CATALOG;
const SEED = window.TFT_SEED;

test('seed: ids unicos e todos os campeoes/itens existem no catalogo', () => {
  const ids = new Set(SEED.map((c) => c.id));
  assert.equal(ids.size, SEED.length);
  const { comps, dropped } = L.sanitizeImport(SEED, CAT);
  assert.equal(dropped, 0);
  assert.equal(comps.length, SEED.length);
});

test('seed: 15 comps originais intactas (ids 01..15 sem campo desde) e 16a nova com desde 2', () => {
  assert.equal(SEED.length, 16);
  SEED.slice(0, 15).forEach((c, i) => {
    assert.equal(c.id, 'seed-' + String(i + 1).padStart(2, '0'));
    assert.equal(c.desde, undefined);
  });
  assert.equal(SEED[15].id, 'seed-16');
  assert.equal(SEED[15].desde, 2);
  assert.equal(window.TFT_SEED_VERSION, 2);
});

test('seed-16 (print 14): tracos batem com o painel do print', () => {
  const comp = L.sanitizeImport(SEED, CAT).comps.find((c) => c.id === 'seed-16');
  assert.equal(comp.main.length, 8);
  const t = Object.fromEntries(L.activeTraits(comp, CAT).map((x) => [x.n, x.count]));
  assert.equal(t['Defendente'], 6);
  assert.equal(t['Rival'], 1);
  assert.equal(t['Enfeitiçador'], 2);
  assert.equal(t['Flora Fatalis'], 1);
  ['Congregação das Bruxas', 'Emanador', 'Feérico', 'Inferno'].forEach((n) => assert.equal(t[n], undefined, n + ' inativo no print'));
  const tn = Object.fromEntries(CAT.traits.map((x) => [x.id, x.n]));
  const cnt = {};
  comp.main.forEach((u) => CAT.champs.find((c) => c.id === u.c).t.forEach((id) => { cnt[tn[id]] = (cnt[tn[id]] || 0) + 1; }));
  assert.equal(cnt['Congregação das Bruxas'], 2);
  assert.equal(cnt['Emanador'], 1);
  assert.equal(cnt['Feérico'], 1);
  assert.equal(cnt['Inferno'], 1);
});
