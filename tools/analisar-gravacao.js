// Analise POS-JOGO de uma gravacao da sonda GEP (overwolf-app grava em Documentos\tft-comps-sonda\gep-*.json).
// Reproduz o estado ao fim de cada rodada e mostra quais comps do seed encaixavam. Nada ao vivo.
// Uso: node tools/analisar-gravacao.js <gep-AAAA.json>
const fs = require('fs');
const path = require('path');
const { acumular, normalizar } = require('../js/gep-map.js');
const { recommend } = require('../js/recommend.js');

function analisar(doc, catalog, seed, recipes) {
  const entradas = doc && Array.isArray(doc.entradas) ? doc.entradas : [];
  const pontos = [];
  const desconhecidos = [];
  const vistos = new Set();
  let snap = {};
  let stageAtual = null;

  const fechar = () => {
    if (!stageAtual) return;
    const n = normalizar(snap, catalog, recipes);
    n.desconhecidos.forEach((d) => {
      if (!vistos.has(d.bruto)) {
        vistos.add(d.bruto);
        desconhecidos.push(d);
      }
    });
    const estado = Object.assign({}, n.estado, { stage: stageAtual });
    pontos.push({ stage: stageAtual, estado, resultado: recommend(estado, seed, catalog, recipes) });
  };

  entradas.forEach((e) => {
    if (!e || e.tipo !== 'info') return;
    if (e.feature === 'match_info' && e.key === 'round_type') {
      const novo = acumular({}, { feature: e.feature, key: e.key, value: e.value }).match_info.round_type;
      const stage = novo && typeof novo.stage === 'string' ? novo.stage : null;
      if (stage && stage !== stageAtual) {
        fechar();
        stageAtual = stage;
      }
    }
    snap = acumular(snap, e);
  });
  fechar();
  return { pontos, desconhecidos };
}

function formatar(res, catalog) {
  const nome = new Map(catalog.champs.map((c) => [c.id, c.n]));
  const linhas = [];
  res.pontos.forEach((p) => {
    const e = p.estado;
    const cab = `${p.stage}  ouro ${e.gold}  nível ${e.level}  banco+tabuleiro ${e.board.length + e.bench.length}`;
    if (!p.resultado.top.length) {
      linhas.push(`${cab}  (sem recomendação: ${p.resultado.fase})`);
      return;
    }
    linhas.push(cab);
    p.resultado.top.forEach((r, i) => linhas.push(`   ${i + 1}. ${r.nome} - ${r.score}/100 (${r.tem.map((id) => nome.get(id) || id).join(', ') || 'nenhum campeão'})`));
  });
  if (res.desconhecidos.length) {
    linhas.push('', 'IDs que o catálogo não conhece (conferir o mapeamento):');
    res.desconhecidos.forEach((d) => linhas.push(`   ${d.tipo}: ${d.bruto}`));
  }
  return linhas.join('\n');
}

module.exports = { analisar, formatar };

if (require.main === module) {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('Uso: node tools/analisar-gravacao.js <gep-AAAA.json>');
    process.exit(1);
  }
  global.window = {};
  ['catalog', 'seed', 'recipes'].forEach((n) => require(path.join('..', 'data', n + '.js')));
  const { TFT_CATALOG, TFT_SEED, TFT_RECIPES } = global.window;
  const doc = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  console.log(formatar(analisar(doc, TFT_CATALOG, TFT_SEED, TFT_RECIPES), TFT_CATALOG));
}
