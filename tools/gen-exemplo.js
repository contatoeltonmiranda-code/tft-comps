'use strict';
// Gera data/posjogo-exemplo.js: partidas FICTICIAS (marcadas "exemplo") para a pagina Pos-jogo funcionar sem chave da Riot.
// Monta cada partida a partir das comps do seed, com nomes de campeoes/itens no estilo da API (TFT18_Ahri, TFT_Item_X).
//   node tools/gen-exemplo.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = { window: {} };
vm.createContext(ctx);
['catalog', 'seed'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '../data', f + '.js'), 'utf8'), ctx));
const { TFT_CATALOG: catalog, TFT_SEED: seed } = ctx.window;
const champ = new Map(catalog.champs.map((c) => [c.id, c]));
const trait = new Map(catalog.traits.map((t) => [t.id, t]));
const comp = (id) => seed.find((c) => c.id === id);

const rawChamp = (id) => id.replace(/^DA_18_/, 'TFT18_');
const rawItem = (id) => 'TFT_Item_' + id.replace(/^DA_(?:18_)?/, '');
const rawTrait = (id) => id.replace(/^DA_18_/, 'TFT18_');

function tracos(ids) {
  const cont = new Map();
  [...new Set(ids)].forEach((id) => (champ.get(id).t || []).forEach((t) => cont.set(t, (cont.get(t) || 0) + 1)));
  return [...cont.entries()].map(([t, n]) => {
    const bp = (trait.get(t) || { bp: [1] }).bp;
    const idx = bp.filter((b) => b <= n).length;
    const estilo = idx === 0 ? 0 : idx === bp.length ? (bp.length > 1 ? 3 : 2) : 1;
    return { id: rawTrait(t), unidades: n, estilo, atual: idx, total: bp.length };
  });
}

// board: ids dos campeoes; tiers: {id: estrelas}; itens: {id: [itens]}
function partida(i, { compId, extras, col, nivel, ultima, ouro, tiers = {}, max2 = false, aug, minutos }) {
  const base = compId ? comp(compId).main : [];
  const lista = base.map((u) => ({ c: u.c, s: Math.min(max2 ? 2 : 3, tiers[u.c] || u.s || 1), i: u.i || [] })).concat((extras || []).map((c) => ({ c, s: tiers[c] || 1, i: [] })));
  return {
    id: `EXEMPLO_${String(i).padStart(2, '0')}`,
    quando: Date.UTC(2026, 10, 6, 22, 0) - (i - 1) * 3600 * 1000 * 5,
    duracao: minutos * 60,
    versao: 'Version 18.6 (exemplo)',
    fila: 1100,
    tipo: 'standard',
    set: 18,
    eu: {
      colocacao: col,
      nivel,
      ultimaRodada: ultima,
      ouroRestante: ouro,
      eliminados: col <= 2 ? 2 : col <= 4 ? 1 : 0,
      dano: 40 + (9 - col) * 12,
      augments: aug,
      tracos: tracos(lista.map((u) => u.c)),
      unidades: lista.slice(0, 10).map((u) => ({ id: rawChamp(u.c), tier: Math.min(3, u.s), itens: u.i.slice(0, 3).map(rawItem) })),
    },
  };
}

const AUG = {
  pand: 'TFT9_Augment_PandorasItems',
  rica: 'TFT6_Augment_RichGetRicher',
  tres: 'TFT7_Augment_ThreesCompany',
  pilha: 'TFT9_Augment_ComponentGrabBag',
  pais: 'TFT10_Augment_Cybernetic',
  bolso: 'TFT4_Augment_PocketAces',
};

const reroll = (id) => comp(id).main.slice(0, 2).reduce((o, u) => Object.assign(o, { [u.c]: 3 }), {});
const outras = ['DA_18_Ahri', 'DA_18_Sett', 'DA_18_Ezreal'];

const lista = [
  partida(1, { compId: 'seed-01', col: 1, nivel: 7, ultima: 38, ouro: 6, tiers: reroll('seed-01'), aug: [AUG.pand, AUG.rica, AUG.tres], minutos: 33 }),
  partida(2, { compId: 'seed-04', col: 3, nivel: 8, ultima: 35, ouro: 11, aug: [AUG.rica, AUG.pilha, AUG.bolso], minutos: 31 }),
  partida(3, { compId: 'seed-17', col: 5, nivel: 8, ultima: 31, ouro: 38, aug: [AUG.pais, AUG.tres, AUG.pilha], minutos: 28 }),
  partida(4, { compId: 'seed-21', col: 2, nivel: 9, ultima: 40, ouro: 2, aug: [AUG.rica, AUG.bolso, AUG.pand], minutos: 36 }),
  partida(5, { compId: 'seed-18', max2: true, col: 6, nivel: 7, ultima: 30, ouro: 14, aug: [AUG.pilha, AUG.pais, AUG.tres], minutos: 27 }),
  partida(6, { compId: null, extras: outras, col: 8, nivel: 5, ultima: 14, ouro: 2, aug: [AUG.bolso], minutos: 17 }),
  partida(7, { compId: 'seed-04', col: 4, nivel: 8, ultima: 34, ouro: 9, aug: [AUG.rica, AUG.tres, AUG.pand], minutos: 30 }),
  partida(8, { compId: 'seed-24', col: 7, nivel: 8, ultima: 29, ouro: 26, aug: [AUG.pais, AUG.pilha, AUG.bolso], minutos: 26 }),
  partida(9, { compId: 'seed-01', col: 2, nivel: 7, ultima: 39, ouro: 3, tiers: reroll('seed-01'), aug: [AUG.pand, AUG.rica, AUG.pilha], minutos: 34 }),
  partida(10, { compId: 'seed-20', col: 1, nivel: 7, ultima: 41, ouro: 5, tiers: reroll('seed-20'), aug: [AUG.tres, AUG.rica, AUG.pais], minutos: 35 }),
];

const saida = `/*
 * Partidas FICTICIAS de exemplo para a pagina Pos-jogo (nada aqui e uma partida real; gerado por tools/gen-exemplo.js).
 * Aparecem so quando o helper local nao esta ligado. Nomes no estilo da API da Riot (TFT18_Ahri, TFT_Item_X).
 */
window.TFT_POSJOGO_EXEMPLO = ${JSON.stringify({ exemplo: true, versao: 1, partidas: lista }, null, 1)};
`;
fs.writeFileSync(path.join(__dirname, '../data/posjogo-exemplo.js'), saida);
console.log('partidas:', lista.length);
