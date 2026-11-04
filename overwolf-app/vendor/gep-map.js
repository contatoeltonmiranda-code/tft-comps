(function (root) {
  // Adaptador Overwolf GEP (TFT) -> estado do recomendador, mais a lista do que pode ser gravado pela sonda.
  // Formatos vem dos exemplos da doc: https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/teamfight-tactics
  // Regras: nunca ler aprimoramentos, nunca carregar dados de oponentes, nunca gravar credenciais.

  const FEATURES_GRAVAR = ['game_flow', 'game_info', 'lobby_info', 'me', 'match_info', 'store', 'board', 'bench', 'live_client_data'];

  const CHAVES_PERMITIDAS = {
    game_flow: ['phase'],
    game_info: ['game_version', 'is_pbe', 'selected_gamemode', 'queue_status'],
    lobby_info: ['queueId'],
    me: ['summoner_name', 'xp', 'gold', 'health', 'rank'],
    match_info: ['pseudo_match_id', 'match_id', 'battle_state', 'match_state', 'round_type', 'game_mode', 'item_select'],
    store: ['shop_pieces'],
    board: ['board_pieces'],
    bench: ['bench_pieces', 'item_bench'],
    live_client_data: ['game_data', 'active_player'],
  };

  const EVENTOS_PERMITIDOS = ['match_start', 'match_end', 'round_start', 'round_end', 'battle_start', 'battle_end', 'picked_item', 'shop_visible'];
  const CHAVES_NUMERICAS = ['gold', 'health', 'rank', 'queueId'];
  const RE_AUGMENT = /augment/i;
  const MAX_ITENS_BANCO = 30;
  const PROTO = ['__proto__', 'constructor', 'prototype'];

  function ehObjeto(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function interpretar(key, v) {
    if (typeof v !== 'string') return v;
    const t = v.trim();
    if (t[0] === '{' || t[0] === '[') {
      try {
        return JSON.parse(t);
      } catch (e) {
        return v;
      }
    }
    if (CHAVES_NUMERICAS.includes(key) && /^-?\d+$/.test(t)) return Number(t);
    return v;
  }

  // Formatos aceitos: {feature,key,value|data} e o da doc/onInfoUpdates2 {feature,info:{<categoria>:{<chave>:valor}}}.
  // No formato aninhado a chave de fora e a CATEGORIA (ex.: feature "augments" usa categoria "me"), nao a feature.
  function expandir(update) {
    const out = [];
    if (!ehObjeto(update)) return out;
    const feature = typeof update.feature === 'string' ? update.feature : null;
    if (ehObjeto(update.info)) {
      Object.keys(update.info).forEach((cat) => {
        if (!ehObjeto(update.info[cat])) return;
        Object.keys(update.info[cat]).forEach((k) => out.push({ feature: feature || cat, key: k, value: update.info[cat][k] }));
      });
    } else if (feature && typeof update.key === 'string') {
      out.push({ feature, key: update.key, value: 'value' in update ? update.value : update.data });
    }
    return out;
  }

  function acumular(snap, update) {
    const out = Object.assign({}, snap);
    expandir(update).forEach(({ feature, key, value }) => {
      if (PROTO.includes(feature) || PROTO.includes(key)) return;
      out[feature] = Object.assign({}, out[feature], { [key]: interpretar(key, value) });
    });
    return out;
  }

  const cacheIds = new WeakMap();
  function indices(catalog, recipes) {
    const c = cacheIds.get(catalog);
    if (c && c.recipes === recipes) return c;
    const low = (ids) => new Map(ids.map((id) => [id.toLowerCase(), id]));
    const itemIds = (catalog.items || []).map((i) => i.id).concat(Object.keys((recipes && recipes.componentes) || {}));
    const novo = {
      recipes,
      champs: new Set((catalog.champs || []).map((x) => x.id)),
      champsCI: low((catalog.champs || []).map((x) => x.id)),
      items: new Set(itemIds),
      itemsCI: low(itemIds),
    };
    cacheIds.set(catalog, novo);
    return novo;
  }

  const IGNORAR_ITEM = [/^DA_Consumable_/, /^DA_Reforger/, /_Selector$/];

  function mapId(tipo, bruto, catalog, recipes) {
    if (typeof bruto !== 'string' || !bruto.trim()) return { id: null, certeza: 'ignorado' };
    const raw = bruto.trim();
    const ix = indices(catalog, recipes);
    if (tipo === 'champ') {
      if (ix.champs.has(raw)) return { id: raw, certeza: 'exata' };
      const ci = ix.champsCI.get(raw.toLowerCase());
      return ci ? { id: ci, certeza: 'aproximada' } : { id: null, certeza: 'desconhecido' };
    }
    if (ix.items.has(raw)) return { id: raw, certeza: 'exata' };
    if (IGNORAR_ITEM.some((re) => re.test(raw))) return { id: null, certeza: 'ignorado' };
    const ci = ix.itemsCI.get(raw.toLowerCase());
    if (ci) return { id: ci, certeza: 'aproximada' };
    const legado = /^TFT_Item_(.+)$/.exec(raw);
    if (legado) {
      const alvo = ix.itemsCI.get(('DA_Component_' + legado[1]).toLowerCase()) || ix.itemsCI.get(('DA_' + legado[1]).toLowerCase());
      if (alvo) return { id: alvo, certeza: 'aproximada' };
    }
    return { id: null, certeza: 'desconhecido' };
  }

  function normalizar(snap, catalog, recipes) {
    const s = ehObjeto(snap) ? snap : {};
    const desconhecidos = [];
    const aproximados = [];
    const avisos = [];
    const estado = { stage: null, gold: 0, level: 1, board: [], bench: [], itens: [] };

    const mapear = (tipo, bruto) => {
      const r = mapId(tipo, bruto, catalog, recipes);
      if (r.certeza === 'desconhecido') desconhecidos.push({ tipo, bruto });
      if (r.certeza === 'aproximada') aproximados.push({ tipo, bruto, id: r.id });
      return r.id;
    };

    const rt = s.match_info && s.match_info.round_type;
    if (ehObjeto(rt) && typeof rt.stage === 'string') estado.stage = rt.stage;
    const me = s.me || {};
    estado.gold = Math.max(0, Number(me.gold) || 0);
    if (ehObjeto(me.xp) && Number.isInteger(Number(me.xp.level)) && Number(me.xp.level) > 0) estado.level = Number(me.xp.level);

    const pecas = (bloco) => {
      if (!ehObjeto(bloco)) return [];
      return Object.keys(bloco)
        .map((k) => ({ k, cell: Number((/^cell_(\d+)$/.exec(k) || [])[1]), p: bloco[k] }))
        .filter((x) => Number.isInteger(x.cell) && ehObjeto(x.p))
        .sort((a, b) => a.cell - b.cell)
        .map(({ cell, p }) => {
          const c = mapear('champ', p.name);
          const i = [p.item_1, p.item_2, p.item_3].map((x) => mapear('item', x)).filter(Boolean);
          const nivel = Math.min(3, Math.max(1, parseInt(p.level, 10) || 1));
          return c ? { c, s: nivel, i, cell } : null;
        })
        .filter(Boolean);
    };
    estado.board = pecas(s.board && s.board.board_pieces);
    estado.bench = pecas(s.bench && s.bench.bench_pieces);

    const ib = s.bench && s.bench.item_bench;
    if (Array.isArray(ib)) {
      const nome = typeof me.summoner_name === 'string' ? me.summoner_name.split('#')[0].trim().toLowerCase() : '';
      if (!nome) {
        avisos.push('item_bench ignorado: nome do jogador local desconhecido (me.summoner_name)');
      } else {
        const meu = ib.find((p) => ehObjeto(p) && typeof p.summoner === 'string' && p.summoner.split('#')[0].trim().toLowerCase() === nome);
        if (!meu) avisos.push('item_bench sem entrada do jogador local');
        else {
          (Array.isArray(meu.bench_items) ? meu.bench_items : []).forEach((it) => {
            const id = ehObjeto(it) ? mapear('item', it.name) : null;
            const n = ehObjeto(it) ? Math.min(MAX_ITENS_BANCO, Math.max(0, parseInt(it.count, 10) || 0)) : 0;
            for (let k = 0; id && k < n && estado.itens.length < MAX_ITENS_BANCO; k++) estado.itens.push(id);
          });
        }
      }
    }
    return { estado, desconhecidos, aproximados, avisos };
  }

  function removerAprimoramentos(v) {
    if (Array.isArray(v)) return v.map(removerAprimoramentos);
    if (!ehObjeto(v)) return v;
    const out = {};
    Object.keys(v).forEach((k) => {
      if (!RE_AUGMENT.test(k)) out[k] = removerAprimoramentos(v[k]);
    });
    return out;
  }

  function limparParaGravar(feature, key, value, ctx) {
    const permitidas = CHAVES_PERMITIDAS[feature];
    if (!permitidas || !permitidas.includes(key)) return undefined;
    let v = value;
    const texto = typeof v === 'string';
    if (texto) {
      const t = v.trim();
      if (t[0] === '{' || t[0] === '[') {
        try {
          v = JSON.parse(t);
        } catch (e) {
          return RE_AUGMENT.test(v) ? undefined : v;
        }
      } else {
        return v;
      }
    }
    if (key === 'item_bench') {
      const nome = ctx && typeof ctx.localName === 'string' ? ctx.localName.split('#')[0].trim().toLowerCase() : '';
      if (!nome || !Array.isArray(v)) return undefined;
      v = v.filter((p) => ehObjeto(p) && typeof p.summoner === 'string' && p.summoner.split('#')[0].trim().toLowerCase() === nome);
    }
    v = removerAprimoramentos(v);
    return texto ? JSON.stringify(v) : v;
  }

  function limparEvento(ev) {
    if (!ehObjeto(ev) || !EVENTOS_PERMITIDOS.includes(ev.name)) return undefined;
    return { name: ev.name, data: ev.data == null ? '' : ev.data };
  }

  const api = { FEATURES_GRAVAR, CHAVES_PERMITIDAS, EVENTOS_PERMITIDOS, expandir, acumular, mapId, normalizar, limparParaGravar, limparEvento, removerAprimoramentos };
  root.TFTGepMap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
