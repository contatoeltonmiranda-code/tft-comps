(function (root) {
  // Helpers de DOM das paginas Plano e Pos-jogo. Texto sempre por textContent (nunca HTML montado como string).
  const SVG = 'http://www.w3.org/2000/svg';

  function h(tag, attrs, ...filhos) {
    const e = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    filhos.flat().forEach((f) => { if (f != null && f !== false) e.append(f); });
    return e;
  }

  function icone(id) {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('class', 'ic');
    s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(SVG, 'use');
    u.setAttribute('href', '#' + id);
    s.append(u);
    return s;
  }

  // Url so https (ou caminho relativo do proprio site) vai para href.
  const urlSegura = (u) => (typeof u === 'string' && /^https:\/\/\S+$/.test(u) ? u : null);

  const ACT = { UPAR: 'act-upar', FICAR: 'act-ficar', ROLAR: 'act-rolar', GUARDAR: 'act-guardar', PARAR: 'act-parar' };

  // Texto com UPAR / FICAR / ROLAR / GUARDAR / PARAR como badges (cor + palavra), como na Estrategia padrao.
  function comBadges(texto) {
    const partes = String(texto).split(/\b(UPAR|FICAR|ROLAR|GUARDAR|PARAR)\b/);
    return partes.map((p) => (ACT[p] ? h('span', { class: `act ${ACT[p]}`, text: p }) : p));
  }

  const dataBR = (iso) => {
    const d = typeof iso === 'number' ? new Date(iso) : new Date(String(iso));
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const api = { h, icone, urlSegura, comBadges, dataBR, ACT };
  root.TFTDom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
