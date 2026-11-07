const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FONTE = path.join(ROOT, '../../3. copywriter/Projetos/tft-guia-do-jogo/GUIA-DO-JOGO.md');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MD = read('data/guia-do-jogo.md');
const gen = require('../tools/gen-guia.js');
const { decode, htmlWords, mdWords, mdTables, lf } = require('./_texto.js');
const busca = require('../js/guia.js');
const PG = gen.PAGES.guia;
const OUT = gen.render(MD, PG.render);
const PAGE = read('guia.html');

test('guia: 13 secoes h2 com ids unicos e indice com ancoras para todas', () => {
  const h2 = [...OUT.content.matchAll(/<h2 id="([^"]+)">([^<]*)<\/h2>/g)];
  assert.equal(h2.length, 13);
  assert.equal(new Set(h2.map((m) => m[1])).size, 13);
  const toc = [...OUT.toc.matchAll(/<a href="#([^"]+)">([^<]*)<\/a>/g)];
  assert.deepEqual(toc.map((m) => m[1]), h2.map((m) => m[1]));
  assert.deepEqual(toc.map((m) => decode(m[2])), h2.map((m) => decode(m[2])));
  assert.equal(decode(toc[0][2]), '1. Glossário rápido');
  assert.equal(decode(toc[12][2]), 'Notas sobre as fontes');
});

test('guia: todo id e unico na pagina e todo href #x aponta para um id existente', () => {
  const ids = [...PAGE.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'ids duplicados');
  [...PAGE.matchAll(/href="#([^"]+)"/g)].forEach((m) => assert.ok(ids.includes(m[1]), 'ancora sem alvo: ' + m[1]));
});

test('guia: texto fiel ao .md (mesma sequencia de palavras, com acentos)', () => {
  const mdw = mdWords(MD);
  const htw = htmlWords(OUT.h1 + ' ' + OUT.content);
  for (let i = 0; i < mdw.length; i++) assert.equal(htw[i], mdw[i], 'palavra ' + i + ' perto de: ' + mdw.slice(Math.max(0, i - 4), i + 3).join(' '));
  assert.equal(htw.length, mdw.length, 'quantidade de palavras');
});

test('guia: tabelas do .md viram tabelas responsivas com a mesma grade', () => {
  const mdT = mdTables(MD);
  assert.ok(mdT.length >= 12);
  const wraps = [...OUT.content.matchAll(/<div class="tbl"([^>]*)>\s*<table[^>]*>([\s\S]*?)<\/table>\s*<\/div>/g)];
  assert.equal(wraps.length, mdT.length);
  assert.equal((OUT.content.match(/<table/g) || []).length, mdT.length);
  wraps.forEach((t, k) => {
    assert.match(t[1], /tabindex="0"/);
    assert.match(t[1], /role="region"/);
    assert.match(t[1], /aria-label="Tabela: [^"]+"/);
    assert.equal((t[2].match(/<tr>/g) || []).length, mdT[k].rows + 1, 'linhas tabela ' + k);
    const head = t[2].match(/<thead>([\s\S]*?)<\/thead>/)[1];
    assert.equal((head.match(/<th\b/g) || []).length, mdT[k].cols, 'colunas tabela ' + k);
  });
});

test('guia: notas e marcadores de incerteza tem estilo proprio', () => {
  const blocos = MD.split(/\r?\n/).filter((l, i, a) => /^>/.test(l) && !/^>/.test(a[i - 1] || '')).length;
  assert.ok(blocos >= 8);
  assert.equal((OUT.content.match(/<blockquote class="nota">/g) || []).length, blocos);
  assert.ok(/<span class="nc">\(Google, não confirmado\)<\/span>/.test(OUT.content));
  assert.ok(/<span class="s18">\(Set 18\)<\/span>/.test(OUT.content));
});

test('guia: inline escapa HTML e converte negrito', () => {
  assert.equal(gen.inline('a <b> & "c" **x**'), 'a &lt;b&gt; &amp; &quot;c&quot; <strong>x</strong>');
  assert.equal(gen.inline('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('guia: slug sem acento, sem numero e sem repeticao', () => {
  const seen = new Set();
  assert.equal(gen.slug('1. Glossário rápido', seen), 'glossario-rapido');
  assert.equal(gen.slug('Glossário rápido', seen), 'glossario-rapido-2');
  assert.equal(gen.slug('Câmbio & "Ação"', new Set()), 'cambio-acao');
});

test('guia: guia.html gerado esta em dia com o .md (rode node tools/gen-guia.js)', () => {
  assert.equal(lf(PAGE), lf(gen.build(MD, read('tools/pagina-template.html'), PG)));
});

test('guia: cabecalho SEO e sem dependencia externa', () => {
  const title = PAGE.match(/<title>([^<]*)<\/title>/)[1];
  const desc = PAGE.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.ok(title.length <= 60, 'title ' + title.length);
  assert.ok(/guia/i.test(title) && /tft/i.test(title));
  assert.ok(desc.length >= 140 && desc.length <= 160, 'description ' + desc.length);
  assert.ok(!/Em breve/i.test(PAGE));
  assert.ok(!/<script[^>]+src="https?:/i.test(PAGE) && !/<link[^>]+href="https?:/i.test(PAGE));
  assert.ok(!/<script>/i.test(PAGE), 'sem script inline');
  assert.match(PAGE, /<script src="js\/guia\.js"><\/script>/);
  assert.equal((PAGE.match(/<h1\b/g) || []).length, 1);
  assert.match(PAGE, /og:title/);
  assert.match(PAGE, /twitter:card/);
});

test('navegacao: 5 paginas com os mesmos 5 links, ativo correto e sem badge Em breve', () => {
  const pages = { 'index.html': 'Comps', 'painel.html': 'Painel', 'guia.html': 'Guia do Jogo', 'estrategia.html': 'Estratégia padrão', 'noticias.html': 'Notícias' };
  Object.entries(pages).forEach(([file, ativo]) => {
    const html = read(file);
    assert.ok(!/class="soon"|Em breve/.test(html), file + ' sem badge');
    const nav = html.match(/<nav class="sitenav"[\s\S]*?<\/nav>/)[0];
    const links = [...nav.matchAll(/<a class="navlink" href="([^"]+)"([^>]*)>([^<]*)<\/a>/g)].map((m) => ({ h: m[1], cur: /aria-current="page"/.test(m[2]), t: m[3].trim() }));
    assert.deepEqual(links.map((l) => l.h), ['index.html', 'painel.html', 'guia.html', 'estrategia.html', 'noticias.html']);
    assert.deepEqual(links.map((l) => l.t), ['Comps', 'Painel', 'Guia do Jogo', 'Estratégia padrão', 'Notícias']);
    assert.deepEqual(links.filter((l) => l.cur).map((l) => l.t), [ativo]);
    assert.equal(lf(nav), lf(gen.nav(file)), file + ' nav igual ao gerador');
  });
});

test('busca: fold preserva o tamanho (indices 1:1) e ignora acento e caixa', () => {
  const s = 'Guardá Ação — Nível 8 ★ ÇÃO';
  assert.equal(busca.fold(s).length, s.length);
  assert.equal(busca.fold(s), 'guarda acao — nivel 8 ★ cao');
});

test('busca: findRanges acha trechos sem depender de acento e respeita minimo', () => {
  const t = 'O nível 8 é o spike. Nivel alto, NÍVEL baixo.';
  assert.deepEqual(busca.findRanges(t, 'nivel'), [[2, 7], [21, 26], [33, 38]]);
  assert.deepEqual(busca.findRanges(t, 'n'), []);
  assert.deepEqual(busca.findRanges(t, '  '), []);
  assert.deepEqual(busca.findRanges('fast 8 e fast 9', 'fast 8'), [[0, 6]]);
  assert.deepEqual(busca.findRanges('a+b (3-2)', '(3-2)'), [[4, 9]]);
});

test('dados: copia do texto oficial da Clara segue igual a fonte (se existir)', { skip: !fs.existsSync(FONTE) }, () => {
  assert.equal(lf(MD), lf(fs.readFileSync(FONTE, 'utf8')));
});
