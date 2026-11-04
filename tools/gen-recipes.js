// Gera data/recipes.js a partir do CommunityDragon. Uso: node tools/gen-recipes.js <pt_br.json>
// Baixar: https://raw.communitydragon.org/latest/cdragon/tft/pt_br.json
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) {
  console.error('Uso: node tools/gen-recipes.js <pt_br.json>');
  process.exit(1);
}
global.window = {};
require('../data/catalog.js');
const catalog = window.TFT_CATALOG;
const cd = JSON.parse(fs.readFileSync(src, 'utf8'));
const byApi = new Map(cd.items.map((i) => [i.apiName, i]));

const receitas = {};
const componentes = {};
const semReceita = [];
catalog.items.forEach((it) => {
  if (it.k === 'componente') componentes[it.id] = { n: it.n };
  if (it.k !== 'completo' && it.k !== 'emblema') return;
  const comp = (byApi.get(it.id) || {}).composition || [];
  if (comp.length !== 2) {
    if (it.k === 'completo') throw new Error('Receita inesperada: ' + it.id + ' ' + JSON.stringify(comp));
    semReceita.push(it.id);
    return;
  }
  receitas[it.id] = comp;
  comp.forEach((cid) => {
    if (!componentes[cid]) componentes[cid] = { n: (byApi.get(cid) || {}).name || cid };
  });
});

const out = { fonte: 'CommunityDragon cdragon/tft/pt_br.json (campo composition)', componentes, receitas, semReceita };
const file = path.join(__dirname, '..', 'data', 'recipes.js');
fs.writeFileSync(file, 'window.TFT_RECIPES = ' + JSON.stringify(out) + ';\n', 'utf8');
console.log('recipes:', Object.keys(receitas).length, 'componentes:', Object.keys(componentes).length);
