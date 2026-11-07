// Gera guia.html a partir de data/guia-do-jogo.md + tools/guia-template.html.
// Uso: node tools/gen-guia.js   (sem dependencias; o texto do .md vai para o HTML sem alteracao)
const fs = require('fs');
const path = require('path');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\(Google, não confirmado\)/g, '<span class="nc">(Google, não confirmado)</span>')
    .replace(/\(Set 18\)/g, '<span class="s18">(Set 18)</span>');
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

function table(rows, label) {
  const head = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  const cls = head.length >= 3 ? ` class="tc${Math.min(head.length, 5)}"` : '';
  const th = head.map((h) => `<th scope="col">${inline(h)}</th>`).join('');
  const trs = body.map((r) => '<tr>' + r.map((c, i) => (i === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('') + '</tr>').join('\n');
  return `<div class="tbl" role="region" tabindex="0" aria-label="${esc('Tabela: ' + label)}">\n<table${cls}>\n<thead><tr>${th}</tr></thead>\n<tbody>\n${trs}\n</tbody>\n</table>\n</div>`;
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

function render(md) {
  const lines = md.split(/\r?\n/);
  const seen = new Set();
  const toc = [];
  let h1 = '';
  let out = '';
  let open = false;
  let label = '';
  let i = 0;

  const closeSection = () => { if (open) out += '</section>\n'; open = false; };
  const openSection = (html) => { closeSection(); out += html; open = true; };
  openSection('<section class="gsec gintro">\n');

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m;
    if ((m = line.match(/^# (.+)$/))) { h1 = esc(m[1]); i++; continue; }
    if ((m = line.match(/^## (.+)$/))) {
      const id = slug(m[1], seen);
      toc.push({ id, text: m[1] });
      label = m[1];
      openSection(`<section class="gsec${id === 'notas-sobre-as-fontes' ? ' fontes' : ''}" aria-labelledby="${id}">\n<h2 id="${id}">${esc(m[1])}</h2>\n`);
      i++; continue;
    }
    if ((m = line.match(/^### (.+)$/))) {
      label = m[1];
      out += `<h3 id="${slug(m[1], seen)}">${esc(m[1])}</h3>\n`;
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
      out += table(rows, label || h1) + '\n';
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

function build(md, template) {
  const r = render(md);
  return template.replace('{{H1}}', () => r.h1).replace('{{TOC}}', () => r.toc).replace('{{CONTENT}}', () => r.content);
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const md = fs.readFileSync(path.join(root, 'data/guia-do-jogo.md'), 'utf8');
  const tpl = fs.readFileSync(path.join(__dirname, 'guia-template.html'), 'utf8');
  fs.writeFileSync(path.join(root, 'guia.html'), build(md, tpl));
  console.log('guia.html gerado');
}

module.exports = { render, build, inline, slug };
