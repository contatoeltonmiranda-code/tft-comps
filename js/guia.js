(function (root) {
  const MIN = 2;

  // 1 caractere de entrada = 1 de saida, para os indices do texto dobrado valerem no original.
  function fold(s) {
    let out = '';
    for (const ch of String(s)) {
      const base = ch.normalize('NFD')[0].toLowerCase();
      out += base.length === ch.length ? base : ch;
    }
    return out;
  }

  function findRanges(text, query) {
    const q = fold(query).trim().replace(/\s+/g, ' ');
    if (q.length < MIN) return [];
    const hay = fold(text);
    const res = [];
    for (let i = hay.indexOf(q); i !== -1; i = hay.indexOf(q, i + q.length)) res.push([i, i + q.length]);
    return res;
  }

  const api = { fold, findRanges };
  root.GuiaBusca = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document === 'undefined') return;

  const $ = (id) => document.getElementById(id);
  const input = $('gq');
  const count = $('gcount');
  const clear = $('gclear');
  const empty = $('gempty');
  const guia = $('guia');
  const tocD = $('toc-d');
  if (!input || !guia) return;

  const sections = [...guia.querySelectorAll('.gsec')];
  const tocLinks = [...document.querySelectorAll('#toc a')];
  const heads = [...guia.querySelectorAll('h2')];
  let marks = [];
  let cur = -1;

  /* indice: aberto no desktop, recolhido no mobile */
  const wide = window.matchMedia('(min-width: 1000px)');
  const syncToc = () => { tocD.open = wide.matches; };
  syncToc();
  wide.addEventListener('change', syncToc);
  document.getElementById('toc').addEventListener('click', (e) => {
    if (e.target.closest('a') && !wide.matches) tocD.open = false;
  });

  /* scrollspy */
  let ticking = false;
  function spy() {
    ticking = false;
    let active = 0;
    heads.forEach((h, i) => { if (h.getBoundingClientRect().top <= 140) active = i; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) active = heads.length - 1;
    tocLinks.forEach((a, i) => { if (i === active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
  window.addEventListener('resize', spy);
  spy();

  /* busca: destaca e esconde secoes sem ocorrencia */
  function unmark() {
    guia.querySelectorAll('mark.hit').forEach((m) => {
      const p = m.parentNode;
      p.replaceChild(document.createTextNode(m.textContent), m);
      p.normalize();
    });
    marks = [];
    cur = -1;
  }

  function textNodes(sec) {
    const w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
    const list = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim()) list.push(n);
    return list;
  }

  function markNode(node, ranges) {
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();
    let pos = 0;
    ranges.forEach(([a, b]) => {
      if (a > pos) frag.appendChild(document.createTextNode(text.slice(pos, a)));
      const m = document.createElement('mark');
      m.className = 'hit';
      m.textContent = text.slice(a, b);
      frag.appendChild(m);
      pos = b;
    });
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    node.parentNode.replaceChild(frag, node);
  }

  function search(q) {
    unmark();
    const active = fold(q).trim().length >= MIN;
    clear.hidden = !input.value;
    if (!active) {
      sections.forEach((s) => { s.hidden = false; });
      tocLinks.forEach((a) => { a.parentNode.hidden = false; });
      empty.hidden = true;
      count.textContent = '';
      return;
    }
    let total = 0;
    let shown = 0;
    sections.forEach((sec) => {
      let n = 0;
      textNodes(sec).forEach((node) => {
        const r = findRanges(node.nodeValue, q);
        if (r.length) { n += r.length; markNode(node, r); }
      });
      sec.hidden = n === 0;
      const h = sec.querySelector('h2');
      if (h) {
        const link = tocLinks.find((a) => a.getAttribute('href') === '#' + h.id);
        if (link) link.parentNode.hidden = n === 0;
      }
      total += n;
      if (n) shown++;
    });
    marks = [...guia.querySelectorAll('mark.hit')];
    empty.hidden = total > 0;
    count.textContent = total ? `${total} ${total === 1 ? 'ocorrência' : 'ocorrências'} em ${shown} ${shown === 1 ? 'seção' : 'seções'}` : 'Nenhum resultado';
  }

  function step(dir) {
    if (!marks.length) return;
    if (cur >= 0) marks[cur].classList.remove('cur');
    cur = (cur + dir + marks.length) % marks.length;
    marks[cur].classList.add('cur');
    marks[cur].scrollIntoView({ block: 'center' });
  }

  let timer;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => search(input.value), 120); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); if (!marks.length) search(input.value); step(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { input.value = ''; search(''); }
  });
  clear.addEventListener('click', () => { input.value = ''; search(''); input.focus(); });
  /* atalhos do topo (checklist, resumo): se a busca escondeu o alvo, limpa antes de ir */
  document.querySelectorAll('.quick a').forEach((a) => a.addEventListener('click', () => { if (input.value) { input.value = ''; search(''); } }));
})(typeof window !== 'undefined' ? window : globalThis);
