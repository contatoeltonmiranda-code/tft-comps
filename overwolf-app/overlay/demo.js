(function () {
  // Previa no navegador: estados simulados passando pela mesma funcao pura (TFTRecommend). So roda fora do Overwolf.
  if (window.overwolf) return;
  const R = window.TFTRecommend;
  const seed = window.TFT_SEED;
  const catalog = window.TFT_CATALOG;
  const recipes = window.TFT_RECIPES;
  const u = (c, s) => ({ c, s: s || 1, i: [] });
  const DA = 'DA_Component_';

  const CENARIOS = [
    { nome: '1-2 · começo: 2 campeões, itens soltos', estado: { stage: '1-2', gold: 4, level: 2, board: [u('DA_18_Veigar'), u('DA_18_LeBlanc')], bench: [], itens: [DA + 'BFSword', DA + 'ChainVest'] } },
    { nome: '1-4 · Sabugueiro: 5 campeões, 1 item pronto', estado: { stage: '1-4', gold: 11, level: 4, board: [u('DA_18_Ornn'), u('DA_18_Hecarim'), u('DA_18_Xayah')], bench: [u('DA_18_Ezreal'), u('DA_18_Azir')], itens: ['DA_Deathblade', DA + 'NeedlesslyLargeRod', DA + 'NeedlesslyLargeRod'] } },
    { nome: '1-3 · poucos campeões, muito ouro', estado: { stage: '1-3', gold: 18, level: 3, board: [u('DA_18_Leona')], bench: [u('DA_18_Diana')], itens: [] } },
    { nome: '1-1 · sem nada ainda', estado: { stage: '1-1', gold: 0, level: 1, board: [], bench: [], itens: [] } },
    { nome: '1-4 · comp de 9 unidades (teste de largura)', estado: { stage: '1-4', gold: 9, level: 4, board: ((seed.find((x) => x.id === 'seed-15') || { main: [] }).main.slice(0, 4)).map((x) => u(x.c)), bench: [], itens: [] } },
    { nome: '2-1 · escolha de aprimoramento (overlay some)', estado: { stage: '2-1', gold: 20, level: 4, board: [u('DA_18_Ornn')], bench: [], itens: [] } },
    { nome: '2-3 · depois do 2-1 (encerrado)', estado: { stage: '2-3', gold: 30, level: 5, board: [u('DA_18_Ornn')], bench: [], itens: [] } },
  ];
  window.TFT_DEMO_CENARIOS = CENARIOS;

  document.body.classList.add('preview');
  document.getElementById('demo').hidden = false;
  const sel = document.getElementById('cenario');
  CENARIOS.forEach((c, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = c.nome;
    sel.appendChild(o);
  });
  const desenhar = () => {
    const c = CENARIOS[Number(sel.value)] || CENARIOS[0];
    window.TFTOverlay.renderRecomendacoes(R.recommend(c.estado, seed, catalog, recipes), c.estado);
  };
  sel.addEventListener('change', desenhar);
  const pedido = Number(new URLSearchParams(location.search).get('cenario'));
  if (Number.isInteger(pedido) && CENARIOS[pedido]) sel.value = String(pedido);
  desenhar();
})();
