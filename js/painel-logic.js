(function (root) {
  const dep = (nome, arquivo) => (typeof module !== 'undefined' && module.exports ? require(arquivo) : root[nome]);
  const Regras = () => dep('TFTPainelRegras', './painel-regras.js');
  const Comps = () => dep('TFTPainelComps', './painel-comps.js');
  // Painel de decisao MANUAL: o jogador digita o estado, nada aqui le o jogo.
  // Modulo puro (sem DOM, sem rede). Regras de data/estrategia-padrao.md; cada regra carrega referencia ao trecho.
  const VERSAO = 1;
  const STORAGE_KEY = 'tft-comps:painel:v1';
  const LIM = { hp: [0, 100], gold: [0, 999], level: [1, 10], streak: [-20, 20], copias: 27, componentes: 99, contest: 7, xp: 9999 };
  const APRIM = ['', 'eco', 'forca'];
  const BOARDS = ['auto', 'forte', 'medio', 'fraco'];
  const JUROS_MAX = 5;

  const RODADAS = [];
  for (let a = 1; a <= 7; a++) for (let b = 1; b <= (a === 1 ? 4 : 7); b++) RODADAS.push(`${a}-${b}`);

  function parseStage(stage) {
    const m = typeof stage === 'string' ? /^(\d)-(\d)$/.exec(stage.trim()) : null;
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a < 1 || a > 7 || b < 1 || b > (a === 1 ? 4 : 7)) return null;
    return { a, b };
  }

  function ordRodada(stage) {
    const s = parseStage(stage);
    if (!s) return null;
    return s.a === 1 ? s.b : 4 + (s.a - 2) * 7 + s.b;
  }

  function proximaRodada(stage) {
    const o = ordRodada(stage);
    if (o == null) return RODADAS[0];
    return RODADAS[Math.min(o, RODADAS.length - 1)];
  }

  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null);
  const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
  const okId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 60 && v !== '__proto__';

  function estadoInicial() {
    return {
      v: VERSAO, stage: '1-1', hp: 100, gold: 0, level: 1, streak: 0,
      xp: { atual: null, max: null }, aprim: '', board: 'auto',
      champs: {}, comps: {}, contest: {}, favorita: null,
    };
  }

  function mapaContagem(raw, validar, max) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach((id) => {
      if (!okId(id) || !validar(id)) return;
      const n = num(raw[id]);
      if (n == null || n < 1) return;
      out[id] = Math.min(max, n);
    });
    return out;
  }

  function sanitizarEstado(raw, catalog, recipes) {
    const base = estadoInicial();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
    const champIds = new Set(((catalog && catalog.champs) || []).map((c) => c.id));
    const e = base;
    if (parseStage(raw.stage)) e.stage = raw.stage.trim();
    [['hp', LIM.hp], ['gold', LIM.gold], ['level', LIM.level], ['streak', LIM.streak]].forEach(([k, lim]) => {
      const n = num(raw[k]);
      if (n != null) e[k] = clamp(n, lim);
    });
    const xp = raw.xp && typeof raw.xp === 'object' ? raw.xp : {};
    ['atual', 'max'].forEach((k) => {
      const n = num(xp[k]);
      e.xp[k] = n != null && n >= 0 ? Math.min(LIM.xp, n) : null;
    });
    if (APRIM.includes(raw.aprim)) e.aprim = raw.aprim;
    if (BOARDS.includes(raw.board)) e.board = raw.board;
    e.champs = mapaContagem(raw.champs, (id) => champIds.has(id), LIM.copias);
    const compIds = recipes && recipes.componentes ? new Set(Object.keys(recipes.componentes)) : null;
    e.comps = mapaContagem(raw.comps, (id) => !compIds || compIds.has(id), LIM.componentes);
    e.contest = mapaContagem(raw.contest, () => true, LIM.contest);
    e.favorita = okId(raw.favorita) ? raw.favorita : null;
    return e;
  }

  function juros(gold) {
    return Math.min(JUROS_MAX, Math.max(0, Math.floor((Number(gold) || 0) / 10)));
  }

  function degrau(gold) {
    const g = Math.max(0, Number(gold) || 0);
    const j = juros(g);
    if (j >= JUROS_MAX) return { juros: j, proximo: null, falta: 0 };
    const proximo = (j + 1) * 10;
    return { juros: j, proximo, falta: proximo - g };
  }

  // estrategia-padrao.md, secao 5, Passo 1 (faixas de vida)
  function faixaVida(hp) {
    const v = Number(hp);
    if (v >= 80) return 'folga';
    if (v >= 41) return 'segura';
    if (v >= 30) return 'atencao';
    return 'critica';
  }

  // estrategia-padrao.md, secao 5, Passo 2 (degraus de ouro)
  function leituraOuro(gold) {
    const g = Number(gold) || 0;
    if (g < 10) return { id: 'abaixo', texto: 'Abaixo do piso. Só no fim, morrendo.' };
    if (g < 14) return { id: 'armadilha', texto: 'Armadilha: 10 vira 16, que ainda dá só +1. Chegue a 14 antes de parar.' };
    if (g < 20) return { id: 'lenta', texto: 'Rota lenta: 14 vira 20; 32 em 3 rodadas.' };
    if (g < 32) return { id: 'rapida', texto: 'Rota rápida: 19–20 vira 32 em 2 rodadas.' };
    if (g < 50) return { id: 'meio', texto: 'Piso do meio do jogo: 32 vira 40, depois ~50. Pare de rolar aqui.' };
    return { id: 'maximo', texto: 'Juros no máximo. Só aqui o slow roll gasta o excedente.' };
  }

  // estrategia-padrao.md, secao 5, Passo 3 (streak)
  function bonusStreak(streak) {
    const n = Math.abs(Number(streak) || 0);
    if (n >= 6) return 3;
    if (n >= 5) return 2;
    if (n >= 2) return 1;
    return 0;
  }

  // Passo 4 (forca do board), derivado da streak; o jogador pode sobrescrever.
  function forcaBoard(estado) {
    if (BOARDS.includes(estado.board) && estado.board !== 'auto') return estado.board;
    const s = Number(estado.streak) || 0;
    if (s >= 2) return 'forte';
    if (s <= -2) return 'fraco';
    return 'medio';
  }

  // 1 copia = 1 estrela; 3 copias = 2 estrelas; 9 copias = 3 estrelas.
  function estrelasDe(copias) {
    if (copias >= 9) return 3;
    if (copias >= 3) return 2;
    return 1;
  }

  function resumoUnidades(estado, catalog) {
    const champs = new Map(((catalog && catalog.champs) || []).map((c) => [c.id, c]));
    const r = { total: 0, pares: 0, estrelas2: 0, estrelas3: 0, porCusto: {} };
    Object.keys(estado.champs || {}).forEach((id) => {
      const c = champs.get(id);
      const n = estado.champs[id];
      if (!c || !(n > 0)) return;
      r.total += n;
      const est = estrelasDe(n);
      if (n === 2) r.pares += 1;
      if (est === 2) r.estrelas2 += 1;
      if (est === 3) r.estrelas3 += 1;
      const pc = r.porCusto[c.c] || { unidades: 0, copias: 0, maxCopias: 0, id: null };
      pc.unidades += 1;
      pc.copias += n;
      if (n > pc.maxCopias) {
        pc.maxCopias = n;
        pc.id = id;
      }
      r.porCusto[c.c] = pc;
    });
    return r;
  }

  // =====================================================================================
  // Motor de decisao
  // =====================================================================================
  const O = (stage) => ordRodada(stage);
  const ORD = {
    r21: O('2-1'), r23: O('2-3'), r24: O('2-4'), r25: O('2-5'), r27: O('2-7'), r31: O('3-1'), r32: O('3-2'), r33: O('3-3'), r35: O('3-5'),
    r36: O('3-6'), r37: O('3-7'), r41: O('4-1'), r42: O('4-2'), r45: O('4-5'), r51: O('5-1'), r52: O('5-2'), r55: O('5-5'), r61: O('6-1'),
  };
  const LEITURA_OBRIGATORIA = [ORD.r21, ORD.r27, ORD.r32, ORD.r37, ORD.r41, ORD.r42];
  const PARES_MUITOS = 3; // "3+ pares" (3-2/3-5) usado tambem para o "muitos pares" do estagio 2
  const OURO_POR_ROLAGEM = 2; // Guia, glossario: "Rolar: pagar 2 de ouro"

  const fmtFaixa = (r) => (r.min === r.max ? String(r.min) : `${r.min}–${r.max}`);
  const R = (id) => Regras().regra(id);

  // Itens que as comps do seed usam e que os componentes na mao montam (ou que ja estao prontos).
  // opts.comp: so essa comp; opts.minCusto: so unidades desse custo para cima (carry/tanque de custo 4, custo 5 do Fast 9).
  function itensUteisDe(estado, dados, opts) {
    const receitas = (dados.recipes && dados.recipes.receitas) || {};
    const o = opts || {};
    const custo = new Map((((dados.catalog && dados.catalog.champs) || [])).map((x) => [x.id, x.c]));
    const alvos = new Set();
    (o.comp ? [o.comp] : dados.seed || []).forEach((comp) => (comp.main || []).forEach((u) => {
      if (o.minCusto && (custo.get(u && u.c) || 0) < o.minCusto) return;
      ((u && u.i) || []).forEach((id) => { if (receitas[id]) alvos.add(id); });
    }));
    const tem = (id) => (estado.comps && estado.comps[id]) || 0;
    for (const id of alvos) {
      if (tem(id) > 0) return o.detalhe ? { ok: true, sem: false } : true;
      const [a, b] = receitas[id];
      if (a === b ? tem(a) >= 2 : tem(a) >= 1 && tem(b) >= 1) return o.detalhe ? { ok: true, sem: false } : true;
    }
    return o.detalhe ? { ok: false, sem: alvos.size === 0 } : false;
  }

  // Degrau de ouro esperado em dia (14 -> 20 -> 32). Mapeamento por rodada e do painel (regra pn-degraus).
  function degrauEsperado(ord) {
    if (ord <= ORD.r24) return 14;
    if (ord <= ORD.r27) return 20;
    return 32;
  }

  // Ouro que sobra depois de subir ao nivel `nivel`. Sem XP informado assume o pre-level da curva (custo ~0) e marca exato:false.
  function ouroAposSubir(c, nivel) {
    if (c.level >= nivel) return { sobra: c.gold, exato: true };
    const { atual, max } = c.xp || {};
    if (c.level === nivel - 1 && atual != null && max != null && max > atual) return { sobra: c.gold - (max - atual), exato: true };
    return { sobra: c.gold, exato: false };
  }

  // ---------------------------------------------------------------- contexto
  function montarContexto(estado, dados) {
    const st = parseStage(estado.stage) || { a: 1, b: 1 };
    const ord = ordRodada(estado.stage) || 1;
    const res = resumoUnidades(estado, dados.catalog);
    const rank = Comps().rankear(estado, dados);
    const favorita = estado.favorita ? rank.itens.find((x) => x.id === estado.favorita) || null : null;
    const alvo = favorita || (rank.vazio ? null : rank.itens[0] || null);
    const faixa = faixaVida(estado.hp);
    const alvoSeed = alvo ? (dados.seed || []).find((s) => s.id === alvo.id) || null : null;
    const c = {
      estado, dados, a: st.a, b: st.b, ord, level: estado.level, gold: estado.gold, hp: estado.hp, faixa,
      valeFaixa: st.a >= 3, streak: estado.streak, xp: estado.xp, aprim: estado.aprim, board: forcaBoard(estado),
      res, pares: res.pares, upgrade: res.estrelas2 + res.estrelas3 > 0, itensUteis: itensUteisDe(estado, dados),
      slamaveis: Comps().itensSlamaveis(estado, dados), alvoSeed,
      rank, favorita, alvo, contestAlvo: alvo ? alvo.contest : 0,
    };
    c.sobra8 = ouroAposSubir(c, 8);
    c.reroll = candidatosReroll(c);
    return c;
  }

  const crit = (ok, texto, regra, mudar, letra, rotulo) => ({ ok, texto, regra, mudar, letra: letra || null, rotulo: rotulo || null });

  // ---------------------------------------------------------------- Reroll: candidatos e criterios (a)-(g) do "Melhor momento para seguir"
  const REROLL_MIN = { 1: 4, 2: 2, 3: 2 };
  const nJog = (n) => `${n} ${n === 1 ? 'jogador' : 'jogadores'}`;

  function criteriosRerollCusto(c, custo, cand) {
    const min = REROLL_MIN[custo];
    const pc = c.res.porCusto[custo];
    const copias = cand ? cand.copias : (pc && pc.maxCopias) || 0;
    const nome = cand ? cand.nome : null;
    const L = [];
    const add = (letra, ok, texto, regra, mudar, bloqueia) => L.push(Object.assign(crit(ok, texto, regra, mudar, letra), { bloqueia: !!bloqueia }));
    // (a) copias do carry
    const textoCopias = cand ? `${copias} ${copias === 1 ? 'cópia' : 'cópias'} de ${nome} (custo ${custo}; precisa ${min}+)` : `Cópias: custo 1 com ${(c.res.porCusto[1] && c.res.porCusto[1].maxCopias) || 0} (precisa 4+), custo 2 com ${(c.res.porCusto[2] && c.res.porCusto[2].maxCopias) || 0} (2+) ou custo 3 com ${(c.res.porCusto[3] && c.res.porCusto[3].maxCopias) || 0} (um par)`;
    add('a', copias >= min, textoCopias, custo === 3 ? 'rrm-a-c3' : 'rr-q-copias', 'juntar 4+ cópias de um campeão de custo 1, 2+ de custo 2 ou um par de custo 3', true);
    // (b) contest
    const cont = cand ? cand.contest : null;
    add('b', cont == null ? null : cont === 0, cont == null ? 'Contest: ninguém na comp do carry (sem carry ainda)' : cont === 0 ? 'Ninguém mais na comp do carry' : `${nJog(cont)} na comp do carry (qualquer contest pesa; máximo 0)`, 'rrm-b', 'sem nenhum jogador na comp do carry', true);
    // (c) itens
    if (custo === 3) {
      const tem = c.slamaveis.length > 0 || c.itensUteis;
      add('c', tem ? true : null, tem ? 'Itens para um board que vença (as fontes não exigem BIS)' : 'Sem itens montáveis ainda (as fontes não exigem BIS para o custo 3)', 'rrm-c', undefined, false);
    } else if (!cand) {
      add('c', null, 'Item BIS montável (custo 1) ou BIS/slamável (custo 2)', 'rr-q-itens', 'ter componentes para o item BIS do carry', true);
    } else {
      const bisOk = cand.bis.estado === 'ok';
      if (bisOk) add('c', true, `Item BIS de ${nome} montável com seus componentes`, 'rr-q-itens', undefined, true);
      else if (custo === 2 && c.slamaveis.length) add('c', true, `Itens slamáveis para poupar vida (${c.slamaveis.length}): ${nome} não tem BIS montável agora`, 'pn-slamavel', undefined, true);
      else if (custo === 2) add('c', false, cand.bis.estado === 'desconhecido' ? `Sem item BIS no seed para ${nome} e sem componentes para slamar` : `Item BIS de ${nome}: faltam componentes e não há item para slamar`, 'rr-q-itens', 'ter o item BIS do carry ou componentes que montem um item (slamável)', true);
      else add('c', cand.bis.estado === 'falta' ? false : null, cand.bis.estado === 'falta' ? `Item BIS de ${nome}: faltam componentes` : `Item BIS de ${nome}: sem item no seed, não dá para confirmar`, 'rr-q-itens', cand.bis.estado === 'falta' ? 'falta item BIS: junte os componentes do item do carry' : 'carry com item BIS conhecido no seed', true);
    }
    // (d) streak
    if (custo === 3) {
      const ok = c.streak >= 2 && c.board === 'forte';
      add('d', ok, ok ? `Win streak de ${c.streak} e board forte: precisa durar até o 4-2` : 'Sem win streak e board forte (a streak precisa durar até o 4-2)', 'rrm-d', 'win streak e board forte, que durem até o 4-2', true);
    } else if (c.ord <= ORD.r27) {
      const ok = c.streak <= -2 ? true : null;
      add('d', ok, ok ? `Loss streak do Open Fort no estágio 2 (${-c.streak} derrotas)` : 'Open Fort no estágio 2: loss streak (ainda sem derrotas seguidas)', 'rrm-d', undefined, false);
    } else {
      add('d', null, 'Loss streak só vale no estágio 2', 'rrm-d', undefined, false);
    }
    // (e) ouro
    if (custo === 1) {
      const ok = c.ord <= ORD.r31 ? (c.gold > 32 ? true : c.ord === ORD.r31 ? false : null) : (c.gold >= 50 ? true : null);
      add('e', ok, c.ord <= ORD.r31 ? `Ouro ${c.gold}: acima de 32 no 3-1 (você rola o que passa de 32)` : `Ouro ${c.gold}: guarde até 50 e role só o excedente`, 'rrm-e', 'passar de 32 de ouro no 3-1', false);
    } else if (custo === 2) {
      add('e', c.gold >= 50 ? true : null, `Ouro ${c.gold}: 50 no 3-2 para UPAR 6 já; senão, UPAR 6 no 3-5`, 'rrm-e', undefined, false);
    } else {
      const meta = c.ord >= ORD.r41 ? 50 : 30;
      const marco = c.ord >= ORD.r41 ? ORD.r41 : ORD.r32;
      add('e', c.gold >= meta ? true : c.ord >= marco ? false : null, `Ouro ${c.gold}: ${meta === 30 ? '30–32 no 3-2' : '50+ no 4-1 para o slow roll no 7'}`, 'rrm-e-c3', `${meta}+ de ouro ${meta === 30 ? 'no 3-2' : 'no 4-1'}`, false);
    }
    // (f) vida
    if (custo === 3) {
      add('f', c.hp >= 41, c.hp >= 41 ? `Vida ${c.hp} (Folga ou Segura), mantida pela win streak` : `Vida ${c.hp}: o custo 3 pede 41+ (Folga ou Segura)`, 'rrm-f', 'vida 41+ (Folga ou Segura)', c.valeFaixa);
    } else {
      add('f', c.hp > 40, c.hp > 40 ? `Vida ${c.hp}: acima de 40 no 4-1` : `Vida ${c.hp} em ${c.hp >= 30 ? 'Atenção' : 'Crítica'}: saia do slow roll e role para estabilizar`, 'rrm-f', 'chegar ao 4-1 acima de 40 de vida', false);
    }
    // (g) prazo e lobby
    const limite = custo === 3 ? ORD.r42 : ORD.r41;
    const prazoTxt = { 1: 'custo 1: 3★ até o 3-5 (limite 4-1)', 2: 'custo 2: hitar até o 3-5; última rolagem no 4-1', 3: 'custo 3: spike no fim do 4 ou começo do 5' }[custo];
    add('g', c.ord <= limite, c.ord <= limite ? `Dentro do prazo (${prazoTxt})` : `Fora do prazo (${prazoTxt})`, 'rrm-g', `estar até o ${custo === 3 ? '4-2' : '4-1'}`, true);
    return L;
  }

  // Reroll: custo 1 (4+ copias, BIS), custo 2 (2+, BIS ou slamavel), custo 3 (par, board forte, win streak ate o 4-2); sem contest.
  function candidatosReroll(c) {
    const out = [];
    [1, 2, 3].forEach((custo) => {
      const pc = c.res.porCusto[custo];
      if (!pc || pc.maxCopias < REROLL_MIN[custo]) return;
      const champId = pc.id;
      const bis = Comps().bisAvaliacao(champId, c.estado, c.dados);
      let contest = 0;
      (c.dados.seed || []).forEach((comp) => {
        if ((comp.main || []).some((u) => u && u.c === champId)) contest = Math.max(contest, (c.estado.contest && c.estado.contest[comp.id]) || 0);
      });
      const nome = ((c.dados.catalog.champs || []).find((x) => x.id === champId) || {}).n || champId;
      const cand = { custo, champId, nome, copias: pc.maxCopias, min: REROLL_MIN[custo], bis, contest };
      cand.crits = criteriosRerollCusto(c, custo, cand);
      cand.janela = cand.crits.find((x) => x.letra === 'g').ok === true;
      cand.ok = cand.crits.filter((x) => x.bloqueia).every((x) => x.ok === true) && (custo !== 3 || c.ord >= ORD.r21);
      out.push(cand);
    });
    return out;
  }

  // ---------------------------------------------------------------- estrategia
  const ROTULOS = {
    fast8: 'Fast 8 padrão',
    reroll: 'Reroll / slow roll',
    economia: 'Economia máxima',
  };
  const ROTULO_VARIANTE = {
    padrao: 'Fast 8 padrão',
    custo1: 'Reroll de custo 1',
    custo2: 'Reroll de custo 2',
    custo3: 'Reroll de custo 3',
    openfort: 'Economia máxima · Open Fort até o 3-1',
    antecipado: 'Economia máxima · Fast 8 antecipado (3A)',
    fast9: 'Economia máxima · Fast 9 (3B)',
  };

  // Open Fort: nenhum upgrade, nenhum item util, sem aprimoramento de combate (economia reforca, nao e requisito), board que nao e forte.
  function abreOpenFort(c) {
    const fraco = !c.upgrade && !c.itensUteis && c.aprim !== 'forca';
    return c.ord >= ORD.r21 && c.ord <= ORD.r31 && fraco && c.board !== 'forte' && (c.a === 2 || c.faixa === 'folga' || c.faixa === 'segura');
  }

  function escolherEstrategia(c) {
    const eco = c.aprim === 'eco';
    const rr = c.reroll.find((x) => x.ok);
    if (rr) return { id: 'reroll', variante: 'custo' + rr.custo, carry: rr };
    if (abreOpenFort(c)) return { id: 'economia', variante: 'openfort' };
    if (eco && c.ord >= ORD.r37 && c.ord <= ORD.r51) {
      // 3B: no 4-1 pede tambem 50+ de ouro; depois do 4-1 o plano ja esta em andamento
      if (c.ord >= ORD.r41 && c.hp >= 80 && c.contestAlvo === 0 && (c.ord > ORD.r41 || c.gold >= 50)) return { id: 'economia', variante: 'fast9' };
      // 3A: ~40+ sobrando depois de subir ao 8; contest maximo 2
      if (c.ord <= ORD.r41 && c.sobra8.sobra >= 40 && c.contestAlvo <= 2) return { id: 'economia', variante: 'antecipado' };
    }
    return { id: 'fast8', variante: 'padrao' };
  }

  // Fast 8: criterios (a)-(f) de "Melhor momento para seguir"
  function criteriosFast8(c) {
    const champs = c.dados.catalog.champs;
    const custo4 = c.alvoSeed ? (c.alvoSeed.main || []).some((u) => ((champs.find((x) => x.id === u.c) || {}).c || 0) >= 4) : true;
    const rrAlgum = c.reroll.some((x) => x.ok);
    const nomeAlvo = c.alvo ? c.alvo.nome : null;
    const L = [];
    // (a) vida
    const hp = c.hp;
    L.push(crit(hp >= 30, hp >= 41 ? `Vida ${hp} (${hp >= 80 ? 'Folga' : 'Segura'}): 41+ no 3-2` : hp >= 30 ? `Vida ${hp} em Atenção: ainda vale, mas o roll down é no 4-2, nunca no 4-5` : `Vida ${hp} em Crítica: estabilize antes (passo 7)`, 'f8m-a', `ter 41+ de vida (hoje ${hp})`, 'a', 'Vida'));
    // (b) ouro
    const g = c.gold;
    let okB;
    let txtB;
    if (g >= 30) { okB = true; txtB = `Ouro ${g}: 30–32 no 3-2 para o nível 6, com rota para ~40 no 4-2`; }
    else if (c.ord >= ORD.r42 && c.level >= 8) { okB = null; txtB = `Ouro ${g}: já no nível 8, o ouro agora é do roll down (20–30)`; }
    else if (c.ord < ORD.r32) { okB = null; txtB = `Ouro ${g}: a meta é 30–32 no 3-2 (rota 32 → 40 → ~50)`; }
    else if (g >= 20 && c.board !== 'fraco') { okB = true; txtB = `Ouro ${g} (~20) com board bom: dá para subir, mas a economia fica ruim`; }
    else { okB = false; txtB = `Ouro ${g}: abaixo de 30–32 no 3-2 (com ~20 só se o board for bom)`; }
    L.push(crit(okB, txtB, 'f8m-b', 'chegar a 30–32 de ouro no 3-2', 'b', 'Ouro'));
    // (c) streak ou economia
    const win = c.streak >= 2;
    const eco = c.aprim === 'eco';
    const deg = g >= degrauEsperado(c.ord);
    const okC = win || eco || deg;
    const motivos = [win ? `win streak (${c.streak})` : null, eco ? 'aprimoramento de economia' : null, deg ? `degraus de ouro em dia (${g})` : null].filter(Boolean);
    L.push(crit(okC, okC ? `Tem ${motivos.join(', ')}` : 'Sem win streak, sem aprimoramento de economia e com os degraus de ouro atrasados (14 → 20 → 32)', okC && !win && !eco ? 'pn-degraus' : 'f8m-c', 'win streak, aprimoramento de economia ou degraus de ouro em dia', 'c', 'Streak ou economia'));
    // (d) unidades
    const okD = custo4 && !rrAlgum;
    const pares = c.pares >= PARES_MUITOS ? ` · ${c.pares} pares: 2–3 rolagens por rodada no 3-2 ou 3-5` : '';
    L.push(crit(okD, rrAlgum ? 'Há condições de reroll (Estratégia 2): o Fast 8 não é a linha' : !custo4 ? `${nomeAlvo || 'A comp'}: comp final sem custo 4` : (nomeAlvo ? `Comp final de custo 4+ (${nomeAlvo}), sem as condições de reroll${pares}` : `Nenhuma comp clara ainda (Fast 8 é o padrão)${pares}`), 'f8m-d', rrAlgum ? 'não ter as condições de reroll' : 'ter uma comp final de custo 4', 'd', 'Unidades'));
    // (e) contest
    const n = c.contestAlvo;
    L.push(crit(n <= 2, n <= 1 ? `Contest ${n}: dentro do ideal (até 1 jogador na comp)` : n === 2 ? '2 jogadores na comp: no limite. UPAR 8 e ROLAR no 3-7 ou 4-1, antes de todos' : `${n} jogadores na comp: troque de comp, não de linha`, 'f8m-e', 'no máximo 2 jogadores na comp (ideal até 1)', 'e', 'Contest'));
    // (f) itens
    const it = c.alvoSeed ? itensUteisDe(c.estado, c.dados, { comp: c.alvoSeed, minCusto: 4, detalhe: true }) : { ok: c.itensUteis, sem: false };
    const okF = it.ok;
    L.push(crit(okF, okF ? `Componentes para os itens do carry ou do tanque de custo 4${nomeAlvo ? ` (${nomeAlvo})` : ''} (não exige BIS)` : it.sem ? 'Seed sem itens para o carry/tanque de custo 4 da comp: não dá para confirmar' : 'Sem componentes para os itens do carry ou do tanque de custo 4 (não exige BIS)', 'f8m-f', 'componentes que sirvam ao carry ou ao tanque de custo 4', 'f', 'Itens'));
    if (c.a === 2) L.push(crit(c.upgrade && c.itensUteis, 'Upgrade e itens úteis (abertura forte)', 'q-2-1-f8', 'ter upgrade (campeão 2★) e itens úteis'));
    return L;
  }

  // Reroll: lista do candidato escolhido; sem escolhido, o candidato mais perto; sem nenhum, o molde do custo 1
  function criteriosReroll(c) {
    const ok = c.reroll.find((x) => x.ok);
    if (ok) return ok.crits;
    if (!c.reroll.length) return criteriosRerollCusto(c, 1, null);
    return c.reroll.slice().sort((x, y) => y.crits.filter((k) => k.ok === true).length - x.crits.filter((k) => k.ok === true).length || x.custo - y.custo)[0].crits;
  }

  function criteriosEconomia(c, variante) {
    if (variante === 'openfort') {
      const rrAlgum = c.reroll.some((x) => x.ok);
      const okA = !c.upgrade && c.aprim !== 'forca';
      const okE = c.a === 2 || c.faixa === 'folga' || c.faixa === 'segura';
      const esp = degrauEsperado(c.ord);
      return [
        crit(okA, okA ? 'Nenhum upgrade (nenhum 2★), só pares; sem aprimoramento de combate' : c.upgrade ? 'Há upgrade (campeão 2★)' : 'Aprimoramento de combate (força)', 'ecm-of-a', 'ficar sem upgrade (só pares) e sem aprimoramento de combate', 'a', 'Board e pares'),
        crit(!c.itensUteis, c.itensUteis ? 'Há item útil para slamar' : 'Nenhum item útil para slamar', 'ecm-of-b', 'não ter itens úteis', 'b', 'Itens'),
        crit(c.aprim === 'eco' ? true : null, c.aprim === 'eco' ? 'Aprimoramento de economia: o sinal mais forte' : 'Sem aprimoramento de economia: não é requisito, mas é o sinal mais forte', 'ecm-of-c', undefined, 'c', 'Aprimoramento'),
        crit(!rrAlgum, rrAlgum ? 'Há condições de reroll (Estratégia 2): saia do Open Fort' : 'Cópias não decidem a entrada; sem as condições de reroll no fim do estágio 2', 'ecm-of-d', 'não ter as condições de reroll (4+ cópias de custo 1 ou 2+ de custo 2, com itens e sem contest)', 'd', 'Cópias'),
        crit(okE, okE ? (c.a === 2 ? 'Loss streak só no estágio 2: a derrota tira pouca vida' : `Vida ${c.hp} aguenta perder rodadas (Folga/Segura)`) : `Vida ${c.hp}: o Open Fort só vale no estágio 2 ou com Folga/Segura`, 'ecm-of-e', 'vida em Folga/Segura (Open Fort só no estágio 2)', 'e', 'Vida e streak'),
        crit(c.gold >= esp ? true : c.ord <= O('2-2') ? null : false, `Ouro ${c.gold}: degraus 14 → 20 → 32 no estágio 2, alvo 50 no 3-1`, 'ecm-of-f', undefined, 'f', 'Ouro'),
        crit(c.ord === ORD.r25 ? c.board !== 'forte' : null, c.ord === ORD.r25 ? (c.board !== 'forte' ? 'Board segue fraco: confirma o Open Fort' : 'Achou board forte: UPAR, quebre a loss streak e vá à Estratégia 1') : 'Confirme no 2-5: achou board forte → UPAR e vá à Estratégia 1', 'ecm-of-g', undefined, 'g', 'Confirmação no 2-5'),
      ];
    }
    const eco = c.aprim === 'eco';
    if (variante === 'antecipado') {
      const s = c.sobra8;
      const nota = s.exato ? '' : ' (sem o XP informado: assumindo o pré-level feito)';
      const okEco = eco && s.sobra >= 40;
      return [
        crit(eco ? okEco : c.aprim === 'forca' ? false : null, !eco ? 'Sem aprimoramento de economia (marque em Extras)' : okEco ? `Aprimoramento de economia e ${s.sobra} de ouro sobrando depois de subir ao 8${nota}` : `Aprimoramento de economia, mas só ${s.sobra} sobrando depois de subir ao 8 (precisa ~40+)${nota}`, 'ecm-3a-eco', eco ? `~40+ de ouro sobrando depois de subir ao 8 (hoje ${s.sobra})` : 'aprimoramento de economia (marque em Extras) e ~40+ de ouro sobrando depois de subir ao 8', null, 'Economia e ouro'),
        crit(c.contestAlvo <= 2, c.contestAlvo === 2 ? '2 jogadores na comp de custo 4: role antes deles' : c.contestAlvo < 2 ? `Contest ${c.contestAlvo} (máximo 2)` : `${c.contestAlvo} jogadores na comp: o 3A aceita no máximo 2`, 'ecm-3a-contest', 'no máximo 2 jogadores na comp', null, 'Contest'),
        crit(c.hp >= 30, c.hp >= 41 ? `Vida ${c.hp} (41+)` : c.hp >= 30 ? `Vida ${c.hp} em Atenção: o roll antecipado também serve para estabilizar` : `Vida ${c.hp} em Crítica: estabilize antes`, 'ecm-3a-vida', `vida 30+ (hoje ${c.hp})`, null, 'Vida'),
      ];
    }
    // fast9 (3B): (a)-(f)
    const entrada = c.ord <= ORD.r41;
    const it5 = c.alvoSeed ? itensUteisDe(c.estado, c.dados, { comp: c.alvoSeed, minCusto: 5, detalhe: true }) : null;
    return [
      crit(c.hp >= 80, `Vida 80+ no 4-1 (hoje ${c.hp})`, 'ecm-3b-a', `ter 80+ de vida no 4-1 (hoje ${c.hp})`, 'a', 'Vida'),
      crit(eco ? true : c.aprim === 'forca' ? false : null, eco ? 'Aprimoramento de economia' : 'Aprimoramento de economia (não marcado)', 'ecm-3b-b', 'aprimoramento de economia (marque em Extras)', 'b', 'Aprimoramento'),
      crit(c.gold >= 50 ? true : entrada ? false : null, entrada ? `Ouro ${c.gold}: 50+ no 4-1 (juros no máximo), para subir sem rolar até o 9` : `Ouro ${c.gold}: o 50+ vale para a entrada no 4-1; o plano já está em andamento`, 'ecm-3b-c', `ter 50+ de ouro no 4-1 (hoje ${c.gold})`, 'c', 'Ouro'),
      crit(c.contestAlvo === 0, c.contestAlvo === 0 ? 'Ninguém atrás dos mesmos custo 5' : `${c.contestAlvo} jogador(es) na comp: Fast 9 contestado é erro`, 'ecm-3b-d', 'ninguém na mesma comp', 'd', 'Contest'),
      crit(it5 ? (it5.ok ? true : it5.sem ? null : false) : null, !it5 ? 'Sem comp definida: confira se os itens servem aos custo 5' : it5.ok ? 'Componentes para os itens dos custo 5 da comp' : it5.sem ? 'Seed sem itens para os custo 5 da comp: não dá para confirmar' : 'Sem componentes para os itens dos custo 5 da comp', 'ecm-3b-e', undefined, 'e', 'Itens'),
      crit(null, 'Aceite perder o estágio 4 (única exceção à regra "loss streak só no estágio 2")', 'ecm-3b-f', undefined, 'f', 'Streak'),
    ];
  }

  function montarEstrategia(c) {
    const esc = escolherEstrategia(c);
    const crits = {
      fast8: criteriosFast8(c),
      reroll: criteriosReroll(c),
      openfort: criteriosEconomia(c, 'openfort'),
      antecipado: criteriosEconomia(c, 'antecipado'),
      fast9: criteriosEconomia(c, 'fast9'),
    };
    const chave = esc.id === 'fast8' ? 'fast8' : esc.id === 'reroll' ? 'reroll' : esc.variante;
    const lista = crits[chave];
    const porque = lista.map((x) => ({ letra: x.letra, rotulo: x.rotulo, ok: x.ok, texto: x.texto, regra: R(x.regra) }));
    const rotulados = lista.filter((x) => x.letra || x.rotulo);
    const bateram = rotulados.filter((x) => x.ok === true).map((x) => x.letra || x.rotulo);
    // alternativas relevantes na rodada
    const alts = [];
    if (chave !== 'fast8') alts.push(['fast8', 'Fast 8']);
    if (chave !== 'reroll' && c.ord <= ORD.r41 + 1) alts.push(['reroll', 'Reroll']);
    if (c.ord <= ORD.r31 && chave !== 'openfort' && c.ord >= ORD.r21) alts.push(['openfort', 'Open Fort']);
    if (c.ord >= ORD.r37 && c.ord <= ORD.r51) {
      if (chave !== 'fast9') alts.push(['fast9', 'Fast 9']);
      if (chave !== 'antecipado' && c.ord <= ORD.r41) alts.push(['antecipado', 'Fast 8 antecipado']);
    }
    const mudaria = [];
    alts
      .map(([k, nome]) => ({ k, nome, falta: crits[k].filter((x) => x.ok !== true && x.mudar) }))
      .sort((x, y) => x.falta.length - y.falta.length)
      .forEach(({ nome, falta }) => {
        falta.slice(0, 2).forEach((x) => { if (mudaria.length < 5) mudaria.push({ texto: `Para ${nome}: ${x.mudar}.`, regra: R(x.regra) }); });
      });
    if (c.alvo && c.contestAlvo >= 3) mudaria.push({ texto: '3+ jogadores na sua comp: troque de comp e mantenha o Fast 8.', regra: R('f8-gat-contest3') });
    return {
      id: esc.id,
      variante: esc.variante,
      rotulo: ROTULO_VARIANTE[esc.variante],
      porque,
      bateram,
      totalCriterios: rotulados.length,
      mudaria,
      carry: esc.carry ? { id: esc.carry.champId, n: esc.carry.nome, custo: esc.carry.custo, copias: esc.carry.copias } : null,
    };
  }

  // ---------------------------------------------------------------- planos de acao
  function plano(tipo, regra, o) {
    return Object.assign({ tipo, regra, nivel: null, rolarAte: null, texto: '', opcional: false, preLevel: null, extras: [], limiteRolagens: null, piso: null }, o || {});
  }
  const fica = (c, regra, texto, o) => plano('FICAR', regra, Object.assign({ nivel: c.level, texto }, o));
  const guarda = (c, regra, texto, o) => plano('GUARDAR', regra, Object.assign({ texto }, o));

  function upar(c, n, regra, texto, o) {
    if (c.level >= n) return fica(c, regra, `Já está no nível ${c.level} (a regra manda o ${n}).`, o);
    return plano('UPAR', regra, Object.assign({ nivel: n, texto }, o));
  }

  // devolve null se nao ha ouro para pelo menos 1 rolagem acima do piso
  function rolar(c, min, max, regra, texto, o) {
    if (c.gold - min < OURO_POR_ROLAGEM) return null;
    return plano('ROLAR', regra, Object.assign({ rolarAte: { min, max }, texto }, o));
  }

  function uparRolar(c, n, min, max, regra, texto, o) {
    if (c.level >= n) return rolar(c, min, max, regra, texto, o) || fica(c, regra, `Já está no ${c.level}; ouro sem folga para rolar. ${texto}`, o);
    return plano('UPAR', regra, Object.assign({ nivel: n, rolarAte: { min, max }, texto }, o));
  }

  const extra = (texto, regra) => ({ texto, regra });
  const preLevel = (texto, aplicaXp) => ({ texto, aplicaXp: !!aplicaXp });

  // "falta 1 peca": a comp favorita fecha com 1 campeao a mais (aproximacao: board final)
  function falta1Peca(c) {
    return !!(c.favorita && c.favorita.coberturaFim.total - c.favorita.coberturaFim.tem === 1);
  }

  // 3-2 a 3-5: rolagens do Fast 8
  function rolagemEstagio3(c) {
    if (c.pares >= PARES_MUITOS) {
      const p = rolar(c, 32, 32, 'f8-3-roll', `${c.pares} pares: 2–3 rolagens por rodada, parando em 32.`, { limiteRolagens: 3, piso: { valor: 32, texto: 'Pare em 32 ao rolar no estágio 3. Volta perto de 50 em 2 rodadas.', regra: 'f8-piso-32' } });
      if (p) return p;
    }
    if (falta1Peca(c)) {
      return rolar(c, 32, 32, 'f8-3-roll-falta1', 'Falta 1 peça da comp favorita: role até achar, parando em 32.', { piso: { valor: 32, texto: 'Pare em 32 ao rolar no estágio 3.', regra: 'f8-piso-32' } });
    }
    return null;
  }

  function slowRoll(c, regra, texto) {
    const p = rolar(c, 50, 50, regra, texto || 'Slow roll: role só o que passa de 50.', { piso: { valor: 50, texto: 'Slow roll: fique acima de 50 e role só o excedente.', regra: 'rr-slow' } });
    return p || guarda(c, regra, `Guarde até 50 (hoje ${c.gold}); depois slow roll.`);
  }

  // ---------------------------------------------------------------- Fast 8 (secao 2)
  function planoFast8(c) {
    const o = c.ord;
    if (c.a === 1) return guarda(c, 'g-est1', 'Estágio 1: sem tabela nas fontes. Juros já valem (10 de ouro = +1).');
    if (o === ORD.r21) {
      if (c.upgrade && c.itensUteis && c.aprim !== 'eco') return upar(c, 4, 'f8-2-1', 'Upgrade e itens úteis: suba ao 4 e busque win streak.');
      return fica(c, 'f8-2-1', 'Sem abertura forte: fique no 3 e faça loss streak (abertura da Estratégia 3).', { nivel: Math.max(3, c.level) });
    }
    if (o === ORD.r24) return guarda(c, 'f8-2-4', 'Carrossel: pegue o item que a comp precisa.');
    if (o === ORD.r23 && c.streak >= 2 && c.board === 'forte') return upar(c, 5, 'f8-2-3', 'Win streak e board forte: suba ao 5. O ouro da streak paga.');
    if (o === ORD.r25) {
      if (c.board === 'forte' && c.gold >= 10) return upar(c, 5, 'f8-2-5', c.gold >= 20 ? 'Board forte e ouro 20+ (ideal): suba ao 5.' : 'Board forte e ouro 10+: suba ao 5 (ideal 20).');
      return fica(c, 'f8-2-5', 'Sem board forte ou sem 10 de ouro: fique e guarde.');
    }
    if (c.a === 2) {
      if (c.pares >= PARES_MUITOS) {
        const alvo = c.gold >= 22 ? 20 : c.gold >= 16 ? 14 : null;
        if (alvo) {
          const p = rolar(c, alvo, alvo, 'f8-2-2-pares', `${c.pares} pares: dá para rolar um pouco. Pare em ${alvo}, nunca em 10.`, { piso: { valor: alvo, texto: 'Pare de gastar em 14 ou 20, nunca em 10.', regra: 'f8-2-2' } });
          if (p) return p;
        }
      }
      const p = guarda(c, 'f8-2-2', 'Não role. Pare de gastar em 14 ou 20, nunca em 10.');
      if (c.ord === ORD.r27) p.extras.push(extra('Fim do estágio 2: componentes na mão, scout dos boards e comece a se comprometer.', 'f8-fim2'));
      return p;
    }
    if (o === ORD.r31) {
      if (c.streak >= 2 && c.board === 'forte') return upar(c, 6, 'f8-3-1', 'Win streak e board forte: curva agressiva, suba ao 6.');
      return fica(c, 'f8-3-1', 'Não suba ao 6 por impulso (quebra juros e streak).', { preLevel: preLevel('Pré-level para o 3-2: termine 2 XP abaixo do 6, se não custar economia.', true) });
    }
    if (o === ORD.r32) {
      if (c.gold >= 30 && c.level < 6) return upar(c, 6, 'f8-3-2', 'Ouro 30+: suba ao 6. Comp definida aqui.');
      if (c.gold >= 20 && c.level < 6 && c.board !== 'fraco') return upar(c, 6, 'f8-3-2', 'Ouro ~20 e board bom: pode subir ao 6, mas a economia fica ruim.', { opcional: true });
    }
    if (o >= ORD.r32 && o <= ORD.r35) {
      if (o === ORD.r35) {
        const rico = c.gold >= 50;
        const segura = c.streak >= 2 && c.board === 'forte';
        if (rico || segura) return upar(c, 7, 'f8-3-5', rico ? 'Muito rico (50+): suba ao 7.' : 'Para segurar a streak: suba ao 7.', { extras: [extra('Limiar de "muito rico" (50+) e "streak" (2+) é do painel.', 'f8-3-5-limiar')] });
      }
      const r = rolagemEstagio3(c);
      if (r) return r;
      if (o === ORD.r33) return fica(c, 'f8-3-3', 'Level torto: não compre XP.', { preLevel: preLevel('Pré-level se for subir no 3-5: termine 2 XP abaixo do próximo nível.', true) });
      if (o === ORD.r35) return fica(c, 'f8-3-5', 'Fique no 6 e guarde rumo a 50.');
      return guarda(c, 'f8-3-roll', 'Sem 3+ pares nem peça faltando: guarde.');
    }
    if (o === ORD.r36) return fica(c, 'f8-3-6', 'Level torto: não compre XP.', { preLevel: preLevel('Pré-level se for subir no 3-7: termine 2 XP abaixo do próximo nível.', true) });
    if (o === ORD.r37) {
      if (c.contestAlvo >= 2) return uparRolar(c, 8, 20, 30, 'f8-3-7', '2 jogadores na comp: suba ao 8 e role antes de todos.', { piso: { valor: 30, texto: 'Role até 20–30.', regra: 'f8-piso-2030' } });
      return upar(c, 7, 'f8-3-7', 'Suba ao 7 se ainda não foi. Revise a curva.');
    }
    if (o === ORD.r41) {
      if (c.contestAlvo >= 2 && c.level < 8) return uparRolar(c, 8, 20, 30, 'f8-4-1-contest', '2 jogadores na comp: suba ao 8 e role antes de todos.', { piso: { valor: 30, texto: 'Role até 20–30.', regra: 'f8-piso-2030' } });
      if (c.streak >= 2 && c.board === 'forte') return upar(c, 8, 'f8-4-1', 'Curva agressiva: suba ao 8 aqui.');
      if (c.level < 7) return upar(c, 7, 'f8-4-1', 'Suba ao 7.', { preLevel: preLevel('Pré-level: termine 2 XP abaixo do 8, se não custar economia.', false) });
      return fica(c, 'f8-4-1', 'Já no 7.', { preLevel: preLevel('Pré-level: termine 2 XP abaixo do 8, se não custar economia.', true) });
    }
    if (o === ORD.r42) {
      const urgente = c.valeFaixa && (c.faixa === 'atencao' || c.faixa === 'critica');
      if (c.gold >= 40 || urgente) {
        const piso = { valor: 40, texto: 'Ouro ~40 para subir ao 8 no 4-2. Role até 20–30 atrás de 1 cópia do carry e do tanque.', regra: 'f8-piso-40' };
        const p = uparRolar(c, 8, 20, 30, urgente && c.gold < 40 ? 'f8-piso-vida' : 'f8-4-2', urgente && c.gold < 40 ? 'Vida em Atenção: não adie o roll down para o 4-5.' : 'Suba ao 8 e role atrás de 1 cópia do carry e do tanque.', { piso });
        const { atual, max } = c.xp || {};
        if (c.level === 7 && atual != null && max != null && max - atual > 2) p.extras.push(extra(`O pré-level do 4-1 não foi feito (faltam ${max - atual} XP): o XP sai do seu ouro. O ~40 conta com os 2 XP grátis; confira o que sobra para o roll down.`, 'f8-4-2-ouro'));
        return p;
      }
      if (c.level >= 8) {
        const p = rolar(c, 20, 30, 'f8-4-2', 'Role até 20–30 atrás de 1 cópia do carry e do tanque.', { piso: { valor: 30, texto: 'Fim do roll down: 20–30.', regra: 'f8-piso-2030' } });
        if (p) return p;
      }
      return fica(c, 'f8-4-2', 'Ouro abaixo de ~40: fique, guarde e suba ao 8 no 4-5.');
    }
    if (o === ORD.r45 && c.level < 8) {
      return uparRolar(c, 8, 20, 30, 'f8-4-5', 'Só porque não subiu no 4-2: suba ao 8 e role. O lobby já tirou peças do pool.', { piso: { valor: 30, texto: 'Fim do roll down: 20–30.', regra: 'f8-piso-2030' } });
    }
    if (o === ORD.r51 || o === ORD.r52) {
      const estavel = c.board !== 'fraco' && (c.faixa === 'folga' || c.faixa === 'segura');
      if (estavel) return upar(c, 9, 'f8-5-1', 'Estabilizou: refaça economia e suba ao 9 (5-1, 5-2 ou 5-5).', { extras: [extra('Confirme: achou o carry e o tanque? "Estabilizou" aqui = board não fraco e vida Folga/Segura.', 'f8-5-1-estabilizou')] });
      const p = rolar(c, 20, 30, 'f8-5-1', 'Jogue com custo 4 de 1★, refaça economia e role de novo no 8. O 9 fica para o estágio 6.', { piso: { valor: 20, texto: 'Pare ao chegar a 20 no roll down.', regra: 'f8-gat-parar-20' } });
      return p || fica(c, 'f8-5-1', 'Sem ouro para rolar: refaça economia no 8.');
    }
    if ((o === ORD.r55 || o === ORD.r61) && c.level < 9) return upar(c, 9, 'f8-5-5', 'Cape o board.');
    return null;
  }

  // ---------------------------------------------------------------- Reroll (secao 3)
  // Custo 3: abre com UPAR 4 e win streak, que precisa durar ate o 4-2; spike no fim do 4 ou comeco do 5.
  function planoRerollC3(c) {
    const o = c.ord;
    if (o === ORD.r21) return upar(c, 4, 'rr-c3-2-1', 'Board forte e win streak: suba ao 4.');
    if (o === ORD.r25) {
      if (c.board === 'forte' && c.gold >= 10) return upar(c, 5, 'rr-c3-2-5', c.gold >= 20 ? 'Board forte e ouro 20+ (ideal): suba ao 5.' : 'Board forte e ouro 10+: suba ao 5 (ideal 20).');
      return guarda(c, 'rr-c3-2-5', 'Sem board forte ou sem 10 de ouro: guarde.');
    }
    if (c.a === 2) return guarda(c, 'rr-c3-2-1', 'Estágio 2: guarde e mantenha a win streak.');
    if (o === ORD.r31) return fica(c, 'rr-c3-3-1', 'Fique e guarde. Não suba ao 6 por impulso.');
    if (o === ORD.r32) {
      if (c.gold >= 30) return upar(c, 6, 'rr-c3-3-2', 'Ouro 30–32: suba ao 6. Board forte poupa vida.');
      return guarda(c, 'rr-c3-3-2', `Ouro ${c.gold}: abaixo de 30–32 para subir ao 6. Guarde.`);
    }
    const slow = (regra, texto, o2) => rolar(c, 50, 50, regra, texto, Object.assign({ piso: { valor: 50, texto: 'Custo 3: 50 no slow roll.', regra: 'rr-piso-c3' } }, o2)) || guarda(c, regra, `Guarde até 50 (hoje ${c.gold}); depois slow roll.`);
    if (o === ORD.r41) {
      if (c.level < 7) return plano('UPAR', 'rr-c3-4-1', { nivel: 7, rolarAte: { min: 50, max: 50 }, texto: 'Suba ao 7 e faça slow roll acima de 50.', piso: { valor: 50, texto: 'Custo 3: 50 no slow roll.', regra: 'rr-piso-c3' } });
      return slow('rr-c3-4-1', 'No 7: slow roll acima de 50.');
    }
    if (o >= ORD.r42) return slow('rr-c3-4-2', 'A win streak precisa durar até aqui. Slow roll segue.', { extras: [extra('Spike no fim do 4 ou começo do 5: volte com mais ouro e role de novo.', 'rr-c3-estagio5')] });
    return fica(c, 'rr-c3-3-5', 'Fique e guarde rumo ao spike do fim do 4.');
  }

  function planoReroll(c, variante) {
    const o = c.ord;
    const c1 = variante === 'custo1';
    const p = (id) => (c1 ? 'rr-c1-' : 'rr-c2-') + id;
    if (c.a === 1) return guarda(c, 'g-est1', 'Estágio 1: sem tabela nas fontes. Juros já valem (10 de ouro = +1).');
    if (variante === 'custo3') return planoRerollC3(c);
    if (o === ORD.r21) {
      if (c1) return fica(c, p('2-1'), 'Open Fort: fique no 3 e segure os pares.', { nivel: 3 });
      if (c.slamaveis.length) return fica(c, p('2-1'), 'Itens slamáveis: monte um board razoável para poupar vida.');
      return fica(c, p('2-1'), 'Sem itens slamáveis: Open Fort (cuidado com a vida).', { nivel: 3 });
    }
    if (o === ORD.r25) {
      if (c1) return fica(c, 'rr-c1-2-5', 'Fique e guarde.');
      if (c.board === 'forte') return upar(c, 5, 'rr-c2-2-5', 'Board forte: pode subir ao 5.');
      return guarda(c, 'rr-c2-2-5', 'Guarde. Suba ao 5 só com board forte.');
    }
    if (c.a === 2) return guarda(c, c1 ? 'rr-c1-2-1' : 'rr-c2-2-1', c1 ? 'Estágio 2: guarde e segure os pares (Open Fort).' : 'Estágio 2: guarde.');
    if (o === ORD.r31) {
      if (c1) {
        const r = rolar(c, 32, 32, 'rr-c1-3-1', 'Nível 4: role até 32 atrás do custo 1.', { piso: { valor: 32, texto: 'Pare em 32 (hyper roll desce mais, nunca abaixo de 10).', regra: 'rr-c1-3-1' } });
        const e = [extra(c.level === 4 ? 'No nível 4 as chances de custo 1 são as melhores.' : `Você está no nível ${c.level}: não suba antes de bater os 3★ (o 4 é melhor que o 5 ou o 6 para custo 1).`, 'rr-gat-c1-nivel')];
        if (r) { r.extras = e; return r; }
        return guarda(c, 'rr-c1-3-1', 'Sem ouro acima de 32 para rolar.', { extras: e });
      }
      return fica(c, 'rr-c2-3-1', 'Não suba ao 6 por impulso.');
    }
    if (o === ORD.r32) {
      if (c1) return slowRoll(c, 'rr-c1-3-2', 'Nível 5. Guarde até 50; o que passa disso vai para o slow roll.');
      if (c.gold >= 50) return uparRolar(c, 6, 50, 50, 'rr-c2-3-2', 'Ouro 50+: suba ao 6 e faça slow roll.', { piso: { valor: 50, texto: 'Slow roll: fique acima de 50.', regra: 'rr-slow' } });
      return guarda(c, 'rr-c2-3-2', 'Ouro abaixo de 50: suba ao 6 só no 3-5.');
    }
    if (o === ORD.r35) {
      if (c1 && c.reroll.some((x) => x.custo === 1 && x.copias >= 9)) return upar(c, c.level + 1, 'rr-c1-3-5', 'Bateu os 3★: pare de rolar e suba de nível.', { extras: [extra('3★ = 9 cópias do mesmo campeão.', 'rr-gat-3star')] });
      if (!c1) {
        const up = c.level < 6 ? upar(c, 6, 'rr-c2-3-5', 'Suba ao 6, se não foi. Slow roll acima de 50.') : null;
        if (up) return up;
      }
      return slowRoll(c, c1 ? 'rr-c1-3-5' : 'rr-c2-3-5', 'Prazo ideal. Se ainda não bateu os 3★, o slow roll segue.');
    }
    if (o === ORD.r41) {
      if (c1) {
        const r = rolar(c, 10, 10, 'rr-c1-4-1', 'Última rodada de rolar.', { extras: [extra('Se não bateu: pare de rolar e suba de nível com o board que tem.', 'rr-aband-c1')], piso: { valor: 10, texto: 'Piso de ouro: 10, sempre.', regra: 'f8-piso-10' } });
        return r || guarda(c, 'rr-c1-4-1', 'Última rodada de rolar, mas sem ouro acima de 10.', { extras: [extra('Se não bateu: pare de rolar e suba de nível com o board que tem.', 'rr-aband-c1')] });
      }
      const r = rolar(c, 20, 20, 'rr-c2-4-1', 'Role até 20 por upgrades e 3★.', { piso: { valor: 20, texto: 'Pare em 20 no 4-1 (custo 2).', regra: 'rr-c2-4-1' } });
      return r || guarda(c, 'rr-c2-4-1', 'Sem ouro acima de 20 para rolar.');
    }
    return slowRoll(c, c1 ? 'rr-c1-3-2' : 'rr-c2-3-5');
  }

  // ---------------------------------------------------------------- Economia (secao 4)
  function planoEconomia(c, variante) {
    const o = c.ord;
    if (variante === 'openfort') {
      if (o === ORD.r21) return fica(c, 'ec-2-1', 'Open Fort: não monte board (venda, não compre, às vezes nem slame).', { nivel: 3 });
      if (o === ORD.r24) return guarda(c, 'ec-2-4', 'Carrossel: você escolhe antes (menos vida). Pegue o item da comp.');
      if (o === ORD.r25) return guarda(c, 'ec-2-5', 'Fique. Se achou board forte, pode subir e quebrar a loss streak (vá à Estratégia 1).');
      if (o === ORD.r31) return fica(c, 'ec-3-1', 'Saia da loss streak: comece a montar board com a maior economia possível.', { extras: [extra('Alvo de ouro: 50 no 3-1 (teto de juros).', 'ec-piso-50')] });
      const p = guarda(c, 'ec-2-2', 'Juros desde cedo: degraus 14, 20, 32. Não role. Venda pares que não entram.');
      if (o === ORD.r27) p.extras.push(extra('Fim do estágio 2: decida a saída. 4+ cópias de custo 1 (itens BIS) ou 2+ de custo 2 (itens BIS ou slamáveis que poupem vida), sem contest, vão para o Reroll.', 'ec-fim2'));
      return p;
    }
    if (variante === 'antecipado') {
      return uparRolar(c, 8, 20, 30, 'ec-3a', 'Economia alta: suba ao 8 e role antes de todos.', { piso: { valor: 30, texto: 'Role até 20–30.', regra: 'f8-piso-2030' }, extras: [extra(`~40+ sobrando depois de subir ao 8 (hoje ${c.sobra8.sobra}${c.sobra8.exato ? '' : '; informe o XP para confirmar'}).`, 'f8-piso-40-3a'), extra('Pare ao achar 1 cópia do carry e do tanque.', 'f8-gat-parar-carry')] });
    }
    // fast9 (3B)
    if (o >= ORD.r51) {
      return uparRolar(c, 9, 10, 10, 'ec-5-1-3b', 'Role pelos custo 5. Alvo: 1–2 custo 5 de 2★ (linha de frente, linha de trás, carry).', { piso: { valor: 10, texto: 'Pare ao achar os custo 5 de 2★ ou ao chegar a 10.', regra: 'ec-gat-parar-3b' } });
    }
    if (c.level < 8) return upar(c, c.level + 1, 'ec-4-x-3b', 'Suba sem rolar. Aceite perder o estágio 4.', { extras: [extra('Vida 80+ no 4-1 é a condição do Fast 9.', 'ec-piso-vida80')] });
    return guarda(c, 'ec-4-x-3b', 'Sem rolar: guarde para o 5-1. Aceite perder o estágio 4.', { extras: [extra('Se a vida cair rápido com board fraco: pare de subir e role no 8.', 'ec-aband-vida')] });
  }

  // ---------------------------------------------------------------- Matriz vida x board (Passo 7)
  const NOME_BOARD = { forte: 'Forte', medio: 'Médio', fraco: 'Fraco' };

  function planoMatriz(c) {
    const id = `m-${c.faixa}-${c.board}`;
    if (c.faixa === 'segura' && c.board === 'fraco' && c.a === 3 && falta1Peca(c)) {
      const r = rolar(c, 32, 32, id, 'Estágio 3 com board fraco e falta 1 peça: role até 32.', { piso: { valor: 32, texto: 'Pare em 32.', regra: 'f8-piso-32' } });
      if (r) return r;
    }
    const textos = {
      folga: 'Vida em Folga: guarde juros e atrase o spike.',
      segura: 'Sem linha própria para esta rodada: siga a curva e role só no gatilho da estratégia.',
      atencao: 'Vida em Atenção: segure o board.',
      critica: 'Vida Crítica: gaste para estabilizar.',
    };
    return guarda(c, id, textos[c.faixa]);
  }

  // Passo 7 + Pânico x agir: com vida em Atenção ou Crítica (estagio 3+) o plano antecipa o spike que ja estava no plano.
  function aplicarVida(c, p, est) {
    const r = aplicarVidaInterno(c, p, est);
    if (r !== p) r.extras = p.extras.concat(r.extras);
    return r;
  }

  function aplicarVidaInterno(c, p, est) {
    if (!c.valeFaixa || (c.faixa !== 'atencao' && c.faixa !== 'critica')) return p;
    const id = `m-${c.faixa}-${c.board}`;
    const jaGasta = p.tipo === 'UPAR' || p.tipo === 'ROLAR';
    const nota = (txt) => extra(txt, 'pan-agir');
    if (c.faixa === 'critica') {
      if (c.board === 'forte' && p.tipo === 'UPAR' && !p.rolarAte) { p.extras.push(extra('Vida Crítica: gaste para manter a streak. Piso 10.', id)); return p; }
      const r = rolar(c, 10, 10, id, c.board === 'forte' ? 'Vida Crítica: gaste para manter a streak. Piso 10.' : c.board === 'medio' ? 'Vida Crítica: role até 10 pelo spike.' : 'Vida Crítica: role até 10. Abaixo de 10 só se for cair nesta rodada.', { piso: { valor: 10, texto: 'Piso de ouro: 10, sempre.', regra: 'f8-piso-10' } });
      if (p.tipo === 'UPAR') {
        p.rolarAte = { min: 10, max: 10 };
        p.extras.push(extra('Vida Crítica: depois do XP, gaste até o piso de 10.', id));
        return p;
      }
      return r || guarda(c, id, 'Vida Crítica, mas o ouro já está no piso de 10: não role.');
    }
    // atencao
    if (est.id === 'reroll') {
      const min = c.a === 3 ? 32 : 20;
      const r = rolar(c, min, min, 'rr-piso-atencao', `Vida em Atenção: saia do slow roll e role para estabilizar (até ${min}).`, { piso: { valor: min, texto: `Pare em ${min}.`, regra: min === 32 ? 'f8-piso-32' : 'f8-piso-2030' } });
      return r || p;
    }
    if (c.board === 'fraco') {
      const min = c.a === 3 ? 32 : 20;
      if (p.tipo === 'ROLAR' && p.rolarAte.min <= min) return p;
      if (p.tipo === 'UPAR') { p.extras.push(extra('Vida em Atenção com board fraco: role para estabilizar, sem Fast 9 nem Open Fort.', id)); return p; }
      const r = rolar(c, min, min, id, `Vida em Atenção com board fraco: role agora para estabilizar (até ${min}).`, { piso: { valor: min, texto: `Pare em ${min}: até 32 no estágio 3, até 20 no 4.`, regra: min === 32 ? 'f8-piso-32' : 'f8-piso-2030' } });
      return r || p;
    }
    if (c.board === 'medio') {
      if (!jaGasta && c.a === 4 && c.level < 8) {
        return uparRolar(c, 8, 20, 30, id, 'Vida em Atenção: antecipe o spike (roll down já, não espere o 4-5).', { piso: { valor: 30, texto: 'Role até 20–30.', regra: 'f8-piso-2030' } });
      }
      p.extras.push(nota('Vida em Atenção: antecipe o spike que já estava planejado.'));
      return p;
    }
    // forte
    if (!jaGasta && c.gold >= 50 && c.level < 9) {
      const up = upar(c, c.level + 1, id, 'Vida em Atenção com board forte e ouro sobrando: suba para poupar vida.');
      if (up.tipo === 'UPAR') return up;
    }
    p.extras.push(extra('Vida em Atenção: segure o board. Suba para poupar vida se sobra ouro.', id));
    return p;
  }

  // ---------------------------------------------------------------- finalizacao do plano
  function custoXpDe(c, p) {
    if (p.tipo !== 'UPAR' || p.nivel !== c.level + 1) return null;
    const { atual, max } = c.xp || {};
    if (atual == null || max == null || max <= atual) return null;
    return max - atual;
  }

  function finalizar(c, p) {
    const regra = R(p.regra);
    const g = c.gold;
    const custoXp = custoXpDe(c, p);
    const semXp = p.tipo === 'UPAR' && custoXp == null;
    const disp = semXp ? null : g - (custoXp || 0);
    let sobra = null;
    let sobraTexto = '';
    let rolagens = null;
    const alvo = p.rolarAte;
    if (semXp) {
      sobraTexto = p.nivel > c.level + 1 ? 'Sobra = ouro menos o XP dos níveis (mais de um nível: informe o XP de cada passo).' : 'Sobra = ouro menos o XP. Informe o XP (atual / total) para calcular.';
    } else if (alvo) {
      const lim = p.limiteRolagens;
      const maxR = Math.max(0, Math.floor((disp - alvo.min) / OURO_POR_ROLAGEM));
      if (lim) {
        const rmax = Math.min(lim, maxR);
        const rmin = Math.min(2, rmax);
        rolagens = { min: rmin, max: rmax };
        sobra = { min: Math.max(alvo.min, disp - OURO_POR_ROLAGEM * rmax), max: Math.max(alvo.min, disp - OURO_POR_ROLAGEM * rmin) };
      } else if (disp <= alvo.min) {
        rolagens = { min: 0, max: 0 };
        sobra = { min: disp, max: disp };
      } else {
        rolagens = { min: Math.max(0, Math.floor((disp - alvo.max) / OURO_POR_ROLAGEM)), max: maxR };
        sobra = { min: alvo.min, max: Math.min(alvo.max, disp) };
      }
      sobraTexto = sobra.min === sobra.max ? `${sobra.min}` : `${sobra.min}–${sobra.max}`;
    } else {
      sobra = { min: disp, max: disp };
      sobraTexto = String(disp);
    }
    let pre = null;
    if (p.preLevel) {
      pre = { texto: p.preLevel.texto };
      const { atual, max } = c.xp || {};
      if (p.preLevel.aplicaXp && atual != null && max != null && max > 2) {
        pre.xpAlvo = max - 2;
        pre.comprar = Math.max(0, pre.xpAlvo - atual);
      }
    }
    const titulo = {
      UPAR: `UPAR para ${p.nivel}${alvo ? ` e ROLAR até ${fmtFaixa(alvo)}` : ''}`,
      FICAR: `FICAR no ${p.nivel}`,
      ROLAR: `ROLAR até ${alvo ? fmtFaixa(alvo) : '?'}`,
      GUARDAR: 'GUARDAR',
    }[p.tipo];
    let piso = null;
    if (p.piso) piso = { valor: p.piso.valor, texto: p.piso.texto, regra: R(p.piso.regra) };
    return {
      tipo: p.tipo, nivel: p.nivel, titulo, texto: p.texto, opcional: p.opcional, rolarAte: alvo, limiteRolagens: p.limiteRolagens,
      rolagens, custoXp, sobra, sobraTexto, preLevel: pre, regra,
      extras: p.extras.map((x) => ({ texto: x.texto, regra: x.regra ? R(x.regra) : null })),
      piso,
    };
  }

  // ---------------------------------------------------------------- decidir
  function alertaVida(c) {
    const leitura = { folga: 'Folga: tempo de sobra. Guarde, atrase o spike.', segura: 'Segura: ainda dá para trocar vida por ouro.', atencao: 'Atenção: margem curta. Antecipe o spike que já estava planejado.', critica: 'Crítica: agir já. Gaste para estabilizar.' }[c.faixa];
    const regraId = { folga: 'p1-folga', segura: 'p1-segura', atencao: 'p1-atencao', critica: 'p1-critica' }[c.faixa];
    let alerta = null;
    if (c.valeFaixa && (c.faixa === 'atencao' || c.faixa === 'critica')) {
      alerta = { nivel: c.faixa === 'critica' ? 'critico' : 'aviso', texto: leitura, regra: R(regraId) };
    }
    return { hp: c.hp, faixa: c.faixa, rotulo: { folga: 'Folga', segura: 'Segura', atencao: 'Atenção', critica: 'Crítica' }[c.faixa], valeFaixa: c.valeFaixa, leitura, alerta, regra: R(regraId), regraValem: R('p1-valem') };
  }

  function extrasContest(c, est) {
    const out = [];
    const n = c.contestAlvo;
    if (!c.alvo || n < 2) return out;
    const rr = est.id === 'reroll' || est.variante === 'fast9';
    if (n === 2) out.push(rr ? extra('2 jogadores na comp: saia (reroll e Fast 9 sentem qualquer contest).', 'p5-2-rr') : extra('2 jogadores na comp: role antes dos outros (3-7 ou 4-1) ou prepare o plano B.', 'p5-2-f8'));
    if (n >= 3) out.push(extra('3+ jogadores na comp: pivote e troque de comp, mantendo o fast 8.', 'f8-gat-contest3'));
    return out;
  }

  function decidir(estadoIn, dados) {
    const estado = sanitizarEstado(estadoIn, dados.catalog, dados.recipes);
    const c = montarContexto(estado, dados);
    const est = montarEstrategia(c);
    let p = null;
    if (est.id === 'reroll') p = planoReroll(c, est.variante);
    else if (est.id === 'economia') p = planoEconomia(c, est.variante);
    else p = planoFast8(c);
    if (!p) p = planoMatriz(c);
    p.extras = (p.extras || []).concat(extrasContest(c, est));
    p = aplicarVida(c, p, est);
    const acao = finalizar(c, p);

    const jurosAgora = juros(c.gold);
    const g = degrau(c.gold);
    const leitura = leituraOuro(c.gold);
    let aviso = null;
    if (c.gold < 10 && c.a >= 3) aviso = 'Ouro abaixo do piso de 10 (exceção: fim de jogo, morrendo).';
    else if (acao.sobra && acao.sobra.min < 10 && c.gold >= 10) aviso = 'Depois da ação o ouro fica abaixo do piso de 10.';
    const rodada = {
      stage: estado.stage, ord: c.ord,
      tipo: c.a >= 2 && c.b === 4 ? 'carrossel' : c.a >= 2 && c.b === 7 ? 'pve' : null,
      leitura: LEITURA_OBRIGATORIA.includes(c.ord),
    };
    return {
      rodada,
      vida: alertaVida(c),
      ouro: {
        atual: c.gold, juros: jurosAgora, proximoDegrau: g.proximo, falta: g.falta, leitura,
        piso: { minimo: 10, regra: R('f8-piso-10'), contexto: acao.piso },
        aviso,
      },
      streak: { valor: c.streak, bonus: bonusStreak(c.streak), board: c.board },
      estrategia: est,
      acao,
      comps: { fase: c.rank.fase, vazio: c.rank.vazio, top3: c.rank.itens.slice(0, 3), todas: c.rank.itens },
      forcar: Comps().avaliarForca(estado, dados),
    };
  }

  const api = {
    VERSAO, STORAGE_KEY, RODADAS, APRIM, BOARDS, LIM,
    parseStage, ordRodada, proximaRodada, estadoInicial, sanitizarEstado,
    juros, degrau, faixaVida, leituraOuro, bonusStreak, forcaBoard, estrelasDe, resumoUnidades,
    decidir, ORD, LEITURA_OBRIGATORIA,
  };
  root.TFTPainel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
