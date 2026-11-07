(function () {
  'use strict';
  const CAT = window.TFT_CATALOG;
  const NEWS = window.TFT_NOTICIAS || [];
  const RESUMO = (window.TFT_NOTICIAS_RESUMO || [])[0] || null;
  const L = window.TFTLogic;
  const SVG = 'http://www.w3.org/2000/svg';
  const $ = (sel) => document.querySelector(sel);
  const TIPO_NOME = { buff: 'Buff', nerf: 'Nerf', ajuste: 'Ajuste', item: 'Item', aprimoramento: 'Aprimoramento', 'comp-meta': 'Meta', sistema: 'Sistema' };
  const TIPO_ICONE = { buff: 'up', nerf: 'down', ajuste: 'edit', item: 'hex', aprimoramento: 'star', 'comp-meta': 'star', sistema: 'hex' };
  const state = { tipo: '', patch: '' };

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === false || v == null) return;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v);
    });
    kids.flat().forEach((c) => {
      if (c == null || c === false) return;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  function icon(id) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'ic');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG, 'use');
    use.setAttribute('href', '#i-' + id);
    svg.append(use);
    return svg;
  }

  const br = (d) => (/^\d{4}-\d\d-\d\d$/.test(d || '') ? d.slice(8) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');
  const safeUrl = (u) => (typeof u === 'string' && /^https:\/\/\S+$/.test(u) ? u : null);

  function sourceLink(f, label) {
    const url = f && safeUrl(f.url);
    if (!url) return f && f.nome ? h('span', {}, label + f.nome) : null;
    return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, label + f.nome);
  }

  function renderResumo() {
    if (!RESUMO) return;
    $('#resumo-h').textContent = 'Meta agora · patch ' + RESUMO.patch;
    $('#resumo-meta').textContent = 'No ar desde ' + br(RESUMO.data) + ' · resumo do impacto no meta';
    $('#resumo-linhas').replaceChildren(...RESUMO.linhas.map((l) => h('li', {}, l)));
    $('#resumo-fonte').replaceChildren(...[sourceLink(RESUMO.fonte, 'Fonte: ')].filter(Boolean));
    $('#resumo').hidden = false;
  }

  function chip(label, pressed, onclick) {
    return h('button', { type: 'button', 'aria-pressed': String(pressed), onclick }, label);
  }

  function renderFilters() {
    const tipos = L.newsTypes(NEWS);
    $('#f-tipo').replaceChildren(
      chip('Todos (' + NEWS.length + ')', !state.tipo, () => { state.tipo = ''; render(); }),
      ...tipos.map((t) => chip((TIPO_NOME[t.tipo] || t.tipo) + ' (' + t.n + ')', state.tipo === t.tipo, () => { state.tipo = t.tipo; render(); }))
    );
    $('#f-patch').replaceChildren(
      chip('Todos', !state.patch, () => { state.patch = ''; render(); }),
      ...L.newsPatches(NEWS).map((p) => chip(p, state.patch === p, () => { state.patch = p; render(); }))
    );
  }

  function card(n) {
    const ic = L.newsIcon(n, CAT);
    const box = h('div', { class: 'nicon' });
    if (ic) box.append(h('img', { src: ic.img, alt: ic.alt, width: 48, height: 48, class: /\/traits\//.test(ic.img) ? 'trait' : false, decoding: 'async' }));
    else box.append(icon(TIPO_ICONE[n.tipo] || 'hex'));
    const tipo = TIPO_NOME[n.tipo] || n.tipo;
    return h('article', { class: 'ncard t-' + n.tipo, 'data-id': n.id },
      box,
      h('div', { class: 'nbody' },
        h('div', { class: 'nmeta' }, h('span', { class: 'badge' }, tipo), h('span', {}, 'Patch ' + n.patch), h('time', { datetime: n.data }, br(n.data))),
        h('h3', {}, n.titulo),
        h('p', {}, n.texto),
        n.fonte ? h('a', { class: 'nsrc', href: safeUrl(n.fonte.url) || false, target: '_blank', rel: 'noopener noreferrer' }, 'Fonte: ' + n.fonte.nome) : null));
  }

  function render() {
    renderFilters();
    const list = L.filterNews(NEWS, state);
    $('#news').replaceChildren(...list.map(card));
    $('#nempty').hidden = list.length > 0;
    $('#ncount').textContent = list.length + (list.length === 1 ? ' notícia' : ' notícias');
  }

  const at = window.TFT_NOTICIAS_ATUALIZADO;
  const t = $('#atualizado');
  t.textContent = br(at) || 'data não informada';
  if (/^\d{4}-\d\d-\d\d$/.test(at || '')) t.setAttribute('datetime', at);
  renderResumo();
  render();
})();
