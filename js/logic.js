(function (root) {
  const ROWS = 4;
  const COLS = 7;
  const MAX_COMPS = 200;
  const MAX_MAIN = 12;
  const MAX_FLEX = 8;
  const MAX_ITEMS = 3;
  const MAX_ALT = 6;
  const ECLIPSE = 'DA_18_Eclipse';
  const MAX_FASE = { inicio: 6, meio: 8 };
  const FASE_ORIGENS = ['fonte', 'derivado', 'manual'];
  const MAX_DICAS = 8;
  const MAX_DICA_LINHA = 240;

  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  function indexCatalog(catalog) {
    if (catalog._idx) return catalog._idx;
    const idx = {
      champs: new Map(catalog.champs.map((c) => [c.id, c])),
      traits: new Map(catalog.traits.map((t) => [t.id, t])),
      items: new Map(catalog.items.map((i) => [i.id, i])),
    };
    Object.defineProperty(catalog, '_idx', { value: idx, enumerable: false });
    return idx;
  }

  function tierOf(trait, count) {
    let tier = 0;
    (trait.bp || []).forEach((b, k) => {
      if (count >= b) tier = k + 1;
    });
    return tier;
  }

  function activeTraits(comp, catalog) {
    const idx = indexCatalog(catalog);
    const seen = new Set();
    const counts = new Map();
    (comp.main || []).forEach((u) => {
      if (seen.has(u.c)) return;
      seen.add(u.c);
      const champ = idx.champs.get(u.c);
      if (!champ) return;
      const own = new Set(champ.t);
      (u.i || []).forEach((iid) => {
        const it = idx.items.get(iid);
        if (it && it.tr) own.add(it.tr);
      });
      own.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
    });
    const out = [];
    counts.forEach((count, id) => {
      const trait = idx.traits.get(id);
      if (!trait) return;
      const tier = tierOf(trait, count);
      if (tier > 0) out.push({ id, n: trait.n, img: trait.img, count, tier, bp: trait.bp });
    });
    const solar = counts.get('DA_18_Solar') || 0;
    const lunar = counts.get('DA_18_Lunar') || 0;
    const eclipse = idx.traits.get(ECLIPSE);
    if (eclipse && solar >= 3 && lunar >= 3) {
      out.push({ id: ECLIPSE, n: eclipse.n, img: eclipse.img, count: Math.min(solar, lunar), tier: 1, bp: [] });
    }
    out.sort((a, b) => b.tier - a.tier || b.count - a.count || a.n.localeCompare(b.n, 'pt'));
    return out;
  }

  function allUnits(comp) {
    return (comp.main || []).concat(comp.flex || []);
  }

  function searchComps(comps, query, catalog) {
    const idx = indexCatalog(catalog);
    const tokens = norm(query).split(' ').filter(Boolean);
    const results = [];
    comps.forEach((comp) => {
      const hits = { champs: new Set(), items: new Set(), traits: new Set() };
      if (!tokens.length) {
        results.push({ comp, hits });
        return;
      }
      const traitList = activeTraits(comp, catalog);
      const name = norm(comp.nome);
      let ok = true;
      tokens.forEach((tk) => {
        let found = name.includes(tk) || norm(comp.estilo).includes(tk);
        allUnits(comp).forEach((u) => {
          const champ = idx.champs.get(u.c);
          if (champ && norm(champ.n).includes(tk)) {
            hits.champs.add(u.c);
            found = true;
          }
          (u.i || []).concat(u.a || []).forEach((iid) => {
            const it = idx.items.get(iid);
            if (it && norm(it.n).includes(tk)) {
              hits.items.add(iid);
              found = true;
            }
          });
        });
        traitList.forEach((t) => {
          if (norm(t.n).includes(tk)) {
            hits.traits.add(t.id);
            found = true;
          }
        });
        if (!found) ok = false;
      });
      if (ok) results.push({ comp, hits });
    });
    return results;
  }

  const squash = (s) => norm(s).replace(/[^a-z0-9]/g, '');

  function filterUnits(units, term, catalog) {
    const list = Array.isArray(units) ? units : [];
    const tk = squash(term);
    if (!tk) return list.slice();
    const idx = indexCatalog(catalog);
    return list.filter((u) => {
      const champ = idx.champs.get(u.c);
      return champ && squash(champ.n).includes(tk);
    });
  }

  const MAX_CHECK_COMPS = 500;
  const MAX_CHECK_UNITS = 30;
  const okId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 60;

  function sanitizeChecks(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).slice(0, MAX_CHECK_COMPS).forEach((compId) => {
      if (compId === '__proto__' || !okId(compId) || !Array.isArray(raw[compId])) return;
      const list = [];
      raw[compId].forEach((id) => {
        if (okId(id) && !list.includes(id) && list.length < MAX_CHECK_UNITS) list.push(id);
      });
      if (list.length) out[compId] = list;
    });
    return out;
  }

  function isChecked(checks, compId, champId) {
    const list = checks && Object.prototype.hasOwnProperty.call(checks, compId) ? checks[compId] : null;
    return !!list && list.includes(champId);
  }

  function toggleCheck(checks, compId, champId) {
    const next = Object.assign({}, checks);
    const list = isChecked(checks, compId, champId) ? checks[compId].filter((id) => id !== champId) : (checks[compId] || []).concat(champId);
    if (list.length) next[compId] = list; else delete next[compId];
    return next;
  }

  function clearChecks(checks, compId) {
    const next = Object.assign({}, checks);
    delete next[compId];
    return next;
  }

  function clearAllChecks() {
    return {};
  }

  function summarizeChecks(checks) {
    let n = 0;
    let comps = 0;
    Object.keys(checks || {}).forEach((k) => {
      const list = Array.isArray(checks[k]) ? checks[k] : [];
      if (list.length) { n += list.length; comps++; }
    });
    return { checks: n, comps };
  }

  function phaseChampIds(comp) {
    const f = comp && comp.fases;
    if (!f || typeof f !== 'object') return [];
    const out = [];
    ['inicio', 'meio'].forEach((k) => {
      (Array.isArray(f[k]) ? f[k] : []).forEach((id) => { if (okId(id) && !out.includes(id)) out.push(id); });
    });
    return out;
  }

  function countChecked(checks, comp) {
    const ids = new Set(allUnits(comp).map((u) => u.c).concat(phaseChampIds(comp)));
    let done = 0;
    ids.forEach((id) => { if (isChecked(checks, comp.id, id)) done++; });
    return { done, total: ids.size };
  }

  function newId() {
    const r = Math.random().toString(36).slice(2, 8);
    return 'c-' + Date.now().toString(36) + '-' + r;
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function duplicateComp(comp, id) {
    const copy = clone(comp);
    copy.id = id || newId();
    copy.nome = comp.nome + ' (cópia)';
    return copy;
  }

  function str(v, max) {
    return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
  }

  function uniq(list, valid, max) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach((id) => {
      if (typeof id === 'string' && valid(id) && out.length < max) out.push(id);
    });
    return out;
  }

  function sanitizeFases(raw, idx) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const pick = (list, max) => {
      const out = [];
      (Array.isArray(list) ? list : []).forEach((id) => {
        if (typeof id === 'string' && idx.champs.has(id) && !out.includes(id) && out.length < max) out.push(id);
      });
      return out;
    };
    const inicio = pick(raw.inicio, MAX_FASE.inicio);
    const meio = pick(raw.meio, MAX_FASE.meio);
    if (!inicio.length && !meio.length) return null;
    const fases = { inicio, meio, origem: FASE_ORIGENS.includes(raw.origem) ? raw.origem : 'manual' };
    const ref = str(raw.ref, 100);
    if (ref) fases.ref = ref;
    if (typeof raw.url === 'string' && raw.url.length <= 200 && /^https:\/\/\S+$/.test(raw.url)) fases.url = raw.url;
    return fases;
  }

  function sanitizeDicas(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const linhas = [];
    (Array.isArray(raw.linhas) ? raw.linhas : []).forEach((l) => {
      const t = str(l, MAX_DICA_LINHA);
      if (t && linhas.length < MAX_DICAS) linhas.push(t);
    });
    if (!linhas.length) return null;
    const dicas = { linhas };
    const ref = str(raw.ref, 100);
    if (ref) dicas.ref = ref;
    if (typeof raw.url === 'string' && raw.url.length <= 200 && /^https:\/\/\S+$/.test(raw.url)) dicas.url = raw.url;
    return dicas;
  }

  function sanitizeImport(data, catalog) {
    const idx = indexCatalog(catalog);
    let raw = [];
    if (Array.isArray(data)) raw = data;
    else if (data && typeof data === 'object' && Array.isArray(data.comps)) raw = data.comps;
    let dropped = 0;
    const comps = [];
    const ids = new Set();
    raw.slice(0, MAX_COMPS).forEach((rc) => {
      if (!rc || typeof rc !== 'object' || typeof rc.nome !== 'string' || !rc.nome.trim()) {
        dropped++;
        return;
      }
      const taken = new Set();
      const cleanUnits = (list, max) => {
        const out = [];
        (Array.isArray(list) ? list : []).forEach((ru) => {
          if (!ru || typeof ru !== 'object' || !idx.champs.has(ru.c) || out.length >= max) {
            dropped++;
            return;
          }
          const s = Math.min(3, Math.max(1, parseInt(ru.s, 10) || 1));
          const i = uniq(ru.i, (x) => idx.items.has(x), MAX_ITEMS);
          const a = uniq(ru.a, (x) => idx.items.has(x), MAX_ALT);
          const unit = { c: ru.c, s, i, a };
          if (Array.isArray(ru.p) && ru.p.length === 2) {
            const r = ru.p[0];
            const c = ru.p[1];
            const key = r + ',' + c;
            if (Number.isInteger(r) && Number.isInteger(c) && r >= 1 && r <= ROWS && c >= 1 && c <= COLS && !taken.has(key)) {
              taken.add(key);
              unit.p = [r, c];
            }
          }
          out.push(unit);
        });
        return out;
      };
      let id = typeof rc.id === 'string' && rc.id.length <= 60 ? rc.id : '';
      if (!id || ids.has(id)) id = newId();
      ids.add(id);
      const comp = {
        id,
        nome: str(rc.nome, 80),
        estilo: str(rc.estilo, 40),
        nota: str(rc.nota, 500),
        fonte: str(rc.fonte, 100),
        board: !!rc.board,
        main: cleanUnits(rc.main, MAX_MAIN),
        flex: cleanUnits(rc.flex, MAX_FLEX),
      };
      const fases = sanitizeFases(rc.fases, idx);
      if (fases) comp.fases = fases;
      const dicas = sanitizeDicas(rc.dicas);
      if (dicas) comp.dicas = dicas;
      comps.push(comp);
    });
    return { comps, dropped };
  }

  function validCell(p) {
    return Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] >= 1 && p[0] <= ROWS && p[1] >= 1 && p[1] <= COLS;
  }

  function applySeedPositions(comps, seed, seen, seedVersion) {
    const positioned = [];
    (Array.isArray(seed) ? seed : []).forEach((s) => {
      if (!s || !Number.isInteger(s.posDesde) || s.posDesde <= seen || s.posDesde > seedVersion) return;
      const comp = comps.find((c) => c.id === s.id);
      if (!comp || comp.main.some((u) => u.p)) return;
      const taken = new Set();
      let changed = false;
      (Array.isArray(s.main) ? s.main : []).forEach((su) => {
        const unit = su && comp.main.find((u) => u.c === su.c);
        if (!unit || !validCell(su.p)) return;
        const key = su.p[0] + ',' + su.p[1];
        if (taken.has(key)) return;
        taken.add(key);
        unit.p = [su.p[0], su.p[1]];
        changed = true;
      });
      if (changed) positioned.push(comp.id);
    });
    return positioned;
  }

  function applySeedFases(comps, seed, seen, seedVersion, catalog) {
    const idx = indexCatalog(catalog);
    const applied = [];
    (Array.isArray(seed) ? seed : []).forEach((s) => {
      if (!s || !Number.isInteger(s.fasesDesde) || s.fasesDesde <= seen || s.fasesDesde > seedVersion) return;
      const comp = comps.find((c) => c.id === s.id);
      if (!comp || comp.fases) return;
      const fases = sanitizeFases(s.fases, idx);
      if (!fases) return;
      comp.fases = fases;
      applied.push(comp.id);
    });
    return applied;
  }

  function applySeedDicas(comps, seed, seen, seedVersion) {
    const applied = [];
    (Array.isArray(seed) ? seed : []).forEach((s) => {
      if (!s || !Number.isInteger(s.dicasDesde) || s.dicasDesde <= seen || s.dicasDesde > seedVersion) return;
      const comp = comps.find((c) => c.id === s.id);
      if (!comp || comp.dicas) return;
      const dicas = sanitizeDicas(s.dicas);
      if (!dicas) return;
      comp.dicas = dicas;
      applied.push(comp.id);
    });
    return applied;
  }

  function mergeSeed(stored, seed, seedVersion, catalog) {
    const valid = stored && typeof stored === 'object' && !Array.isArray(stored) && Array.isArray(stored.comps);
    if (!valid) {
      return { comps: sanitizeImport(seed, catalog).comps, seedVersao: seedVersion, excluidos: [], added: [], positioned: [], fasesAplicadas: [], dicasAplicadas: [] };
    }
    const comps = sanitizeImport(stored, catalog).comps;
    const excluidos = [];
    (Array.isArray(stored.excluidos) ? stored.excluidos : []).forEach((id) => {
      if (typeof id === 'string' && id.length <= 60 && !excluidos.includes(id) && excluidos.length < 500) excluidos.push(id);
    });
    const seen = Number.isInteger(stored.seedVersao) ? stored.seedVersao : 1;
    const used = new Set(comps.map((c) => c.id));
    const fresh = (Array.isArray(seed) ? seed : []).filter((s) => s && (Number.isInteger(s.desde) ? s.desde : 1) > seen && !used.has(s.id) && !excluidos.includes(s.id));
    const added = sanitizeImport(fresh, catalog).comps;
    const positioned = applySeedPositions(comps, seed, seen, seedVersion);
    const fasesAplicadas = applySeedFases(comps, seed, seen, seedVersion, catalog);
    const dicasAplicadas = applySeedDicas(comps, seed, seen, seedVersion);
    const seedById = new Map(fresh.map((s) => [s.id, s]));
    const topo = added.filter((c) => seedById.get(c.id).topo === true);
    const back = added.filter((c) => seedById.get(c.id).topo !== true);
    const list = comps.slice();
    const topoIds = new Set((Array.isArray(seed) ? seed : []).filter((s) => s && s.topo === true).map((s) => s.id));
    const leadRun = () => {
      let n = 0;
      while (n < list.length && topoIds.has(list[n].id)) n++;
      return n;
    };
    let pinned = 0;
    topo.forEach((c) => {
      const alvo = seedById.get(c.id).abaixoDe;
      const at = typeof alvo === 'string' ? list.findIndex((x) => x.id === alvo) : -1;
      if (at >= 0 && at < leadRun()) {
        list.splice(at + 1, 0, c);
        pinned = Math.max(pinned + 1, at + 2);
      } else {
        list.splice(pinned, 0, c);
        pinned++;
      }
    });
    return { comps: list.concat(back), seedVersao: Math.max(seen, seedVersion), excluidos, added: added.map((c) => c.id), positioned, fasesAplicadas, dicasAplicadas };
  }

  const FASES_ROTULOS = [
    { key: 'inicio', label: 'Início', hint: 'Estágio 2 · nível 3-5' },
    { key: 'meio', label: 'Meio', hint: 'Estágio 3-4 · nível 6-7' },
  ];

  function phaseBoards(comp, catalog) {
    const f = comp && comp.fases;
    if (!f || typeof f !== 'object') return null;
    const idx = indexCatalog(catalog);
    const unit = (id) => {
      const c = idx.champs.get(id);
      return c ? { c: id, n: c.n, cost: c.c, img: c.img } : null;
    };
    const units = (ids) => (Array.isArray(ids) ? ids : []).map(unit).filter(Boolean);
    const rows = FASES_ROTULOS.map((r) => ({ key: r.key, label: r.label, hint: r.hint, units: units(f[r.key]) }));
    rows.push({ key: 'fim', label: 'Fim', hint: 'Board final', units: units((comp.main || []).map((u) => u.c)) });
    const out = { origem: f.origem, ref: f.ref || '', fases: rows };
    if (f.url) out.url = f.url;
    return out;
  }

  const NEWS_TIPOS = ['buff', 'nerf', 'ajuste', 'item', 'aprimoramento', 'comp-meta', 'sistema'];

  function newsTypes(list) {
    const count = new Map();
    (Array.isArray(list) ? list : []).forEach((n) => { if (n && n.tipo) count.set(n.tipo, (count.get(n.tipo) || 0) + 1); });
    const ordem = NEWS_TIPOS.concat([...count.keys()].filter((t) => !NEWS_TIPOS.includes(t)));
    return ordem.filter((t) => count.has(t)).map((t) => ({ tipo: t, n: count.get(t) }));
  }

  function patchKey(p) {
    const m = /^(\d+)\.(\d+)$/.exec(String(p));
    return m ? Number(m[1]) * 1000 + Number(m[2]) : -1;
  }

  function newsPatches(list) {
    const set = new Set();
    (Array.isArray(list) ? list : []).forEach((n) => { if (n && n.patch) set.add(n.patch); });
    return [...set].sort((a, b) => patchKey(b) - patchKey(a));
  }

  function filterNews(list, f) {
    const tipo = f && f.tipo;
    const patch = f && f.patch;
    return (Array.isArray(list) ? list : []).filter((n) => n && (!tipo || n.tipo === tipo) && (!patch || n.patch === patch));
  }

  function newsIcon(n, catalog) {
    const idx = indexCatalog(catalog);
    const maps = { campeao: idx.champs, traco: idx.traits, item: idx.items };
    const alvos = n && Array.isArray(n.alvos) ? n.alvos : [];
    for (const a of alvos) {
      const hit = a && maps[a.tipo] && a.id ? maps[a.tipo].get(a.id) : null;
      if (hit) return { img: hit.img, alt: hit.n };
    }
    return null;
  }

  const api = { newsTypes, newsPatches, filterNews, newsIcon, ROWS, COLS, MAX_ITEMS, MAX_ALT, MAX_FASE, phaseBoards, norm, indexCatalog, activeTraits, searchComps, filterUnits, sanitizeChecks, isChecked, toggleCheck, clearChecks, clearAllChecks, summarizeChecks, countChecked, phaseChampIds, duplicateComp, sanitizeImport, mergeSeed, newId, clone };
  root.TFTLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
