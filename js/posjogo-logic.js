(function (root) {
  // Analise pos-jogo: partida da API oficial da Riot (ja reduzida ao jogador) -> comp parecida, estilo, "onde pode ter errado".
  // Puro: sem DOM, sem rede. So usa o que a tft-match-v1 entrega; o que ela nao entrega vem listado em `naoSabe`, nunca inventado.
  const Rec = typeof require === 'function' && typeof module !== 'undefined' ? require('./recommend.js') : root.TFTRecommend;

  // Cada achado cita um trecho do data/estrategia-padrao.md (tests/posjogo-logic.test.js confere palavra por palavra).
  const REGRAS = {
    'ouro-parado': { href: 'estrategia.html#leitura-de-jogo-padronizada', ref: 'Estratégia padrão, seção 5 (Quando quebrar o padrão)', trecho: 'Late game, morrendo → abaixo de 10 de ouro é permitido.' },
    'nivel-baixo-tarde': { href: 'estrategia.html#resumo-de-bolso', ref: 'Estratégia padrão, seção 6 (Resumo de bolso, item 1)', trecho: 'Não sabe o que jogar? Fast 8: 6 no 3-2 com 30–32, 8 no 4-2 com ~40, rola até 20–30.' },
    'caiu-antes-do-4-1': { href: 'estrategia.html#resumo-de-bolso', ref: 'Estratégia padrão, seção 6 (Resumo de bolso, item 9)', trecho: 'Indeciso no 3-2 = atrasado. Economia máxima e fast 8.' },
    'poucos-itens': { href: 'estrategia.html#estrategia-1-fast-8-padrao', ref: 'Estratégia padrão, seção 2 (Erros comuns, item 3)', trecho: 'Comprar custo 3 ou 4 que não entra (sem itens, sem traço).' },
    'sem-comp': { href: 'estrategia.html#estrategia-1-fast-8-padrao', ref: 'Estratégia padrão, seção 2 (Quando escolher)', trecho: 'Comp final de custo 4, ou nenhuma comp clara.' },
  };

  const FILAS = { 1090: 'Normal', 1100: 'Ranqueada', 1130: 'Hyper Roll', 1160: 'Double Up', 1220: 'Desafios da Horuja', 1230: 'Chonccosuras ou Travessuras' };
  // So Normal e Ranqueada contam como jogo regular; todo o resto (modos especiais, eventos, fila nova que ainda nao conhecemos) e "evento".
  const FILAS_REGULARES = [1090, 1100];
  function nomeFila(id) {
    if (typeof id !== 'number' || !Number.isFinite(id)) return '';
    return FILAS[id] || `Fila ${id}`;
  }
  // Sem fila no registro nao ha como saber: nao tratamos como evento.
  const ehEvento = (id) => typeof id === 'number' && Number.isFinite(id) && !FILAS_REGULARES.includes(id);
  // ---- Evento por monstros no tabuleiro
  // As 10 unidades neutras da selva (Krugue, Lobo, Cascalho, Dragao Ancião...) SAO unidades normais do Set 18 (traço Fera do Rift,
  // estao no catalogo com custo), entao uma, duas ou ate 6 delas sao comp valida na Ranqueada. Um tabuleiro com 7 ou mais e raro
  // fora do evento e foi o que as partidas de evento na fila 1100 confirmadas pelo usuario tinham (7 de 8 e 8 de 8).
  // A API da Riot nao manda marcador de evento; isto e estimativa: o usuario corrige pelo botao (override).
  const MIN_MONSTROS_EVENTO = 7;
  const MONSTROS_CHAVES = ['gromp', 'murkwolf', 'sentry', 'cinderling', 'scuttlecrab', 'krug', 'sentinel', 'brambleback', 'elderdragon', 'crimsonraptor'];
  const ehMonstro = (id) => {
    const k = normId(id);
    return !!k && MONSTROS_CHAVES.some((m) => k === m || (k.startsWith(m) && /^(ap|ad)?$/.test(k.slice(m.length))));
  };
  // Aceita o registro cru (unidades[].id) e o resolvido (unidades[].c).
  function contarMonstros(partida) {
    const us = partida && partida.eu && Array.isArray(partida.eu.unidades) ? partida.eu.unidades : [];
    return us.filter((u) => u && ehMonstro(u.id || u.c || '')).length;
  }

  // Override manual: { matchId: 'evento' | 'regular' }. Vence a deteccao automatica. Mesmo localStorage no Pos-jogo e no Plano.
  const CHAVE_OVERRIDE = 'tft-comps:posjogo-override:v1';
  const MAX_OVERRIDES = 500;
  const VALORES_OVERRIDE = ['evento', 'regular'];
  const ID_OVERRIDE = /^[A-Za-z0-9_-]{3,40}$/;
  function lerOverrides(raw) {
    let o = null;
    try { o = typeof raw === 'string' ? JSON.parse(raw) : null; } catch (e) { o = null; }
    const out = {};
    if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
    Object.keys(o).forEach((k) => {
      if (Object.keys(out).length < MAX_OVERRIDES && ID_OVERRIDE.test(k) && VALORES_OVERRIDE.includes(o[k])) out[k] = o[k];
    });
    return out;
  }
  // Nao muta; valor null desfaz. Acima do limite descarta as entradas mais antigas (ordem de insercao).
  function definirOverride(mapa, id, valor) {
    const base = Object.assign({}, mapa);
    if (typeof id !== 'string' || !ID_OVERRIDE.test(id)) return base;
    if (valor === null) { delete base[id]; return base; }
    if (!VALORES_OVERRIDE.includes(valor)) return base;
    delete base[id];
    base[id] = valor;
    const chaves = Object.keys(base);
    chaves.slice(0, Math.max(0, chaves.length - MAX_OVERRIDES)).forEach((k) => { delete base[k]; });
    return base;
  }

  // motivo: 'manual-evento' | 'manual-regular' | 'fila' | 'monstros' | null
  function statusEvento(partida, overrides) {
    const monstros = contarMonstros(partida);
    const v = partida && overrides && typeof partida.id === 'string' && Object.prototype.hasOwnProperty.call(overrides, partida.id) ? overrides[partida.id] : null;
    if (v === 'evento') return { evento: true, motivo: 'manual-evento', monstros };
    if (v === 'regular') return { evento: false, motivo: 'manual-regular', monstros };
    if (partida && ehEvento(partida.fila)) return { evento: true, motivo: 'fila', monstros };
    if (monstros >= MIN_MONSTROS_EVENTO) return { evento: true, motivo: 'monstros', monstros };
    return { evento: false, motivo: null, monstros };
  }
  const ehEventoPartida = (partida, overrides) => statusEvento(partida, overrides).evento;
  const ROTULOS_MOTIVO = { fila: 'fila do evento', monstros: 'monstros no tabuleiro', 'manual-evento': 'marcado por você', 'manual-regular': 'marcado por você' };
  const rotuloMotivo = (m) => ROTULOS_MOTIVO[m] || '';

  // Partida contra o computador (tipo pve) nunca entra nas estatisticas; evento so quando pedido.
  // opcoes.overrides: marcacoes manuais do usuario (ver statusEvento).
  function entraNasEstatisticas(partida, opcoes) {
    if (!partida || partida.tipo === 'pve') return false;
    return !ehEventoPartida(partida, opcoes && opcoes.overrides) || !!(opcoes && opcoes.incluirEvento);
  }
  const ESTILOS = {
    reroll: 'Reroll (3★ barato)',
    fast9: 'Fast 9',
    fast8: 'Fast 8',
    'nivel-baixo': 'Nível baixo no fim',
    'caiu-cedo': 'Caiu cedo',
    indefinido: 'Indefinido',
  };
  const NAO_SABE = [
    'Ouro a cada rodada e quando você rolou: a API só dá o ouro que sobrou ao ser eliminado.',
    'Quantas rolagens, quando subiu de nível e quanto XP comprou.',
    'Vida a cada rodada: só a colocação final.',
    'Scout e contest: quem mais jogava a sua comp.',
    'Aprimoramentos escolhidos: a API da Riot (tft-match-v1) não envia esse campo, nem nas partidas ranqueadas do Set 18.',
    'Itens no banco, itens que você montou e desmontou, e o que a loja ofereceu.',
    'Posicionamento no tabuleiro e como cada combate foi.',
  ];

  const lista = (v) => (Array.isArray(v) ? v : []);
  const num = (v, min, max) => {
    const n = typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) && n >= min && n <= max ? Math.trunc(n) : null;
  };
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

  // ------------------------------------------------------------ ids
  function normId(s) {
    if (typeof s !== 'string') return '';
    return s
      .toLowerCase()
      .replace(/^tft\d*_item_/, '')
      .replace(/^tft\d*_/, '')
      .replace(/^da_/, '')
      .replace(/^item_(?=artifact)/, '')
      .replace(/[^a-z]/g, '');
  }

  function indexar(catalog) {
    const mk = (arr) => {
      const m = new Map();
      lista(arr).forEach((x) => {
        const k = normId(x.id);
        if (k && !m.has(k)) m.set(k, x.id);
      });
      return m;
    };
    return {
      champs: mk(catalog && catalog.champs),
      items: mk(catalog && catalog.items),
      traits: mk(catalog && catalog.traits),
      traitById: new Map(lista(catalog && catalog.traits).map((t) => [t.id, t])),
      champById: new Map(lista(catalog && catalog.champs).map((c) => [c.id, c])),
      itemById: new Map(lista(catalog && catalog.items).map((i) => [i.id, i])),
    };
  }

  const MIN_PREFIXO = 4;
  function mapearId(raw, mapa) {
    const k = normId(raw);
    if (!k) return null;
    if (mapa.has(k)) return mapa.get(k);
    if (k.length < MIN_PREFIXO) return null;
    const achados = [];
    mapa.forEach((id, nk) => {
      if (nk.startsWith(k) || (nk.length >= MIN_PREFIXO && k.startsWith(nk))) achados.push(id);
    });
    return achados.length === 1 ? achados[0] : null;
  }

  // ------------------------------------------------------------ rodadas
  // Estagio 1 tem 4 rodadas e os seguintes 7 (como no Painel). A Riot nao explica a contagem de last_round: tratar como estimativa.
  function ordemRodada(stage) {
    const m = typeof stage === 'string' ? /^(\d{1,2})-(\d{1,2})$/.exec(stage.trim()) : null;
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a < 1 || b < 1) return null;
    return a === 1 ? b : 4 + 7 * (a - 2) + b;
  }

  function rodadaEstimada(n) {
    if (!Number.isInteger(n) || n < 1 || n > 60) return null;
    if (n <= 4) return `1-${n}`;
    const m = n - 5;
    return `${2 + Math.floor(m / 7)}-${(m % 7) + 1}`;
  }

  // ------------------------------------------------------------ entrada: API -> registro local reduzido
  const ID_PARTIDA = /^[A-Za-z0-9_-]{3,40}$/;

  function normalizarPartida(raw, puuid) {
    if (!raw || typeof raw !== 'object' || typeof puuid !== 'string' || !puuid) return null;
    const meta = raw.metadata || {};
    const info = raw.info || {};
    const id = str(meta.match_id, 40);
    if (!ID_PARTIDA.test(id)) return null;
    const eu = lista(info.participants).find((p) => p && p.puuid === puuid);
    if (!eu) return null;
    const colocacao = num(eu.placement, 1, 8);
    if (!colocacao) return null;
    return {
      id,
      quando: num(info.game_datetime, 1, 9e15),
      duracao: num(Math.round(Number(info.game_length)), 0, 20000),
      versao: str(info.game_version, 80),
      fila: num(info.queue_id, 0, 99999),
      tipo: str(info.tft_game_type, 30),
      set: num(info.tft_set_number, 0, 999),
      eu: {
        colocacao,
        nivel: num(eu.level, 1, 10),
        ultimaRodada: num(eu.last_round, 1, 200),
        ouroRestante: num(eu.gold_left, 0, 9999),
        eliminados: num(eu.players_eliminated, 0, 7),
        dano: num(eu.total_damage_to_players, 0, 99999),
        augments: lista(eu.augments).filter((a) => typeof a === 'string').slice(0, 8).map((a) => a.slice(0, 80)),
        tracos: lista(eu.traits)
          .filter((t) => t && typeof t.name === 'string')
          .slice(0, 30)
          .map((t) => ({ id: t.name.slice(0, 80), unidades: num(t.num_units, 0, 99), estilo: num(t.style, 0, 4), atual: num(t.tier_current, 0, 9), total: num(t.tier_total, 0, 9) })),
        unidades: lista(eu.units)
          .filter((u) => u && typeof u.character_id === 'string')
          .slice(0, 14)
          .map((u) => ({
            id: u.character_id.slice(0, 80),
            tier: num(u.tier, 1, 4) || 1,
            itens: lista(u.itemNames).filter((i) => typeof i === 'string').slice(0, 3).map((i) => i.slice(0, 80)),
          })),
      },
    };
  }

  // Validacao do que vem de fora (servidor local, arquivo importado, localStorage): nada e confiavel.
  function sanitizarRegistro(p) {
    if (!p || typeof p !== 'object' || !ID_PARTIDA.test(str(p.id, 40)) || !p.eu || typeof p.eu !== 'object') return null;
    const colocacao = num(p.eu.colocacao, 1, 8);
    if (!colocacao) return null;
    const o = p.eu;
    return {
      id: p.id,
      quando: num(p.quando, 1, 9e15),
      duracao: num(p.duracao, 0, 20000),
      versao: str(p.versao, 80),
      fila: num(p.fila, 0, 99999),
      tipo: str(p.tipo, 30),
      set: num(p.set, 0, 999),
      eu: {
        colocacao,
        nivel: num(o.nivel, 1, 10),
        ultimaRodada: num(o.ultimaRodada, 1, 200),
        ouroRestante: num(o.ouroRestante, 0, 9999),
        eliminados: num(o.eliminados, 0, 7),
        dano: num(o.dano, 0, 99999),
        augments: lista(o.augments).filter((a) => typeof a === 'string').slice(0, 8).map((a) => a.slice(0, 80)),
        tracos: lista(o.tracos)
          .filter((t) => t && typeof t.id === 'string')
          .slice(0, 30)
          .map((t) => ({ id: t.id.slice(0, 80), unidades: num(t.unidades, 0, 99), estilo: num(t.estilo, 0, 4), atual: num(t.atual, 0, 9), total: num(t.total, 0, 9) })),
        unidades: lista(o.unidades)
          .filter((u) => u && typeof u.id === 'string')
          .slice(0, 14)
          .map((u) => ({ id: u.id.slice(0, 80), tier: num(u.tier, 1, 4) || 1, itens: lista(u.itens).filter((i) => typeof i === 'string').slice(0, 3).map((i) => i.slice(0, 80)) })),
      },
    };
  }

  const MAX_PARTIDAS = 300;
  function sanitizarPartidas(data) {
    const entrada = data && typeof data === 'object' ? lista(data.partidas) : [];
    const vistos = new Set();
    const partidas = [];
    let descartadas = 0;
    entrada.forEach((p) => {
      const r = sanitizarRegistro(p);
      if (!r || vistos.has(r.id)) {
        if (!r) descartadas += 1;
        return;
      }
      vistos.add(r.id);
      partidas.push(r);
    });
    partidas.sort((a, b) => (b.quando || 0) - (a.quando || 0));
    return { partidas: partidas.slice(0, MAX_PARTIDAS), descartadas };
  }

  // ------------------------------------------------------------ resolver ids para o catalogo
  function legivel(raw) {
    return raw
      .replace(/^TFT\d*_(?:Augment_|Item_)?/, '')
      .replace(/^DA_(?:\d+_)?/, '')
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function resolver(p, catalog) {
    const idx = indexar(catalog);
    let naoMapeados = 0;
    const unidades = p.eu.unidades.map((u) => {
      const c = mapearId(u.id, idx.champs);
      const champ = c ? idx.champById.get(c) : null;
      if (!c) naoMapeados += 1;
      const itens = u.itens.map((raw) => {
        const id = mapearId(raw, idx.items);
        const it = id ? idx.itemById.get(id) : null;
        if (!id) naoMapeados += 1;
        return { id, n: it ? it.n : legivel(raw), raw };
      });
      return { c, nome: champ ? champ.n : legivel(u.id), custo: champ ? champ.c : null, tier: u.tier, itens, img: champ ? champ.img : null };
    });
    const tracosAtivos = p.eu.tracos
      .filter((t) => t.estilo > 0)
      .map((t) => {
        const id = mapearId(t.id, idx.traits);
        const tr = id ? idx.traitById.get(id) : null;
        return { id, nome: tr ? tr.n : legivel(t.id), unidades: t.unidades, estilo: t.estilo, img: tr ? tr.img || null : null };
      })
      .sort((a, b) => b.estilo - a.estilo || b.unidades - a.unidades);
    const eu = Object.assign({}, p.eu, {
      unidades,
      tracosAtivos,
      rodada: rodadaEstimada(p.eu.ultimaRodada),
      aprimoramentos: p.eu.augments.map(legivel),
    });
    return Object.assign({}, p, { eu, naoMapeados });
  }

  // ------------------------------------------------------------ comps nossas
  function compativeis(r, comps, catalog, recipes) {
    const board = r.eu.unidades.filter((u) => u.c).map((u) => ({ c: u.c, s: u.tier, i: u.itens.filter((i) => i.id).map((i) => i.id) }));
    const estado = { stage: '5-1', gold: 999, level: 10, board, bench: [], itens: [] };
    const pesoC = Rec.PESOS.campeoes;
    const pesoI = Rec.PESOS.itens;
    return lista(comps)
      .map((comp, ordem) => {
        const x = Rec.pontuarComp(comp, estado, catalog, recipes);
        const total = new Set(lista(comp.main).map((u) => u && u.c).filter(Boolean)).size;
        const base = x.partes.itens == null ? x.partes.campeoes : (pesoC * x.partes.campeoes + pesoI * x.partes.itens) / (pesoC + pesoI);
        return {
          id: comp.id,
          nome: comp.nome,
          estilo: comp.estilo || '',
          sim: Math.round(base * 100),
          tem: x.tem.length,
          total,
          reconhecida: x.tem.length >= Math.max(2, Math.ceil(total * 0.6)),
          ordem,
        };
      })
      .sort((a, b) => b.sim - a.sim || a.ordem - b.ordem);
  }

  // ------------------------------------------------------------ estilo e achados
  function estiloDe(r) {
    const eu = r.eu;
    const barato3 = eu.unidades.filter((u) => u.tier >= 3 && u.custo != null && u.custo <= 3);
    const rodadaOrd = ordemRodada(eu.rodada || '');
    if (barato3.length >= 2 || (barato3.length === 1 && (eu.nivel == null || eu.nivel <= 7))) {
      return { id: 'reroll', porque: `${barato3.length} unidade(s) de 3★ com custo até 3 (${barato3.map((u) => u.nome).join(', ')}): padrão de reroll ou slow roll.` };
    }
    if (eu.nivel == null) return { id: 'indefinido', porque: 'A API não trouxe o nível final.' };
    if (eu.nivel >= 9) return { id: 'fast9', porque: `Terminou no nível ${eu.nivel}: Fast 9, ou Fast 8 que chegou ao 9. A API não diz quando subiu.` };
    if (eu.nivel === 8) return { id: 'fast8', porque: 'Terminou no nível 8, sem 3★ barato: curva do Fast 8.' };
    if (rodadaOrd != null && rodadaOrd < ordemRodada('4-1')) return { id: 'caiu-cedo', porque: `Eliminado em ≈${eu.rodada}, antes de a curva padrão chegar ao 7 ou 8.` };
    return { id: 'nivel-baixo', porque: `Terminou no nível ${eu.nivel} em ≈${eu.rodada}: reroll sem fechar 3★ ou atraso de nível.` };
  }

  function achadosDe(r, ranking, estilo) {
    const eu = r.eu;
    const out = [];
    const ord = ordemRodada(eu.rodada || '');
    const add = (id, gravidade, texto) => out.push({ id, gravidade, texto, regra: REGRAS[id] });
    if (eu.ouroRestante != null && eu.ouroRestante >= 20 && eu.colocacao >= 5) {
      add('ouro-parado', 'aviso', `Eliminado em ${eu.colocacao}º com ${eu.ouroRestante} de ouro sobrando. O guia só libera ir abaixo de 10 quando você está morrendo: esse ouro não virou board.`);
    }
    if (ord != null && ord < ordemRodada('4-1')) {
      add('caiu-antes-do-4-1', 'aviso', `Eliminado em ≈${eu.rodada}, antes do 4-1. A decisão estava entre o 2-1 e o 3-2: o guia manda tratar indeciso no 3-2 como atrasado.`);
    } else if (ord != null && ord >= ordemRodada('4-5') && eu.nivel != null && eu.nivel <= 7 && eu.colocacao >= 5) {
      const reroll = estilo.id === 'reroll';
      add('nivel-baixo-tarde', 'aviso', `Eliminado em ${eu.colocacao}º, em ≈${eu.rodada}, no nível ${eu.nivel}. ${reroll ? 'O board tem 3★ barato: se foi reroll de propósito, ele não fechou a tempo e o guia manda sair upando quando a comp está pronta.' : 'A curva padrão pede o 8 no 4-2 (ou 4-5).'} Não dá para saber se faltou ouro, se a vida forçou ou se foi escolha.`);
    }
    const melhor = ranking[0];
    if (ranking.length && !melhor.reconhecida) {
      add('sem-comp', 'info', `Nenhuma das suas comps salvas aparece no board final (a mais perto, ${melhor.nome}, tem ${melhor.tem} de ${melhor.total} campeões). Jogar fora do repertório não é erro, mas sem comp clara o risco é chegar indeciso ao 3-2.`);
    }
    const itensEquipados = eu.unidades.reduce((s, u) => s + u.itens.length, 0);
    if (eu.nivel != null && eu.nivel >= 8 && itensEquipados <= 3) {
      add('poucos-itens', 'info', `Só ${itensEquipados} item(ns) equipado(s) no board final. A API não mostra o banco de itens: podem ter sobrado componentes guardados ou o board ficou sem item.`);
    }
    return out;
  }

  function avisosDe(r) {
    const av = [];
    if (r.eu.rodada) av.push(`A rodada (≈${r.eu.rodada}) é estimada a partir de last_round, contando 4 rodadas no estágio 1 e 7 nos demais. Confira com o que você lembra da partida.`);
    if (r.eu.nivel == null) av.push('A API não trouxe um nível válido para esta partida.');
    if (r.naoMapeados) av.push(`${r.naoMapeados} campeão(ões)/item(ns) não foram achados no catálogo do Set 18 e aparecem pelo nome da API.`);
    if (r.set != null && r.set !== 18) av.push(`Partida do Set ${r.set}: as comps salvas são do Set 18, então a comparação não vale.`);
    return av;
  }

  function analisar(partida, dados) {
    const r = resolver(partida, dados.catalog);
    const ranking = compativeis(r, dados.comps, dados.catalog, dados.recipes);
    const estilo = estiloDe(r);
    const melhor = ranking[0] && ranking[0].reconhecida ? ranking[0] : null;
    return {
      partida: r,
      ranking: ranking.slice(0, 3),
      comp: melhor,
      maisPerto: ranking[0] || null,
      estilo,
      achados: achadosDe(r, ranking, estilo),
      naoSabe: NAO_SABE.slice(),
      avisos: avisosDe(r),
    };
  }

  // ------------------------------------------------------------ estatisticas
  const media = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null);
  const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);

  function resumo(analises) {
    const col = analises.map((a) => a.partida.eu.colocacao);
    return { n: col.length, media: media(col), top4: pct(col.filter((c) => c <= 4).length, col.length), vitorias: pct(col.filter((c) => c === 1).length, col.length) };
  }

  function agrupar(analises, chave, nome) {
    const mapa = new Map();
    analises.forEach((a) => {
      const k = chave(a);
      if (!k) return;
      if (!mapa.has(k)) mapa.set(k, { id: k, nome: nome(a), itens: [] });
      mapa.get(k).itens.push(a);
    });
    return [...mapa.values()]
      .map((g) => Object.assign({ id: g.id, nome: g.nome }, resumo(g.itens)))
      .sort((a, b) => b.n - a.n || a.media - b.media);
  }

  function estatisticas(entrada, ultimasN, opcoes) {
    const analises = entrada.filter((a) => entraNasEstatisticas(a.partida, opcoes)).sort((a, b) => (b.partida.quando || 0) - (a.partida.quando || 0));
    const base = resumo(analises);
    const nUlt = Math.max(1, ultimasN || 10);
    const ult = resumo(analises.slice(0, nUlt));
    return {
      total: base.n,
      media: base.media,
      top4: base.top4,
      vitorias: base.vitorias,
      ultimas: { n: ult.n, media: ult.media, top4: ult.top4 },
      porComp: agrupar(analises, (a) => (a.comp ? a.comp.id : null), (a) => a.comp.nome),
      porEstilo: agrupar(analises, (a) => a.estilo.id, (a) => ESTILOS[a.estilo.id] || a.estilo.id),
    };
  }

  const api = {
    REGRAS, ESTILOS, FILAS, FILAS_REGULARES, nomeFila, ehEvento, MIN_MONSTROS_EVENTO, contarMonstros, statusEvento, ehEventoPartida, rotuloMotivo, CHAVE_OVERRIDE, lerOverrides, definirOverride, entraNasEstatisticas, NAO_SABE, normId, indexar, mapearId, ordemRodada, rodadaEstimada, normalizarPartida,
    sanitizarPartidas, sanitizarRegistro, resolver, compativeis, estiloDe, analisar, estatisticas, legivel,
  };
  root.TFTPosjogo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
