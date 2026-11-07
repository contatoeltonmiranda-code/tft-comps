(function (root) {
  // Pontuacao pura: estado normalizado + comps do seed -> top comps. Sem DOM, sem rede, sem Overwolf.
  // Nunca recebe nem devolve dados de aprimoramentos (politica Riot para TFT).
  const LIMITE = { a: 2, b: 1 }; // 2-1: primeira escolha de aprimoramento
  const PESOS = { campeoes: 0.6, itens: 0.25, economia: 0.15 };
  const CREDITO_UNIDADE = { estrela1: 0.75, duasCopias: 0.9, estrela2: 1 };
  const CREDITO_ITEM = { pronto: 1, montavel: 0.85, parcial: 0.35 };
  // Maior custo de campeao que aparece na loja por nivel (odds padrao do TFT; conferir se o set mudar).
  const CUSTO_MAX_POR_NIVEL = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 4 };
  const CUSTO_MAX_NIVEL_ALTO = 5;
  const FLEX_PESO = 0.5;

  function parseStage(stage) {
    const m = typeof stage === 'string' ? /^(\d{1,2})-(\d{1,2})$/.exec(stage.trim()) : null;
    return m ? { a: Number(m[1]), b: Number(m[2]) } : null;
  }

  function fase(stage) {
    const s = parseStage(stage);
    if (!s) return 'desconhecido';
    if (s.a < LIMITE.a || (s.a === LIMITE.a && s.b < LIMITE.b)) return 'ativo';
    if (s.a === LIMITE.a && s.b === LIMITE.b) return 'aprimoramento';
    return 'encerrado';
  }

  const cacheIdx = new WeakMap();
  function indexar(catalog) {
    if (cacheIdx.has(catalog)) return cacheIdx.get(catalog);
    const idx = {
      champs: new Map((catalog.champs || []).map((c) => [c.id, c])),
      items: new Map((catalog.items || []).map((i) => [i.id, i])),
    };
    cacheIdx.set(catalog, idx);
    return idx;
  }

  function lista(v) {
    return Array.isArray(v) ? v : [];
  }

  function unidadesDoEstado(estado) {
    return lista(estado.board).concat(lista(estado.bench)).filter((u) => u && typeof u.c === 'string');
  }

  function creditoUnidade(copias, estrelas) {
    if (estrelas >= 2) return CREDITO_UNIDADE.estrela2;
    return copias >= 2 ? CREDITO_UNIDADE.duasCopias : CREDITO_UNIDADE.estrela1;
  }

  function resumoCampeoes(estado) {
    const por = new Map();
    unidadesDoEstado(estado).forEach((u) => {
      const e = por.get(u.c) || { copias: 0, estrelas: 1 };
      e.copias += 1;
      e.estrelas = Math.max(e.estrelas, Number(u.s) || 1);
      por.set(u.c, e);
    });
    return por;
  }

  // Inventario de itens: banco de itens + itens equipados (itens equipados podem ser retirados da unidade).
  function inventario(estado) {
    const inv = new Map();
    const soma = (id) => {
      if (typeof id === 'string' && id) inv.set(id, (inv.get(id) || 0) + 1);
    };
    lista(estado.itens).forEach(soma);
    unidadesDoEstado(estado).forEach((u) => lista(u.i).forEach(soma));
    return inv;
  }

  function consome(inv, id) {
    const n = inv.get(id) || 0;
    if (n <= 0) return false;
    inv.set(id, n - 1);
    return true;
  }

  function avaliarItens(alvos, estado, recipes) {
    const receitas = (recipes && recipes.receitas) || {};
    const inv = inventario(estado);
    const out = { prontos: [], montaveis: [], parciais: [], faltando: [] };
    const falta = {};
    let restantes = alvos.slice();
    restantes = restantes.filter((id) => {
      if (!consome(inv, id)) return true;
      out.prontos.push(id);
      return false;
    });
    restantes = restantes.filter((id) => {
      const [a, b] = receitas[id];
      const tem = a === b ? (inv.get(a) || 0) >= 2 : (inv.get(a) || 0) >= 1 && (inv.get(b) || 0) >= 1;
      if (!tem) return true;
      consome(inv, a);
      consome(inv, b);
      out.montaveis.push(id);
      return false;
    });
    restantes.forEach((id) => {
      const [a, b] = receitas[id];
      const temA = consome(inv, a);
      const temB = !temA && consome(inv, b);
      if (temA || temB) {
        out.parciais.push(id);
        falta[id] = [temA ? b : a];
      } else {
        out.faltando.push(id);
        falta[id] = [a, b];
      }
    });
    const total = alvos.length;
    const soma = out.prontos.length * CREDITO_ITEM.pronto + out.montaveis.length * CREDITO_ITEM.montavel + out.parciais.length * CREDITO_ITEM.parcial;
    return { out, valor: total ? soma / total : null, falta };
  }

  function custoMax(level) {
    const n = Math.max(1, Math.floor(Number(level) || 1));
    return CUSTO_MAX_POR_NIVEL[n] || CUSTO_MAX_NIVEL_ALTO;
  }

  // opcoes.unidades: ids de campeoes a usar no eixo "campeoes" no lugar do board final (fases inicio/meio do painel).
  function pontuarComp(comp, estado, catalog, recipes, opcoes) {
    const idx = indexar(catalog);
    const donos = resumoCampeoes(estado);
    const receitas = (recipes && recipes.receitas) || {};
    const doFase = opcoes && Array.isArray(opcoes.unidades) ? opcoes.unidades : null;
    const unidades = doFase
      ? doFase.map((c) => ({ u: { c }, peso: 1 }))
      : lista(comp.main).map((u) => ({ u, peso: 1 })).concat(lista(comp.flex).map((u) => ({ u, peso: FLEX_PESO })));
    const validas = unidades.filter(({ u }) => u && idx.champs.has(u.c));

    let pesoTotal = 0;
    let pesoGanho = 0;
    const tem = [];
    const faltam = [];
    const nivelMax = custoMax(estado.level);
    validas.forEach(({ u, peso }) => {
      pesoTotal += peso;
      const dono = donos.get(u.c);
      if (dono) {
        pesoGanho += peso * creditoUnidade(dono.copias, dono.estrelas);
        if (peso === 1 && !tem.includes(u.c)) tem.push(u.c);
      } else if (peso === 1 && !faltam.some((f) => f.c === u.c)) {
        const custo = idx.champs.get(u.c).c;
        faltam.push({ c: u.c, custo, alcancavel: custo <= nivelMax });
      }
    });
    const campeoes = pesoTotal ? pesoGanho / pesoTotal : 0;

    const alvos = [];
    lista(comp.main).forEach((u) => lista(u && u.i).forEach((id) => { if (receitas[id]) alvos.push(id); }));
    const itensAval = avaliarItens(alvos, estado, recipes);

    let economia = 1;
    if (faltam.length) {
      const alcance = faltam.filter((f) => f.alcancavel).length / faltam.length;
      const custoTotal = faltam.reduce((s, f) => s + f.custo, 0);
      const ouro = Math.min(1, Math.max(0, Number(estado.gold) || 0) / custoTotal);
      economia = 0.5 * alcance + 0.5 * ouro;
    }

    const partes = { campeoes, itens: itensAval.valor, economia };
    let somaPesos = 0;
    let soma = 0;
    Object.keys(PESOS).forEach((k) => {
      if (partes[k] == null) return;
      somaPesos += PESOS[k];
      soma += PESOS[k] * partes[k];
    });
    const score = Math.round((soma / somaPesos) * 100);

    const nomeItem = (id) => (idx.items.get(id) || {}).n || id;
    const nomeChamp = (id) => idx.champs.get(id).n;
    const motivos = [`Tem ${tem.length}/${validas.filter((x) => x.peso === 1).length} campeões`];
    if (faltam.length) {
      const prox = faltam.slice().sort((a, b) => Number(b.alcancavel) - Number(a.alcancavel) || a.custo - b.custo).slice(0, 3);
      motivos.push('Falta ' + prox.map((f) => `${nomeChamp(f.c)} (custo ${f.custo})`).join(', '));
    }
    const o = itensAval.out;
    if (o.prontos.length) motivos.push('Item pronto: ' + [...new Set(o.prontos)].map(nomeItem).join(', '));
    if (o.montaveis.length) motivos.push('Dá para montar: ' + [...new Set(o.montaveis)].map(nomeItem).join(', '));

    return {
      id: comp.id,
      nome: comp.nome,
      score,
      partes,
      tem,
      faltam,
      itens: o,
      faltaItens: itensAval.falta,
      motivos,
    };
  }

  function recommend(estado, seed, catalog, recipes, opcoes) {
    const n = (opcoes && opcoes.top) || 3;
    if (!estado || typeof estado !== 'object') return { fase: 'desconhecido', top: [], semDados: true };
    const f = fase(estado.stage);
    const semDados = unidadesDoEstado(estado).length === 0;
    if (f !== 'ativo') return { fase: f, top: [], semDados };
    const ranked = lista(seed)
      .filter((c) => c && typeof c === 'object')
      .map((comp, ordem) => ({ r: pontuarComp(comp, estado, catalog, recipes), ordem }))
      .sort((a, b) => b.r.score - a.r.score || a.ordem - b.ordem)
      .slice(0, n)
      .map((x) => x.r);
    return { fase: f, top: ranked, semDados };
  }

  const api = { parseStage, fase, recommend, pontuarComp, PESOS, CUSTO_MAX_POR_NIVEL };
  root.TFTRecommend = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
