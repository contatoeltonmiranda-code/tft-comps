(function () {
  'use strict';
  const CAT = window.TFT_CATALOG;
  const SEED = window.TFT_SEED;
  const SEED_VERSION = window.TFT_SEED_VERSION || 1;
  const L = window.TFTLogic;
  const IDX = L.indexCatalog(CAT);
  const KEY = 'tft-comps:v1';
  const PICKS_KEY = 'tft-comps:picks:v1';
  const SVG = 'http://www.w3.org/2000/svg';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const state = { comps: [], query: '', boardOpen: new Map(), draft: null, isNew: false, initial: '', sel: null, excluidos: [], seedVersao: SEED_VERSION, picks: {}, compQuery: new Map(), dicasOpen: new Set() };

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === false || v == null) return;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    kids.flat().forEach((c) => {
      if (c == null || c === false) return;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  function icon(id, cls) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG, 'use');
    use.setAttribute('href', '#i-' + id);
    svg.append(use);
    return svg;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ---------- persistencia ---------- */
  function seedComps() {
    return L.sanitizeImport(SEED, CAT).comps;
  }

  function load() {
    let stored = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) { /* armazenamento corrompido: cai no seed */ }
    const r = L.mergeSeed(stored, SEED, SEED_VERSION, CAT);
    state.excluidos = r.excluidos;
    state.seedVersao = r.seedVersao;
    if (stored && (r.added.length || r.positioned.length || r.fasesAplicadas.length || r.dicasAplicadas.length)) { state.comps = r.comps; save(); }
    if (stored && r.added.length) setTimeout(() => toast(r.added.length === 1 ? '1 comp nova adicionada.' : r.added.length + ' comps novas adicionadas.'), 300);
    return r.comps;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ versao: 1, seedVersao: state.seedVersao, excluidos: state.excluidos, comps: state.comps }));
      return true;
    } catch (e) {
      toast('Não foi possível salvar neste navegador.');
      return false;
    }
  }

  function loadPicks() {
    try {
      const raw = localStorage.getItem(PICKS_KEY);
      return L.sanitizeChecks(raw ? JSON.parse(raw).checks : null);
    } catch (e) { return {}; }
  }

  function savePicks() {
    try {
      localStorage.setItem(PICKS_KEY, JSON.stringify({ versao: 1, checks: state.picks }));
    } catch (e) {
      toast('Não foi possível salvar os checks neste navegador.');
    }
  }

  function updateClearAll() {
    $('#btn-clear-all').disabled = L.summarizeChecks(state.picks).checks === 0;
  }

  async function clearAllPicks() {
    const { checks, comps } = L.summarizeChecks(state.picks);
    if (!checks) return;
    const ok = await ask('Limpar checks', 'Desmarcar ' + checks + (checks === 1 ? ' campeão' : ' campeões') + ' em ' + comps + (comps === 1 ? ' comp' : ' comps') + '? As comps não mudam.', [CANCEL, { label: 'Limpar checks', value: true, kind: 'danger' }]);
    if (!ok) return;
    state.picks = L.clearAllChecks(state.picks);
    savePicks();
    render();
    toast('Checks limpos.');
  }

  function syncExcluidos() {
    const have = new Set(state.comps.map((c) => c.id));
    state.excluidos = SEED.map((c) => c.id).filter((id) => !have.has(id));
    state.seedVersao = SEED_VERSION;
  }

  /* ---------- elementos reutilizaveis ---------- */
  const champ = (id) => IDX.champs.get(id);
  const item = (id) => IDX.items.get(id);

  function starsEl(n) {
    if (n < 2) return null;
    const box = h('span', { class: 'stars s' + n, role: 'img', 'aria-label': n + ' estrelas' });
    for (let i = 0; i < n; i++) box.append(icon('star'));
    return box;
  }

  function img(src, alt, cls, size, lazy) {
    return h('img', { src, alt, class: cls, width: size, height: size, decoding: 'async', loading: lazy ? 'lazy' : false });
  }

  function itemImg(id, alt, hits) {
    const it = item(id);
    const el = img(it.img, it.n + (alt ? ' (alternativo)' : ''), 'item' + (alt ? ' alt' : ''), alt ? 17 : 22);
    el.title = it.n + (alt ? ' (alternativo)' : '');
    if (hits && hits.items.has(id)) el.classList.add('hit');
    return el;
  }

  function unitEl(u, hits, pk) {
    const c = champ(u.c);
    const hit = hits && hits.champs.has(u.c);
    const wrap = h('div', { class: 'unit c' + c.c + (hit ? ' hit' : '') + (pk && pk.on ? ' picked' : '') });
    const portrait = h('div', { class: 'portrait c' + c.c }, img(c.img, c.n, 'pic', 64), starsEl(u.s), h('span', { class: 'cost' }, c.c));
    if (pk) {
      const btn = h('button', { type: 'button', class: 'pick', 'aria-pressed': String(pk.on), 'aria-label': 'Já peguei ' + c.n, title: 'Já peguei', onclick: () => pk.toggle(btn, wrap) }, icon('check'));
      portrait.append(btn);
    }
    wrap.append(
      portrait,
      h('span', { class: 'uname' }, c.n),
      h('div', { class: 'items' }, u.i.map((id) => itemImg(id, false, hits)))
    );
    if (u.a.length) {
      wrap.append(h('div', { class: 'alts', 'aria-label': 'Itens alternativos' }, h('span', { class: 'alt-tag' }, 'alt'), u.a.map((id) => itemImg(id, true, hits))));
    }
    return wrap;
  }

  function boardEl(units, opts) {
    const edit = !!(opts && opts.edit);
    const hits = opts && opts.hits;
    const at = new Map();
    units.forEach((u) => { if (u.p) at.set(u.p[0] + ',' + u.p[1], u); });
    const board = h('div', { class: 'board' + (edit ? ' edit' : ''), role: 'group', 'aria-label': 'Tabuleiro 4 por 7' });
    for (let r = 1; r <= L.ROWS; r++) {
      const row = h('div', { class: 'brow' + (r % 2 === 0 ? ' off' : '') });
      for (let c = 1; c <= L.COLS; c++) {
        const u = at.get(r + ',' + c);
        const info = u ? champ(u.c) : null;
        const cls = 'hex' + (u ? ' has c' + info.c : '') + (u && opts && opts.sel === u ? ' sel' : '') + (u && hits && hits.champs.has(u.c) ? ' hit' : '');
        const label = u ? info.n + ', linha ' + r + ', coluna ' + c : 'Hexágono vazio, linha ' + r + ', coluna ' + c;
        const cell = edit
          ? h('button', { type: 'button', class: cls, 'aria-label': label, 'data-r': r, 'data-c': c, onclick: () => opts.onCell(r, c, u) })
          : h('div', { class: cls, title: u ? info.n : false });
        if (u) {
          cell.append(img(info.img, edit ? '' : info.n, 'pic', 64));
          if (u.s > 1) {
            const st = h('span', { class: 'bstar' });
            for (let i = 0; i < u.s; i++) st.append(icon('star'));
            cell.append(st);
          }
          if (u.i.length) cell.append(h('span', { class: 'bs' }, u.i.map((id) => img(item(id).img, '', '', 14))));
        }
        row.append(cell);
      }
      board.append(row);
    }
    return board;
  }

  function traitEl(t, hits) {
    const ratio = t.bp.length ? t.tier / t.bp.length : 1;
    const tone = ratio >= 1 ? 't-gold' : ratio >= 0.5 ? 't-silver' : 't-bronze';
    const label = t.bp.length ? t.n + ' ' + t.count + ' (' + t.bp.join('/') + ')' : t.n;
    return h('span', { class: 'trait ' + tone + (hits && hits.traits.has(t.id) ? ' hit' : ''), title: label },
      img(t.img, '', '', 20), t.n, t.bp.length ? ' ' + t.count : '');
  }

  function miniEl(u, hits, pk) {
    const on = !!(pk && pk.isOn(u.c));
    const cls = 'mini c' + u.cost + (hits && hits.champs.has(u.c) ? ' hit' : '') + (on ? ' picked' : '');
    const el = h('span', { class: cls, 'data-c': u.c, title: u.n }, img(u.img, u.n, 'pic', 34), h('span', { class: 'cost' }, u.cost));
    if (pk) {
      el.append(h('button', { type: 'button', class: 'pick', 'aria-pressed': String(on), 'aria-label': 'Já peguei ' + u.n, title: 'Já peguei', onclick: () => pk.toggle(u.c) }, icon('check')));
    }
    return el;
  }

  function phasesEl(pb, hits, pk) {
    const box = h('div', { class: 'phases' });
    pb.fases.filter((f) => f.key !== 'fim' && f.units.length).forEach((f) => {
      box.append(h('div', { class: 'phase ' + f.key },
        h('div', { class: 'plabel' }, h('b', {}, f.label), h('small', {}, f.hint)),
        h('div', { class: 'minis' }, f.units.map((u) => miniEl(u, hits, pk)))));
    });
    const ref = pb.ref ? (pb.url ? h('a', { href: pb.url, target: '_blank', rel: 'noopener noreferrer' }, pb.ref) : pb.ref) : null;
    box.append(h('p', { class: 'porigem', title: 'De onde vêm o início e o meio' }, 'Início e meio: ', h('span', { class: 'otag ' + pb.origem }, pb.origem), ref ? ' ' : null, ref));
    return box;
  }

  function dicasEl(comp) {
    const d = comp.dicas;
    if (!d) return null;
    const ref = d.ref ? (d.url ? h('a', { href: d.url, target: '_blank', rel: 'noopener noreferrer' }, d.ref) : d.ref) : null;
    const det = h('details', { class: 'dicas' },
      h('summary', {}, 'Dicas ', h('span', { class: 'dn' }, String(d.linhas.length))),
      h('ul', {}, d.linhas.map((l) => h('li', {}, l))),
      ref ? h('p', { class: 'src' }, 'Fonte das dicas: ', ref) : null);
    det.open = state.dicasOpen.has(comp.id);
    det.addEventListener('toggle', () => { if (det.open) state.dicasOpen.add(comp.id); else state.dicasOpen.delete(comp.id); });
    return det;
  }

  /* ---------- lista ---------- */
  function compEl(comp, hits, multi) {
    const hasBoard = comp.main.some((u) => u.p);
    const open = state.boardOpen.has(comp.id) ? state.boardOpen.get(comp.id) : comp.board;
    const traits = L.activeTraits(comp, CAT);
    const pb = L.phaseBoards(comp, CAT);
    const actions = h('div', { class: 'cact' });
    if (hasBoard) {
      actions.append(h('button', { type: 'button', class: 'icon-btn', 'aria-pressed': String(open), 'aria-label': 'Mostrar tabuleiro', title: 'Tabuleiro', onclick: () => { state.boardOpen.set(comp.id, !open); render(); } }, icon('hex')));
    }
    actions.append(
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Editar ' + comp.nome, title: 'Editar', onclick: () => openEditor(comp) }, icon('edit')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Duplicar ' + comp.nome, title: 'Duplicar', onclick: () => duplicate(comp) }, icon('copy')),
      h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': 'Excluir ' + comp.nome, title: 'Excluir', onclick: () => remove(comp) }, icon('trash'))
    );
    const el = h('article', { class: 'comp', 'data-id': comp.id },
      h('div', { class: 'chead' },
        h('h2', {}, comp.nome),
        comp.estilo ? h('span', { class: 'style' }, comp.estilo) : null,
        multi ? h('span', { class: 'mscore' + (multi.score === multi.total ? ' full' : ''), title: multi.score + ' de ' + multi.total + ' campeões buscados' }, multi.score + '/' + multi.total) : null,
        actions),
      multi ? h('ul', { class: 'mwhere', 'aria-label': 'Onde estão os campeões buscados' }, multi.where.map((w) => h('li', { class: w.fases.length ? 'ok' : 'miss' },
        h('b', {}, w.label), w.fases.length ? w.fases.map((f) => h('span', { class: 'ftag' }, f)) : h('span', { class: 'ftag none' }, 'não tem')))) : null,
      traits.length ? h('div', { class: 'traits', 'aria-label': 'Traços ativos' }, traits.map((t) => traitEl(t, hits))) : null
    );
    const groups = h('div', { class: 'groups' });
    if (!comp.main.length && !comp.flex.length) {
      groups.append(h('p', { class: 'muted' }, 'Sem campeões. Use Editar para adicionar.'));
      el.append(groups);
    } else {
      const count = h('span', { class: 'pcount', 'aria-live': 'polite' });
      const clear = h('button', { type: 'button', class: 'btn ghost sm', 'data-act': 'clear-comp', onclick: () => { state.picks = L.clearChecks(state.picks, comp.id); savePicks(); fill(); } }, 'Limpar checks desta comp');
      const input = h('input', { type: 'search', class: 'cq', autocomplete: 'off', spellcheck: 'false', maxlength: '80', placeholder: 'Buscar campeão na comp (rakan, taric)', 'aria-label': 'Buscar campeão em ' + comp.nome, value: state.compQuery.get(comp.id) || '' });
      const updateCount = () => {
        const { done, total } = L.countChecked(state.picks, comp);
        count.textContent = done + '/' + total + ' pegos';
        count.classList.toggle('done', done === total);
        clear.disabled = done === 0;
        el.querySelectorAll('.mini').forEach((m) => {
          const on = L.isChecked(state.picks, comp.id, m.dataset.c);
          m.classList.toggle('picked', on);
          const b = m.querySelector('.pick');
          if (b) b.setAttribute('aria-pressed', String(on));
        });
        updateClearAll();
      };
      const unit = (u) => unitEl(u, hits, {
        on: L.isChecked(state.picks, comp.id, u.c),
        toggle: (btn, wrap) => {
          state.picks = L.toggleCheck(state.picks, comp.id, u.c);
          const on = L.isChecked(state.picks, comp.id, u.c);
          btn.setAttribute('aria-pressed', String(on));
          wrap.classList.toggle('picked', on);
          savePicks();
          updateCount();
        },
      });
      const fill = () => {
        const term = state.compQuery.get(comp.id) || '';
        const main = L.filterUnits(comp.main, term, CAT);
        const flex = L.filterUnits(comp.flex, term, CAT);
        const nodes = [];
        if (main.length) nodes.push(h('section', { class: 'group' }, h('h3', {}, 'Principal'), h('div', { class: 'units' }, main.map(unit))));
        if (flex.length) nodes.push(h('section', { class: 'group' }, h('h3', {}, 'Flex'), h('div', { class: 'units' }, flex.map(unit))));
        if (!nodes.length) nodes.push(h('p', { class: 'muted cnone' }, 'Nenhum campeão com esse nome nesta comp.'));
        groups.replaceChildren(...nodes);
        updateCount();
      };
      input.addEventListener('input', () => {
        if (input.value.trim()) state.compQuery.set(comp.id, input.value); else state.compQuery.delete(comp.id);
        fill();
      });
      const tools = h('div', { class: 'ctools' }, input, count, clear);
      if (pb) el.append(phasesEl(pb, hits, {
        isOn: (id) => L.isChecked(state.picks, comp.id, id),
        toggle: (id) => { state.picks = L.toggleCheck(state.picks, comp.id, id); savePicks(); fill(); },
      }));
      fill();
      if (pb) el.append(h('div', { class: 'fimhead' }, h('div', { class: 'plabel' }, h('b', {}, 'Fim'), h('small', {}, 'Board final')), tools), groups);
      else el.append(tools, groups);
    }
    if (hasBoard && open) el.append(boardEl(comp.main, { hits }));
    if (comp.nota) el.append(h('p', { class: 'note' }, comp.nota));
    const dk = dicasEl(comp);
    if (dk) el.append(dk);
    if (comp.fonte) el.append(h('p', { class: 'src' }, 'Fonte: ' + comp.fonte));
    return el;
  }

  function renderChips(sr) {
    const box = $('#chips');
    const show = sr.mode === 'multi' || sr.parts.some((p) => p.kind === 'champ');
    box.hidden = !show;
    box.replaceChildren(...(show ? sr.parts.map((p, i) => {
      const c = p.kind === 'champ' && p.ids.length === 1 ? champ(p.ids[0]) : null;
      const txt = p.kind === 'champ' ? p.label + (p.ids.length > 1 ? ' (' + p.ids.length + ')' : '') : p.raw;
      return h('span', { class: 'sq-chip ' + (p.kind === 'champ' ? 'sq-champ' : 'sq-text'), title: p.kind === 'champ' && p.ids.length > 1 ? 'Pode ser: ' + p.names.join(', ') : false },
        c && c.img ? img(c.img, '', 'sq-chip-ico', 22) : false,
        h('span', { class: 'sq-chip-txt' }, txt),
        h('button', { type: 'button', class: 'sq-chip-x', 'aria-label': 'Remover ' + (p.label || p.raw), onclick: () => { state.query = L.removePart(state.query, CAT, i); $('#q').value = state.query; render(); $('#q').focus(); } }, icon('x')));
    }) : []));
  }

  function render() {
    const sr = L.searchMulti(state.comps, state.query, CAT);
    const res = sr.results;
    $('#list').replaceChildren(...res.map((r) => compEl(r.comp, state.query.trim() ? r.hits : null, sr.mode === 'multi' ? r : null)));
    renderChips(sr);
    $('#total').textContent = state.comps.length;
    const q = state.query.trim();
    $('#count').textContent = q ? res.length + ' de ' + state.comps.length : '';
    $('#btn-clear').hidden = !q;
    $('#empty').hidden = res.length > 0;
    $('#empty').textContent = state.comps.length ? 'Nenhuma comp encontrada para essa busca.' : 'Nenhuma comp salva. Crie uma em “Nova comp” ou restaure as originais em Atalhos.';
    updateClearAll();
  }

  /* ---------- dialogs genericos ---------- */
  function ask(title, text, actions) {
    return new Promise((resolve) => {
      const dlg = $('#ask');
      $('#ask-title').textContent = title;
      $('#ask-text').textContent = text;
      let result = null;
      $('#ask-actions').replaceChildren(...actions.map((a) =>
        h('button', { type: 'button', class: 'btn ' + (a.kind || ''), onclick: () => { result = a.value; dlg.close(); } }, a.label)));
      dlg.addEventListener('close', () => resolve(result), { once: true });
      dlg.showModal();
    });
  }
  const CANCEL = { label: 'Cancelar', value: null };

  function pick(kind) {
    return new Promise((resolve) => {
      const dlg = $('#picker');
      const isChamp = kind === 'champ';
      $('#pk-title').textContent = isChamp ? 'Adicionar campeão' : kind === 'alt' ? 'Item alternativo' : 'Item principal';
      const tabsDef = isChamp
        ? [['todos', 'Todos'], ['1', '1 ouro'], ['2', '2 ouros'], ['3', '3 ouros'], ['4', '4 ouros'], ['5', '5 ouros']]
        : [['completo', 'Completos'], ['componente', 'Componentes'], ['artefato', 'Artefatos'], ['emblema', 'Emblemas'], ['radiante', 'Radiantes'], ['todos', 'Todos']];
      let tab = isChamp ? 'todos' : 'completo';
      const q = $('#pk-q');
      q.value = '';
      let chosen = null;
      const grid = $('#pk-grid');
      const pool = isChamp
        ? CAT.champs.slice().sort((a, b) => a.c - b.c || a.n.localeCompare(b.n, 'pt'))
        : CAT.items.slice().sort((a, b) => a.n.localeCompare(b.n, 'pt'));
      const draw = () => {
        const term = L.norm(q.value);
        const list = pool.filter((x) => (tab === 'todos' || (isChamp ? String(x.c) === tab : x.k === tab)) && (!term || L.norm(x.n).includes(term)));
        grid.replaceChildren(...list.map((x) => h('button', {
          type: 'button', class: 'pcell ' + (isChamp ? 'champ c' + x.c : 'itm'), 'data-id': x.id,
          onclick: () => { chosen = x.id; dlg.close(); },
        }, img(x.img, '', '', 52, true), h('span', {}, x.n))));
        $('#pk-empty').hidden = list.length > 0;
      };
      const tabs = $('#pk-tabs');
      const drawTabs = () => tabs.replaceChildren(...tabsDef.map(([v, label]) =>
        h('button', { type: 'button', 'aria-pressed': String(v === tab), onclick: () => { tab = v; drawTabs(); draw(); } }, label)));
      q.oninput = draw;
      drawTabs();
      draw();
      dlg.addEventListener('close', () => resolve(chosen), { once: true });
      dlg.showModal();
      q.focus();
    });
  }

  /* ---------- acoes sobre comps ---------- */
  function duplicate(comp) {
    const copy = L.duplicateComp(comp);
    const i = state.comps.findIndex((c) => c.id === comp.id);
    state.comps.splice(i + 1, 0, copy);
    save();
    render();
    toast('Comp duplicada.');
  }

  async function remove(comp) {
    const ok = await ask('Excluir comp', 'Excluir “' + comp.nome + '”? Essa ação não pode ser desfeita.', [CANCEL, { label: 'Excluir', value: true, kind: 'danger' }]);
    if (!ok) return;
    state.comps = state.comps.filter((c) => c.id !== comp.id);
    state.picks = L.clearChecks(state.picks, comp.id);
    state.compQuery.delete(comp.id);
    savePicks();
    if (SEED.some((c) => c.id === comp.id) && !state.excluidos.includes(comp.id)) state.excluidos.push(comp.id);
    save();
    render();
    toast('Comp excluída.');
  }

  /* ---------- editor ---------- */
  function openEditor(comp) {
    state.isNew = !comp;
    state.draft = comp ? L.clone(comp) : { id: L.newId(), nome: 'Nova comp', estilo: '', nota: '', fonte: '', board: false, main: [], flex: [] };
    state.initial = JSON.stringify(state.draft);
    state.sel = null;
    $('#ed-title').textContent = comp ? 'Editar comp' : 'Nova comp';
    $('#ed-nome').value = state.draft.nome;
    $('#ed-estilo').value = state.draft.estilo;
    $('#ed-nota').value = state.draft.nota;
    $('#ed-showboard').checked = !!state.draft.board;
    renderEditor();
    $('#editor').showModal();
    if (!comp) { $('#ed-nome').focus(); $('#ed-nome').select(); }
  }

  function allDraftUnits() {
    return state.draft.main.concat(state.draft.flex);
  }

  function chip(id, isAlt, onRemove) {
    const it = item(id);
    return h('span', { class: 'chip' + (isAlt ? ' alt' : '') },
      img(it.img, it.n + (isAlt ? ' (alternativo)' : ''), '', 34),
      h('button', { type: 'button', 'aria-label': 'Remover ' + it.n, title: 'Remover ' + it.n, onclick: onRemove }, icon('x')));
  }

  function editorRow(u) {
    const c = champ(u.c);
    const inFlex = state.draft.flex.includes(u);
    const traitNames = c.t.map((t) => IDX.traits.get(t).n).join(' · ');
    const selected = state.sel === u;
    const row = h('li', { class: 'erow' + (selected ? ' sel' : ''), 'data-champ': u.c });
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Estrelas alvo de ' + c.n },
      [1, 2, 3].map((n) => h('button', { type: 'button', 'aria-pressed': String(u.s === n), 'aria-label': n + (n === 1 ? ' estrela' : ' estrelas'), onclick: () => { u.s = n; renderEditor(); } }, String(n), icon('star'))));
    const grp = h('select', { 'aria-label': 'Grupo de ' + c.n, onchange: (e) => moveUnit(u, e.target.value) },
      h('option', { value: 'main', selected: !inFlex }, 'Principal'),
      h('option', { value: 'flex', selected: inFlex }, 'Flex'));
    const posLabel = u.p ? 'Linha ' + u.p[0] + ', col. ' + u.p[1] : 'Posicionar';
    row.append(
      h('div', { class: 'etop' },
        h('div', { class: 'portrait c' + c.c }, img(c.img, c.n, 'pic', 46)),
        h('div', { class: 'nm' }, h('b', {}, c.n), h('span', {}, c.c + ' ouro · ' + traitNames)),
        seg, grp,
        h('button', { type: 'button', class: 'btn', 'aria-pressed': String(selected), disabled: inFlex, onclick: () => { state.sel = selected ? null : u; renderEditor(); } }, icon('hex'), h('span', {}, posLabel)),
        h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': 'Remover ' + c.n, title: 'Remover campeão', onclick: () => { removeUnit(u); } }, icon('trash'))
      ),
      h('div', { class: 'chips' },
        h('span', { class: 'lbl' }, 'Itens'),
        u.i.map((id, k) => chip(id, false, () => { u.i.splice(k, 1); renderEditor(); })),
        h('button', { type: 'button', class: 'addbtn', disabled: u.i.length >= L.MAX_ITEMS, 'data-act': 'add-item', onclick: async () => { const id = await pick('item'); if (id) { u.i.push(id); renderEditor(); } } }, icon('plus'), 'Item')
      ),
      h('div', { class: 'chips' },
        h('span', { class: 'lbl' }, 'Alternativos'),
        u.a.map((id, k) => chip(id, true, () => { u.a.splice(k, 1); renderEditor(); })),
        h('button', { type: 'button', class: 'addbtn', disabled: u.a.length >= L.MAX_ALT, 'data-act': 'add-alt', onclick: async () => { const id = await pick('alt'); if (id) { u.a.push(id); renderEditor(); } } }, icon('plus'), 'Alternativo')
      )
    );
    return row;
  }

  function moveUnit(u, to) {
    const d = state.draft;
    d.main = d.main.filter((x) => x !== u);
    d.flex = d.flex.filter((x) => x !== u);
    if (to === 'flex') { delete u.p; if (state.sel === u) state.sel = null; d.flex.push(u); } else d.main.push(u);
    renderEditor();
  }

  function removeUnit(u) {
    state.draft.main = state.draft.main.filter((x) => x !== u);
    state.draft.flex = state.draft.flex.filter((x) => x !== u);
    if (state.sel === u) state.sel = null;
    renderEditor();
  }

  function onCell(r, c, occupant) {
    const sel = state.sel;
    if (sel && state.draft.main.includes(sel)) {
      if (occupant === sel) return;
      if (occupant) {
        if (sel.p) occupant.p = sel.p.slice(); else delete occupant.p;
      }
      sel.p = [r, c];
    } else if (occupant) {
      state.sel = occupant;
    }
    renderEditor();
  }

  function renderEditor() {
    const units = allDraftUnits();
    $('#ed-units').replaceChildren(...units.map(editorRow));
    $('#ed-units-empty').hidden = units.length > 0;
    $('#ed-board').replaceWith(boardEl(state.draft.main, { edit: true, sel: state.sel, onCell }));
    $('.board.edit').id = 'ed-board';
    const s = state.sel;
    $('#ed-board-hint').textContent = s && state.draft.main.includes(s)
      ? 'Posicionando ' + champ(s.c).n + '. Clique num hexágono; clicar em outra unidade troca de lugar.'
      : 'Escolha um campeão em “Posicionar” e clique num hexágono. Só o grupo Principal entra no tabuleiro.';
    $('#ed-unplace').disabled = !(s && s.p);
  }

  async function requestCloseEditor() {
    const dirty = JSON.stringify(readDraft()) !== state.initial;
    if (dirty) {
      const ok = await ask('Descartar alterações?', 'As mudanças nesta comp ainda não foram salvas.', [{ label: 'Continuar editando', value: null }, { label: 'Descartar', value: true, kind: 'danger' }]);
      if (!ok) return;
    }
    $('#editor').close();
  }

  function readDraft() {
    const d = state.draft;
    d.nome = $('#ed-nome').value;
    d.estilo = $('#ed-estilo').value;
    d.nota = $('#ed-nota').value;
    d.board = $('#ed-showboard').checked;
    return d;
  }

  function saveEditor(e) {
    e.preventDefault();
    const d = readDraft();
    if (!d.nome.trim()) { toast('Dê um nome para a comp.'); $('#ed-nome').focus(); return; }
    const { comps } = L.sanitizeImport([d], CAT);
    if (!comps.length) { toast('Comp inválida.'); return; }
    const clean = comps[0];
    clean.id = d.id;
    const i = state.comps.findIndex((c) => c.id === d.id);
    if (i >= 0) state.comps[i] = clean; else state.comps.unshift(clean);
    if (!save()) return;
    state.initial = JSON.stringify(state.draft);
    $('#editor').close();
    render();
    toast('Comp salva.');
  }

  /* ---------- importar / exportar ---------- */
  function exportJson() {
    const payload = { versao: 1, set: CAT.set, exportadoEm: new Date().toISOString(), comps: state.comps };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = h('a', { href: url, download: 'tft-comps-' + new Date().toISOString().slice(0, 10) + '.json' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Arquivo exportado.');
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('Arquivo grande demais (máx. 2 MB).'); return; }
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { toast('Arquivo inválido: não é um JSON.'); return; }
    const { comps, dropped } = L.sanitizeImport(data, CAT);
    if (!comps.length) { toast('Nenhuma comp válida no arquivo.'); return; }
    const extra = dropped ? ' (' + dropped + ' item(ns) inválido(s) ignorado(s))' : '';
    const mode = await ask('Importar comps', comps.length + ' comp(s) no arquivo' + extra + '. O que fazer?', [
      CANCEL,
      { label: 'Substituir tudo', value: 'replace', kind: 'danger' },
      { label: 'Adicionar às existentes', value: 'merge', kind: 'primary' },
    ]);
    if (!mode) return;
    if (mode === 'replace') { state.comps = comps; syncExcluidos(); }
    else {
      const used = new Set(state.comps.map((c) => c.id));
      comps.forEach((c) => { if (used.has(c.id)) c.id = L.newId(); used.add(c.id); });
      state.comps = state.comps.concat(comps);
    }
    save();
    render();
    toast(comps.length + ' comp(s) importada(s).');
  }

  /* ---------- eventos ---------- */
  function typing(t) {
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  function toggleHelp() {
    const dlg = $('#help');
    if (dlg.open) dlg.close(); else dlg.showModal();
  }

  function init() {
    state.comps = load();
    state.picks = loadPicks();
    render();
    $('#q').addEventListener('input', (e) => { state.query = e.target.value; render(); });
    $('#btn-clear').addEventListener('click', () => { state.query = ''; $('#q').value = ''; render(); $('#q').focus(); });
    $('#btn-new').addEventListener('click', () => openEditor(null));
    $('#btn-help').addEventListener('click', toggleHelp);
    $('#btn-clear-all').addEventListener('click', clearAllPicks);
    $('#help-close').addEventListener('click', () => $('#help').close());
    $('#btn-export').addEventListener('click', exportJson);
    $('#btn-import').addEventListener('click', () => $('#file').click());
    $('#file').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; importFile(f); });
    $('#btn-reset').addEventListener('click', async () => {
      const ok = await ask('Restaurar originais', 'Substituir todas as comps atuais pelas ' + SEED.length + ' comps originais?', [CANCEL, { label: 'Restaurar', value: true, kind: 'danger' }]);
      if (!ok) return;
      state.comps = seedComps();
      state.excluidos = [];
      state.seedVersao = SEED_VERSION;
      save();
      render();
      $('#help').close();
      toast('Comps originais restauradas.');
    });
    $('#ed-form').addEventListener('submit', saveEditor);
    $('#ed-close').addEventListener('click', requestCloseEditor);
    $('#ed-cancel').addEventListener('click', requestCloseEditor);
    $('#editor').addEventListener('cancel', (e) => { e.preventDefault(); requestCloseEditor(); });
    $('#ed-add-champ').addEventListener('click', async () => {
      const id = await pick('champ');
      if (!id) return;
      if (allDraftUnits().some((u) => u.c === id)) { toast(champ(id).n + ' já está na comp.'); return; }
      state.draft.main.push({ c: id, s: 1, i: [], a: [] });
      renderEditor();
    });
    $('#ed-unplace').addEventListener('click', () => { if (state.sel) { delete state.sel.p; renderEditor(); } });
    $('#pk-close').addEventListener('click', () => $('#picker').close());
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === '?' || (e.key === '/' && e.shiftKey)) && !typing(e.target)) { e.preventDefault(); toggleHelp(); return; }
      if (typing(e.target) || document.querySelector('dialog[open]')) return;
      if (e.key === '/') { e.preventDefault(); $('#q').focus(); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openEditor(null); }
      else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); clearAllPicks(); }
    });
  }

  init();
})();
