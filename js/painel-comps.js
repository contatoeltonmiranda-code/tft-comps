(function (root) {
  // Ranking de comps e viabilidade de "forcar comp" para o Painel manual. Puro: sem DOM, sem rede.
  // Reusa a pontuacao de js/recommend.js (campeoes 60%, itens 25%, ouro/nivel 15%) sobre as fases inicio/meio/fim.
  const Rec = typeof require === 'function' && typeof module !== 'undefined' ? require('./recommend.js') : root.TFTRecommend;
  const Pn = () => (typeof require === 'function' && typeof module !== 'undefined' ? require('./painel-logic.js') : root.TFTPainel);
  const Logic = () => (typeof require === 'function' && typeof module !== 'undefined' ? require('./logic.js') : root.TFTLogic);

  const ORD_3_2 = 13; // 3-2
  const ORD_3_5 = 16; // 3-5
  const ORD_5_1 = 26; // 5-1

  function lista(v) {
    return Array.isArray(v) ? v : [];
  }

  function faseDaRodada(stage) {
    const o = Pn().ordRodada(stage);
    if (o == null || o < 12) return 'inicio'; // ate 2-7
    if (o < ORD_5_1) return 'meio'; // 3-1 a 4-7
    return 'fim';
  }

  // Copias digitadas -> unidades do motor: 3 copias = 1 unidade de 2 estrelas; 9 = 3 estrelas.
  function estadoParaRecommend(estado, catalog) {
    const ids = new Set(lista(catalog && catalog.champs).map((c) => c.id));
    const board = [];
    Object.keys(estado.champs || {}).forEach((id) => {
      if (!ids.has(id)) return;
      let n = estado.champs[id];
      if (!(n > 0)) return;
      if (n >= 9) {
        board.push({ c: id, s: 3, i: [] });
        n -= 9;
      } else if (n >= 3) {
        board.push({ c: id, s: 2, i: [] });
        n -= 3;
      }
      for (let k = 0; k < n; k++) board.push({ c: id, s: 1, i: [] });
    });
    const itens = [];
    Object.keys(estado.comps || {}).forEach((id) => {
      for (let k = 0; k < estado.comps[id]; k++) itens.push(id);
    });
    return { stage: estado.stage, gold: estado.gold, level: estado.level, board, bench: [], itens };
  }

  function unicos(ids) {
    return ids.filter((id, i) => ids.indexOf(id) === i);
  }

  function unidadesDaFase(comp, fase) {
    const f = comp.fases;
    if (fase === 'inicio' && f && lista(f.inicio).length) return unicos(f.inicio);
    if (fase === 'meio' && f && lista(f.meio).length) return unicos(f.meio);
    return unicos(lista(comp.main).map((u) => u && u.c).filter(Boolean));
  }

  function nomesComp(ids, recipes) {
    const comps = (recipes && recipes.componentes) || {};
    return ids.map((id) => ({ id, n: (comps[id] && comps[id].n) || id }));
  }

  const ORDEM_ITEM = { pronto: 0, montavel: 1, parcial: 2, falta: 3 };

  function statusItens(r, idxItems, recipes) {
    const nomeItem = (id) => (idxItems.get(id) || {}).n || id;
    const mapa = new Map();
    const soma = (id, estado, faltam) => {
      const k = id + '|' + estado;
      const e = mapa.get(k) || { id, n: nomeItem(id), estado, qtd: 0, faltam: nomesComp(faltam, recipes) };
      e.qtd += 1;
      mapa.set(k, e);
    };
    r.itens.prontos.forEach((id) => soma(id, 'pronto', []));
    r.itens.montaveis.forEach((id) => soma(id, 'montavel', []));
    r.itens.parciais.forEach((id) => soma(id, 'parcial', (r.faltaItens || {})[id] || []));
    r.itens.faltando.forEach((id) => soma(id, 'falta', (r.faltaItens || {})[id] || []));
    return [...mapa.values()].sort((a, b) => ORDEM_ITEM[a.estado] - ORDEM_ITEM[b.estado]);
  }

  function rankear(estado, dados) {
    const { seed, catalog, recipes } = dados;
    const fase = faseDaRodada(estado.stage);
    const rec = estadoParaRecommend(estado, catalog);
    const champs = new Map(lista(catalog.champs).map((c) => [c.id, c]));
    const idxItems = new Map(lista(catalog.items).map((i) => [i.id, i]));
    const vazio = !Object.keys(estado.champs || {}).length && !Object.keys(estado.comps || {}).length;
    const itens = lista(seed).map((comp, ordem) => {
      const unidadesFase = unidadesDaFase(comp, fase).filter((id) => champs.has(id));
      const r = Rec.pontuarComp(comp, rec, catalog, recipes, { unidades: unidadesFase });
      const fim = unidadesDaFase(comp, 'fim').filter((id) => champs.has(id));
      const temFim = fim.filter((id) => (estado.champs[id] || 0) > 0).length;
      const nomeChamp = (id) => champs.get(id).n;
      return {
        id: comp.id,
        nome: comp.nome,
        estilo: comp.estilo || '',
        ordem,
        score: r.score,
        partes: r.partes,
        unidadesFase,
        tem: r.tem,
        faltam: r.faltam.map((f) => Object.assign({ n: nomeChamp(f.c) }, f)),
        pares: unidadesFase.filter((id) => estado.champs[id] === 2).length,
        coberturaFase: unidadesFase.length ? r.tem.length / unidadesFase.length : 0,
        coberturaFim: { tem: temFim, total: fim.length },
        itensStatus: statusItens(r, idxItems, recipes),
        contest: (estado.contest && estado.contest[comp.id]) || 0,
        favorita: estado.favorita === comp.id,
      };
    });
    itens.sort((a, b) => b.score - a.score || a.ordem - b.ordem);
    return { fase, vazio, itens };
  }

  // ---- BIS: itens dos seeds para o campeao (o seed e a unica fonte; nada e inventado)
  function bisDoCampeao(champId, seed, recipes) {
    const receitas = (recipes && recipes.receitas) || {};
    const out = [];
    lista(seed).forEach((comp) => {
      lista(comp.main).forEach((u) => {
        if (!u || u.c !== champId) return;
        lista(u.i).forEach((id) => {
          if (receitas[id] && !out.includes(id)) out.push(id);
        });
      });
    });
    return out;
  }

  function bisAvaliacao(champId, estado, dados) {
    const bis = bisDoCampeao(champId, dados.seed, dados.recipes);
    if (!bis.length) return { estado: 'desconhecido', bis, montaveis: [] };
    const receitas = dados.recipes.receitas;
    const tem = (id) => (estado.comps && estado.comps[id]) || 0;
    const montaveis = bis.filter((id) => {
      if (tem(id) > 0) return true;
      const [a, b] = receitas[id];
      return a === b ? tem(a) >= 2 : tem(a) >= 1 && tem(b) >= 1;
    });
    return { estado: montaveis.length ? 'ok' : 'falta', bis, montaveis };
  }

  // ---- Slamaveis: itens completos que os componentes na mao montam agora (qualquer receita, nao so os BIS dos seeds).
  // "Slamavel" e a leitura do painel para "BIS ou slamaveis que poupem vida" (regra pn-slamavel).
  function itensSlamaveis(estado, dados) {
    const receitas = (dados.recipes && dados.recipes.receitas) || {};
    const tem = (id) => (estado.comps && estado.comps[id]) || 0;
    return Object.keys(receitas).filter((id) => {
      const [a, b] = receitas[id];
      return a === b ? tem(a) >= 2 : tem(a) >= 1 && tem(b) >= 1;
    });
  }

  // ---- Comps atuais do Elton: a lista salva pelo app de comps (editadas, novas, sem as excluidas), como o app a mostra.
  // `raw` e o texto do localStorage (ou null). Sem nada salvo ou com lixo, cai no seed. Nao grava nada.
  const STORAGE_KEY_COMPS = 'tft-comps:v1';
  function carregarComps(raw, seed, seedVersion, catalog) {
    let stored = null;
    if (typeof raw === 'string' && raw) {
      try { stored = JSON.parse(raw); } catch (e) { stored = null; }
    }
    return Logic().mergeSeed(stored, lista(seed), seedVersion, catalog).comps;
  }

  // ---- Forcar comp (criterios do guia onde existem; limiares de cobertura sao do painel e vem marcados)
  const SEV = { ok: 0, arriscado: 1, nao: 2 };
  const NOME_SEV = ['ok', 'arriscado', 'nao'];

  function tipoDaComp(estilo) {
    if (/slow|reroll/i.test(estilo)) return 'reroll';
    if (/fast\s*(9|10)|n[ií]vel\s*(9|10)/i.test(estilo)) return 'fast9';
    return 'fast8';
  }

  function avaliarForca(estado, dados, compId) {
    const id = compId || estado.favorita;
    const rank = rankear(estado, dados);
    const r = id ? rank.itens.find((x) => x.id === id) : null;
    if (!r) return { semComp: true };
    const P = Pn();
    const ord = P.ordRodada(estado.stage) || 1;
    const faixa = P.faixaVida(estado.hp);
    const tipo = tipoDaComp(r.estilo);
    const motivos = [];
    let sev = 0;
    const pesa = (n, texto, origem) => {
      motivos.push({ texto, origem, sev: n });
      if (n > sev) sev = n;
    };
    const c = r.contest;
    if (c >= 3) pesa(2, '3 ou mais jogadores na comp: troque de comp e mantenha o fast 8.', 'guia');
    else if (c === 2 && tipo === 'fast8') pesa(1, '2 jogadores na comp: role antes dos outros (3-7 ou 4-1) ou tenha plano B.', 'guia');
    else if (c === 2) pesa(2, 'Reroll e Fast 9 com 2 jogadores na comp: saia.', 'derivada');
    else if (c === 1 && tipo !== 'fast8') pesa(1, '1 jogador na comp já pesa em reroll e Fast 9.', 'guia');
    else if (c === 1) pesa(0, '1 jogador na comp: o fast 8 segue.', 'guia');

    if (faixa === 'critica') {
      if (r.coberturaFase < 0.5) pesa(2, 'Vida crítica e menos da metade da comp: agir já e estabilizar, não forçar.', 'painel');
      else pesa(1, 'Vida crítica: gaste para estabilizar antes de forçar.', 'guia');
    } else if (faixa === 'atencao') {
      pesa(1, 'Vida em atenção: margem curta, antecipe o spike que já estava no plano.', 'guia');
    }

    const cob = r.coberturaFase;
    if (ord >= ORD_5_1) {
      if (cob < 0.5) pesa(2, 'Estágio 5+ com menos da metade do board final.', 'painel');
      else if (cob < 0.7) pesa(1, 'Estágio 5+ com menos de 70% do board final.', 'painel');
    } else if (ord >= ORD_3_2) {
      if (cob < 0.25) pesa(2, 'Depois do 3-2 sem base da comp (indeciso no 3-2 é atrasado).', 'painel');
      else if (cob < 0.5) pesa(1, 'Menos da metade das unidades da fase.', 'painel');
    }

    const valorItens = r.partes.itens;
    if (ord >= ORD_3_5 && valorItens != null && valorItens < 0.35) pesa(1, 'Quase sem componentes para os itens da comp.', 'painel');

    if (!motivos.length || motivos.every((m) => m.sev === 0)) {
      motivos.push({ texto: ord < ORD_3_2 ? 'Estágio 2: ainda dá para escolher; sem contest e com vida segura.' : 'Base da comp, itens e vida sem alerta.', origem: 'painel', sev: 0 });
    }

    const unidades = r.faltam
      .slice()
      .sort((a, b) => Number(b.alcancavel) - Number(a.alcancavel) || a.custo - b.custo)
      .slice(0, 4)
      .map((f) => ({ id: f.c, n: f.n, custo: f.custo, alcancavel: f.alcancavel }));
    const componentes = [];
    r.itensStatus.filter((i) => i.estado === 'parcial' || i.estado === 'falta').forEach((i) => {
      i.faltam.forEach((cmp) => {
        if (!componentes.some((x) => x.id === cmp.id)) componentes.push({ id: cmp.id, n: cmp.n, para: i.n });
      });
    });
    return {
      compId: r.id,
      nome: r.nome,
      tipo,
      veredito: NOME_SEV[sev],
      motivos,
      buscar: { unidades, componentes: componentes.slice(0, 4) },
      cobertura: r.coberturaFase,
      contest: c,
    };
  }

  const api = { faseDaRodada, estadoParaRecommend, rankear, bisDoCampeao, bisAvaliacao, itensSlamaveis, carregarComps, STORAGE_KEY_COMPS, avaliarForca, tipoDaComp, SEV };
  root.TFTPainelComps = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
