// Gera as paginas de texto (guia.html, estrategia.html) a partir de data/*.md + tools/pagina-template.html.
// Uso: node tools/gen-guia.js   (sem dependencias; o texto do .md vai para o HTML sem alteracao)
// Uma pagina nova = uma entrada em PAGES (arquivo .md, saida, meta tags, opcoes de renderizacao).
const fs = require('fs');
const path = require('path');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

const ACOES = /(?<![\p{L}])(?:UPAR|UPANDO|FICAR|ROLAR|ROLA|ROLE|GUARDAR|PARAR)(?: \d)?(?![\p{L}])/gu;
const acaoClasse = (t) => ({ UPAR: 'upar', UPANDO: 'upar', FICAR: 'ficar', ROLAR: 'rolar', ROLA: 'rolar', ROLE: 'rolar', GUARDAR: 'guardar', PARAR: 'parar' })[t.split(' ')[0]];

// opts.acoes: destaca UPAR/FICAR/ROLAR/GUARDAR/PARAR (so estilo; o texto nao muda)
function inline(text, opts) {
  let h = esc(text)
    .replace(/\*(\(regra derivada do guia[^*]*\))\*/g, '<em class="rd">$1</em>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\(Google, não confirmado\)/g, '<span class="nc">(Google, não confirmado)</span>')
    .replace(/\(Set 18(?:, [^)]*)?\)/g, '<span class="s18">$&</span>')
    .replace(/\(divergência\)/g, '<span class="dv">(divergência)</span>');
  if (opts && opts.acoes) h = h.replace(ACOES, (t) => `<span class="act act-${acaoClasse(t)}">${t}</span>`);
  return h;
}

function slug(text, seen) {
  const base = String(text)
    .replace(/^\d+\.\s*/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'secao';
  let id = base;
  for (let n = 2; seen.has(id); n++) id = base + '-' + n;
  seen.add(id);
  return id;
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isSep = (l) => /^\s*\|[\s|:-]+\|\s*$/.test(l || '');
const LIST = /^(\s*)(-|\d+\.)\s+(.*)$/;


function table(rows, label, opts) {
  const head = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  const cls = head.length >= 3 ? ` class="tc${Math.min(head.length, 5)}"` : '';
  const th = head.map((h) => (h ? `<th scope="col">${inline(h, opts)}</th>` : '<th scope="col" aria-label="Critério"></th>')).join('');
  const td = (c, i) => (i === 0 ? `<th scope="row">${inline(c, opts)}</th>` : `<td${opts.stack ? ` data-label="${esc(head[i] || '')}"` : ''}>${inline(c, opts)}</td>`);
  const trs = body.map((r) => '<tr>' + r.map(td).join('') + '</tr>').join('\n');
  return `<div class="tbl${opts.stack ? ' stack' : ''}" role="region" tabindex="0" aria-label="${esc('Tabela: ' + label)}">\n<table${cls}>\n<thead><tr>${th}</tr></thead>\n<tbody>\n${trs}\n</tbody>\n</table>\n</div>`;
}

function list(items) {
  let i = 0;
  function level(indent) {
    const ordered = /\d/.test(items[i].marker);
    const tag = ordered ? 'ol' : 'ul';
    let out = `<${tag}>`;
    while (i < items.length && items[i].indent >= indent) {
      const it = items[i++];
      out += '<li>' + inline(it.text);
      if (i < items.length && items[i].indent > it.indent) out += level(items[i].indent);
      out += '</li>';
    }
    return out + `</${tag}>`;
  }
  return level(items[0].indent);
}

// opts.acoes: badges de acao nas tabelas | opts.stack: tabela vira cartoes no mobile
// opts.caixaH2 / opts.caixaH3: slugs de secao/subtitulo destacados em caixa | opts.h3Escopo: id do h3 prefixado pelo h2
function render(md, opts) {
  opts = opts || {};
  const topts = { acoes: !!opts.acoes, stack: !!opts.stack };
  const caixaH2 = opts.caixaH2 || [];
  const caixaH3 = opts.caixaH3 || [];
  const lines = md.split(/\r?\n/);
  const seen = new Set();
  const toc = [];
  let h1 = '';
  let out = '';
  let open = false;
  let box = false;
  let h2id = '';
  let label = '';
  let i = 0;

  const closeBox = () => { if (box) out += '</div>\n'; box = false; };
  const closeSection = () => { closeBox(); if (open) out += '</section>\n'; open = false; };
  const openSection = (html) => { closeSection(); out += html; open = true; };
  openSection('<section class="gsec gintro">\n');

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m;
    if ((m = line.match(/^# (.+)$/))) { h1 = esc(m[1]); i++; continue; }
    if ((m = line.match(/^## (.+)$/))) {
      const id = slug(m[1], seen);
      h2id = id;
      toc.push({ id, text: m[1] });
      label = m[1];
      const cls = 'gsec' + (id === 'notas-sobre-as-fontes' ? ' fontes' : '') + (caixaH2.includes(id) ? ' caixa' : '');
      openSection(`<section class="${cls}" aria-labelledby="${id}">\n<h2 id="${id}">${esc(m[1])}</h2>\n`);
      i++; continue;
    }
    if ((m = line.match(/^### (.+)$/))) {
      label = m[1];
      closeBox();
      const isBox = caixaH3.includes(slug(m[1], new Set()));
      const id = opts.h3Escopo && !isBox ? slug(h2id + ' ' + m[1], seen) : slug(m[1], seen);
      if (isBox) { out += '<div class="caixa">\n'; box = true; }
      out += `<h3 id="${id}">${esc(m[1])}</h3>\n`;
      i++; continue;
    }
    if (/^>/.test(line)) {
      const paras = [[]];
      while (i < lines.length && /^>/.test(lines[i])) {
        const t = lines[i].replace(/^>\s?/, '').trim();
        if (!t) paras.push([]); else paras[paras.length - 1].push(t);
        i++;
      }
      out += '<blockquote class="nota">' + paras.filter((p) => p.length).map((p) => `<p>${inline(p.join(' '))}</p>`).join('') + '</blockquote>\n';
      continue;
    }
    if (/^\|/.test(line) && isSep(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      out += table(rows, label || h1, topts) + '\n';
      continue;
    }
    if (LIST.test(line)) {
      const items = [];
      while (i < lines.length && LIST.test(lines[i])) {
        const mm = lines[i].match(LIST);
        items.push({ indent: mm[1].length, marker: mm[2], text: mm[3] });
        i++;
      }
      out += list(items) + '\n';
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#|>|\|)/.test(lines[i]) && !LIST.test(lines[i])) para.push(lines[i++].trim());
    out += `<p>${inline(para.join(' '))}</p>\n`;
  }
  closeSection();

  const tocHtml = '<ul>\n' + toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('\n') + '\n</ul>';
  return { h1, toc: tocHtml, content: out };
}

const NAV = [
  ['index.html', 'Comps'],
  ['plano.html', 'Plano'],
  ['painel.html', 'Painel'],
  ['posjogo.html', 'Pós-jogo'],
  ['guia.html', 'Guia do Jogo'],
  ['estrategia.html', 'Estratégia padrão'],
  ['noticias.html', 'Notícias'],
];

function nav(active) {
  const links = NAV.map(([href, text]) => `    <a class="navlink" href="${href}"${href === active ? ' aria-current="page"' : ''}>${text}</a>`).join('\n');
  return `<nav class="sitenav" aria-label="Páginas do site">\n  <div class="sitenav-in">\n${links}\n  </div>\n</nav>`;
}

const PAGES = {
  guia: {
    md: 'guia-do-jogo.md',
    out: 'guia.html',
    title: 'Guia do Jogo de TFT: economia, nível e rolagem',
    desc: 'Guia do Jogo de Teamfight Tactics (Set 18): economia e juros, quando subir de nível, quando rolar e estilos de jogo, em consulta rápida na partida.',
    ogDesc: 'Economia, juros, nível, rolagem e estilos de jogo do Teamfight Tactics (Set 18), em consulta rápida.',
    sub: 'Set 18 · Selvas Encantadas',
    searchLabel: 'Buscar no guia',
    placeholder: 'Buscar no guia (ex.: juros, fast 8, 3-2)',
    tocLabel: 'Índice do guia',
    empty: 'Nada no guia para essa busca.',
    quick: [],
    render: {},
  },
  estrategia: {
    md: 'estrategia-padrao.md',
    out: 'estrategia.html',
    title: 'Estratégia padrão de TFT: Fast 8, Reroll e Fast 9',
    desc: 'Estratégia padrão de TFT (Set 18): quando upar, ficar, rolar ou guardar no Fast 8, Reroll e Fast 9, com leitura de jogo padronizada e checklist de 30 segundos.',
    ogDesc: 'Quando upar, ficar, rolar ou guardar no Fast 8, Reroll e Fast 9 do Teamfight Tactics (Set 18), com checklist de 30 segundos.',
    sub: 'Set 18 · Selvas Encantadas · patch 18.6',
    searchLabel: 'Buscar na estratégia',
    placeholder: 'Buscar na estratégia (ex.: fast 9, 4-2)',
    tocLabel: 'Índice da estratégia',
    empty: 'Nada na estratégia para essa busca.',
    quick: [['checklist-de-30-segundos', 'Checklist rápido'], ['resumo-de-bolso', 'Resumo de bolso']],
    render: { acoes: true, stack: true, h3Escopo: true, caixaH2: ['resumo-de-bolso'], caixaH3: ['checklist-de-30-segundos'] },
  },
};

function quick(links) {
  if (!links.length) return '';
  const a = links.map(([id, t], k) => `    <a class="btn${k === 0 ? ' primary' : ''}" href="#${id}">${esc(t)}</a>`).join('\n');
  return `  <nav class="quick" aria-label="Atalhos">\n${a}\n  </nav>\n\n`;
}

function build(md, template, page) {
  const r = render(md, page.render);
  const vars = {
    TITLE: esc(page.title), DESC: esc(page.desc), OGDESC: esc(page.ogDesc), MD: page.md,
    NAV: nav(page.out), H1: r.h1, SUB: esc(page.sub), SEARCHLABEL: esc(page.searchLabel), PLACEHOLDER: esc(page.placeholder),
    QUICK: quick(page.quick), TOCLABEL: esc(page.tocLabel), TOC: r.toc, CONTENT: r.content, EMPTY: esc(page.empty),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error('placeholder desconhecido: ' + k);
    return vars[k];
  });
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const tpl = fs.readFileSync(path.join(__dirname, 'pagina-template.html'), 'utf8');
  Object.values(PAGES).forEach((page) => {
    const md = fs.readFileSync(path.join(root, 'data', page.md), 'utf8');
    fs.writeFileSync(path.join(root, page.out), build(md, tpl, page));
    console.log(page.out + ' gerado');
  });
}

module.exports = { render, build, inline, slug, nav, PAGES, NAV };
