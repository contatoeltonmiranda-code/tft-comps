(function (root) {
  const PJ = typeof require === 'function' && typeof module !== 'undefined' ? require('./posjogo-logic.js') : root.TFTPosjogo;
  // Plano pre-jogo: 3 comps para a proxima partida + estrategia padrao com linha do tempo. Estatico: so recebe comps salvas,
  // noticias do patch e historico do pos-jogo; nunca recebe nada da partida em andamento (politica da Riot para TFT).
  // Os textos do guia sao copias exatas de data/estrategia-padrao.md (tests/plano-logic.test.js confere palavra por palavra).

  const PADRAO = {
    id: 'fast8',
    nome: 'Fast 8 padrão',
    trecho: 'Não sabe o que jogar? Fast 8: 6 no 3-2 com 30–32, 8 no 4-2 com ~40, rola até 20–30.',
    ref: 'Estratégia padrão, seção 6 (Resumo de bolso, item 1)',
  };

  const CHECKPOINTS = [
    {
      marco: '2-1',
      acao: 'UPAR 4 ou FICAR 3',
      regra: 'SE upgrade + itens úteis + aprimoramento de força → UPAR 4 e buscar win streak. SENÃO → FICAR 3, loss streak (abertura da Estratégia 3).',
      troque: { se: 'Só pares, sem itens úteis, sem aprimoramento de combate', entao: 'Estratégia 3 (Open Fort) até o 3-1. Aprimoramento de economia não é requisito: é o sinal mais forte.' },
    },
    {
      marco: 'Fim do 2',
      acao: 'Scout',
      regra: 'Componentes na mão. Veja os boards e comece a se comprometer.',
      troque: { se: 'SE no fim do estágio 2 tem 4+ cópias de custo 1 (itens BIS) ou 2+ de custo 2 (itens BIS ou slamáveis que poupem vida), sem contest → Estratégia 2.', derivada: true },
    },
    {
      marco: '3-2',
      acao: 'UPAR 6',
      regra: 'SE ouro ≥ 30–32 → UPAR 6. SE ~20 e board bom → pode UPAR (a economia fica ruim). Comp definida aqui.',
      troque: { se: 'Indeciso no 3-2 = atrasado. Economia máxima e fast 8.' },
    },
    {
      marco: '4-1',
      acao: 'UPAR 7 + pré-level',
      regra: 'SE ainda no 6 → UPAR 7. Termine 2 XP abaixo do 8, SE não custar economia. Curva agressiva: UPAR 8 aqui.',
      troque: { se: 'SE 80+ de vida no 4-1 e aprimoramento de economia → pode virar Fast 9 (Estratégia 3B). (Set 18)', derivada: true },
    },
    {
      marco: '4-2',
      acao: 'UPAR 8 + ROLAR até 20–30',
      regra: 'SE ouro ≥ ~40 (com o pré-level do 4-1, os 2 XP grátis sobem você) (regra derivada do guia) → UPAR 8 e rolar atrás de 1 cópia do carry e do tanque. SENÃO → FICAR 7, GUARDAR e subir no 4-5.',
      derivada: true,
      troque: { se: 'SE vida em Atenção (30–40) no 4-1 → não adie o roll down para o 4-5.', derivada: true },
    },
  ];

  const PISOS = [
    'Ouro: nunca abaixo de 10. Pare em 14 ou 20, nunca em 10. Rolando no meio do jogo, pare em 32.',
    'Estágio 2 quase sem rolar. Late é a hora de gastar.',
  ];

  const OUTRAS_LINHAS = [
    { id: 'open-fort', nome: 'Open Fort', texto: '2-1 fraco (só pares, sem itens úteis) → Open Fort até o 3-1. Aprimoramento de economia reforça.' },
    { id: 'reroll', nome: 'Reroll', texto: 'Muitas cópias baratas cedo e sem contest → Reroll: custo 1 no 4 (3-1), custo 2 no 6, custo 3 no 7.' },
    { id: 'fast9', nome: 'Fast 9', texto: '80+ de vida no 4-1 e aprimoramento de economia → Fast 9, nível 9 no 5-1. (Set 18)' },
  ];

  const NOTA_REROLL = 'Decida no 2-1 e confirme no fim do estágio 2 (2-5 a 2-7), com scout feito.';
  const ROTULO_LINHA = { fast8: 'Fast 8', fast9: 'Fast 9', reroll: 'Reroll' };

  const PESO_PATCH = [1, 0.5]; // patch mais novo, depois o anterior
  const CAP_PATCH = 3;
  const PRIOR_N = 3;
  const PRIOR_MEDIA = 4.5;
  const GANHO_HISTORICO = 1.5;
  const LISTA_MAX = 1.5;
  const LISTA_PASSO = 0.1;

  const lista = (v) => (Array.isArray(v) ? v : []);
  const r2 = (n) => Math.round(n * 100) / 100;
  const virgula = (n) => String(r2(n)).replace('.', ',');

  function tipoDaComp(estilo) {
    if (/slow|reroll/i.test(estilo || '')) return 'reroll';
    if (/fast\s*(9|10)|n[ií]vel\s*(9|10)/i.test(estilo || '')) return 'fast9';
    return 'fast8';
  }

  function patchesRecentes(noticias) {
    const partes = (p) => String(p).split('.').map(Number);
    const unicos = [...new Set(lista(noticias).map((n) => n && n.patch).filter((p) => typeof p === 'string' && /^\d+(\.\d+)*$/.test(p)))];
    unicos.sort((a, b) => {
      const x = partes(a);
      const y = partes(b);
      for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (y[i] || 0) - (x[i] || 0);
        if (d) return d;
      }
      return 0;
    });
    return unicos.slice(0, PESO_PATCH.length);
  }

  // Quantos campeoes da comp (board final) tem cada traco.
  function tracosDaComp(comp, champById) {
    const cont = new Map();
    const vistos = new Set();
    lista(comp.main).forEach((u) => {
      if (!u || vistos.has(u.c)) return;
      vistos.add(u.c);
      const ch = champById.get(u.c);
      if (ch) lista(ch.t).forEach((t) => cont.set(t, (cont.get(t) || 0) + 1));
    });
    return cont;
  }

  function efeitosPatch(comp, noticias, patches, champById) {
    const idsComp = new Set(lista(comp.main).map((u) => u && u.c));
    const tracos = tracosDaComp(comp, champById);
    let soma = 0;
    const achados = [];
    lista(noticias).forEach((n) => {
      const w = PESO_PATCH[patches.indexOf(n && n.patch)];
      if (w == null || (n.tipo !== 'buff' && n.tipo !== 'nerf')) return;
      const sinal = n.tipo === 'buff' ? 1 : -1;
      lista(n.alvos).forEach((a) => {
        if (!a) return;
        const bate = (a.tipo === 'campeao' && idsComp.has(a.id)) || (a.tipo === 'traco' && (tracos.get(a.id) || 0) >= 3);
        if (!bate) return;
        soma += sinal * w;
        achados.push({ patch: n.patch, tipo: n.tipo, nome: a.nome, traco: a.tipo === 'traco' });
      });
    });
    return { pontos: Math.max(-CAP_PATCH, Math.min(CAP_PATCH, soma)), achados };
  }

  function textoPatch(achados) {
    const porPatch = new Map();
    achados.forEach((a) => {
      const k = `${a.patch}|${a.tipo}`;
      if (!porPatch.has(k)) porPatch.set(k, []);
      porPatch.get(k).push(a.traco ? `traço ${a.nome}` : a.nome);
    });
    return [...porPatch.entries()].map(([k, nomes]) => {
      const [patch, tipo] = k.split('|');
      return `${tipo === 'buff' ? 'Buff' : 'Nerf'} no patch ${patch}: ${[...new Set(nomes)].join(', ')}`;
    });
  }

  // O historico do plano so usa Ranqueada+Normal: evento tem regras proprias e pve nao e partida de verdade.
  const regulares = (analises, overrides) => lista(analises).filter((a) => a && a.partida && PJ.entraNasEstatisticas(a.partida, { overrides }));

  function historicoPorComp(analises) {
    const mapa = new Map();
    lista(analises).forEach((a) => {
      if (!a || !a.comp || !a.partida || !a.partida.eu) return;
      if (!mapa.has(a.comp.id)) mapa.set(a.comp.id, []);
      mapa.get(a.comp.id).push(a.partida.eu.colocacao);
    });
    return mapa;
  }

  function pontosHistorico(cols) {
    if (!cols || !cols.length) return 0;
    const media = cols.reduce((s, x) => s + x, 0) / cols.length;
    const encolhida = (cols.length * media + PRIOR_N * PRIOR_MEDIA) / (cols.length + PRIOR_N);
    return (PRIOR_MEDIA - encolhida) * GANHO_HISTORICO;
  }

  function notasEstrategia(primeira, analises) {
    const notas = [];
    if (primeira && primeira.tipo === 'reroll') {
      notas.push({ tipo: 'reroll', texto: `${primeira.nome} (comp 1) é de reroll. Só siga essa linha se, no fim do estágio 2, as cópias estiverem na mão e ninguém jogar a comp. Senão, Fast 8. ${NOTA_REROLL}`, trecho: NOTA_REROLL });
    }
    if (primeira && primeira.tipo === 'fast9') {
      notas.push({ tipo: 'fast9', texto: `${primeira.nome} (comp 1) costuma ser Fast 9. A linha só vale se, no 4-1, houver 80+ de vida e aprimoramento de economia; antes disso o caminho é o Fast 8.`, trecho: OUTRAS_LINHAS[2].texto });
    }
    const por = new Map();
    lista(analises).forEach((a) => {
      if (!a || !a.estilo || !ROTULO_LINHA[a.estilo.id] || !a.partida) return;
      if (!por.has(a.estilo.id)) por.set(a.estilo.id, []);
      por.get(a.estilo.id).push(a.partida.eu.colocacao);
    });
    const top4 = (id) => (por.get(id) || []).filter((c) => c <= 4).length / Math.max(1, (por.get(id) || []).length);
    const base = por.get('fast8') || [];
    if (base.length >= 3) {
      ['reroll', 'fast9'].forEach((id) => {
        const outra = por.get(id) || [];
        if (outra.length >= 3 && top4(id) - top4('fast8') >= 0.2) {
          notas.push({
            tipo: 'historico',
            texto: `Seu histórico: ${ROTULO_LINHA[id]} deu top 4 em ${Math.round(top4(id) * 100)}% (${outra.length} partidas) contra ${Math.round(top4('fast8') * 100)}% do Fast 8 (${base.length}). Vale pensar nessa linha quando o 2-1 e o fim do estágio 2 deixarem. É a sua estatística, não uma regra do guia.`,
          });
        }
      });
    }
    return notas;
  }

  function montarPlano({ comps, noticias, analises: todas, catalog, tamanho, overrides }) {
    const analises = regulares(todas, overrides);
    const n = Number.isInteger(tamanho) && tamanho > 0 ? tamanho : 3;
    const champById = new Map(lista(catalog && catalog.champs).map((c) => [c.id, c]));
    const patches = patchesRecentes(noticias);
    const hist = historicoPorComp(analises);
    const pontuacao = lista(comps).map((comp, pos) => {
      const patch = efeitosPatch(comp, noticias, patches, champById);
      const cols = hist.get(comp.id) || [];
      const historico = pontosHistorico(cols);
      const posicao = Math.max(0, LISTA_MAX - LISTA_PASSO * pos);
      return { id: comp.id, pos, patch: r2(patch.pontos), historico: r2(historico), lista: r2(posicao), total: r2(patch.pontos + historico + posicao), _p: patch, _cols: cols };
    });
    const ordenadas = pontuacao.slice().sort((a, b) => b.total - a.total || a.pos - b.pos).slice(0, n);
    const porId = new Map(lista(comps).map((c) => [c.id, c]));
    const sugeridas = ordenadas.map((p, i) => {
      const comp = porId.get(p.id);
      const tipo = tipoDaComp(comp.estilo);
      const motivos = [];
      if (p._cols.length) {
        const media = p._cols.reduce((s, x) => s + x, 0) / p._cols.length;
        const top = Math.round((p._cols.filter((c) => c <= 4).length / p._cols.length) * 100);
        motivos.push({ tipo: 'historico', texto: `Você jogou ${p._cols.length} ${p._cols.length === 1 ? 'partida' : 'partidas'} com essa comp: média ${virgula(media)}º, top 4 em ${top}%.` });
      } else {
        motivos.push({ tipo: 'historico', texto: 'Sem partidas suas com essa comp ainda; o histórico não pesa.' });
      }
      textoPatch(p._p.achados).forEach((t) => motivos.push({ tipo: 'patch', texto: t }));
      if (!p._p.achados.length && patches.length) motivos.push({ tipo: 'patch', texto: `Nada de buff ou nerf nas notas ${patches.join(' e ')} mexe nessa comp.` });
      if (p.pos < 5) motivos.push({ tipo: 'lista', texto: `Está na posição ${p.pos + 1} da sua lista de comps.` });
      motivos.push({ tipo: 'estilo', texto: `Estilo ${comp.estilo || 'não informado'}: linha de ${ROTULO_LINHA[tipo]}.` });
      return { id: comp.id, nome: comp.nome, estilo: comp.estilo || '', tipo, posicao: i + 1, total: p.total, motivos };
    });
    return {
      comps: sugeridas,
      pontuacao: pontuacao.map(({ id, patch, historico, lista: l, total }) => ({ id, patch, historico, lista: l, total })),
      estrategia: Object.assign({}, PADRAO, { notas: notasEstrategia(sugeridas[0], analises) }),
      fontes: { partidas: lista(analises).length, patches },
    };
  }

  const api = { montarPlano, patchesRecentes, tipoDaComp, historicoPorComp, CHECKPOINTS, PISOS, OUTRAS_LINHAS, PADRAO };
  root.TFTPlano = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
