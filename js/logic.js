(function (root) {
  const ROWS = 4;
  const COLS = 7;
  const MAX_COMPS = 200;
  const MAX_MAIN = 12;
  const MAX_FLEX = 8;
  const MAX_ITEMS = 3;
  const MAX_ALT = 6;
  const ECLIPSE = 'DA_18_Eclipse';

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
      comps.push({
        id,
        nome: str(rc.nome, 80),
        estilo: str(rc.estilo, 40),
        nota: str(rc.nota, 500),
        fonte: str(rc.fonte, 100),
        board: !!rc.board,
        main: cleanUnits(rc.main, MAX_MAIN),
        flex: cleanUnits(rc.flex, MAX_FLEX),
      });
    });
    return { comps, dropped };
  }

  function mergeSeed(stored, seed, seedVersion, catalog) {
    const valid = stored && typeof stored === 'object' && !Array.isArray(stored) && Array.isArray(stored.comps);
    if (!valid) {
      return { comps: sanitizeImport(seed, catalog).comps, seedVersao: seedVersion, excluidos: [], added: [] };
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
    return { comps: comps.concat(added), seedVersao: Math.max(seen, seedVersion), excluidos, added: added.map((c) => c.id) };
  }

  const api = { ROWS, COLS, MAX_ITEMS, MAX_ALT, norm, indexCatalog, activeTraits, searchComps, duplicateComp, sanitizeImport, mergeSeed, newId, clone };
  root.TFTLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
