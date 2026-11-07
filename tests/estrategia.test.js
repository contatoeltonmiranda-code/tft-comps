const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FONTE = path.join(ROOT, '../../3. copywriter/Projetos/tft-guia-do-jogo/ESTRATEGIA-PADRAO.md');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MD = read('data/estrategia-padrao.md');
const gen = require('../tools/gen-guia.js');
const { decode, htmlWords, mdWords, mdTables, lf } = require('./_texto.js');
const PG = gen.PAGES.estrategia;
const OUT = gen.render(MD, PG.render);
const PAGE = read('estrategia.html');

test('estrategia: 6 secoes h2 com ids unicos e indice com ancoras para todas', () => {
  const h2 = [...OUT.content.matchAll(/<h2 id="([^"]+)">([^<]*)<\/h2>/g)];
  assert.equal(h2.length, 6);
  assert.equal(new Set(h2.map((m) => m[1])).size, 6);
  const toc = [...OUT.toc.matchAll(/<a href="#([^"]+)">([^<]*)<\/a>/g)];
  assert.deepEqual(toc.map((m) => m[1]), h2.map((m) => m[1]));
  assert.equal(decode(toc[0][2]), '1. Qual estratégia jogar');
  assert.equal(decode(toc[5][2]), '6. Resumo de bolso');
});

test('estrategia: todo id e unico na pagina e todo href #x aponta para um id existente', () => {
  const ids = [...PAGE.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'ids duplicados');
  const hrefs = [...PAGE.matchAll(/href="#([^"]+)"/g)];
  assert.ok(hrefs.length >= 8);
  hrefs.forEach((m) => assert.ok(ids.includes(m[1]), 'ancora sem alvo: ' + m[1]));
});

test('estrategia: subtitulos repetidos (Quando escolher, Gatilhos...) ganham id da estrategia', () => {
  const h3 = [...OUT.content.matchAll(/<h3 id="([^"]+)">([^<]*)<\/h3>/g)].map((m) => ({ id: m[1], t: decode(m[2]) }));
  assert.equal(h3.filter((h) => h.t === 'Gatilhos').length, 3);
  assert.ok(h3.some((h) => h.id === 'estrategia-1-fast-8-padrao-gatilhos'));
  assert.ok(h3.some((h) => h.id === 'estrategia-3-economia-maxima-fast-8-antecipado-ou-fast-9-pisos'));
  assert.ok(h3.some((h) => h.id === 'checklist-de-30-segundos'), 'checklist mantem id curto');
  assert.ok(!h3.some((h) => /-\d+$/.test(h.id) && /gatilhos|pisos|erros-comuns/.test(h.id)), 'sem sufixo numerico');
});

test('estrategia: texto fiel ao .md (mesma sequencia de palavras, com acentos)', () => {
  const mdw = mdWords(MD);
  const htw = htmlWords(OUT.h1 + ' ' + OUT.content);
  for (let i = 0; i < mdw.length; i++) assert.equal(htw[i], mdw[i], 'palavra ' + i + ' perto de: ' + mdw.slice(Math.max(0, i - 4), i + 3).join(' '));
  assert.equal(htw.length, mdw.length, 'quantidade de palavras');
  assert.ok(mdw.length > 3000);
});

test('estrategia: nenhum asterisco do Markdown sobra no HTML', () => {
  assert.ok(!/\*/.test(OUT.content.replace(/<[^>]+>/g, '')), 'asterisco no texto visivel');
});

test('estrategia: tabelas do .md viram tabelas com a mesma grade e rotulos para o mobile', () => {
  const mdT = mdTables(MD);
  assert.equal(mdT.length, 13);
  const wraps = [...OUT.content.matchAll(/<div class="tbl stack"([^>]*)>\s*<table[^>]*>([\s\S]*?)<\/table>\s*<\/div>/g)];
  assert.equal(wraps.length, mdT.length);
  assert.equal((OUT.content.match(/<table/g) || []).length, mdT.length);
  wraps.forEach((t, k) => {
    assert.match(t[1], /tabindex="0"/);
    assert.match(t[1], /role="region"/);
    assert.match(t[1], /aria-label="Tabela: [^"]+"/);
    assert.equal((t[2].match(/<tr>/g) || []).length, mdT[k].rows + 1, 'linhas tabela ' + k);
    const head = t[2].match(/<thead>([\s\S]*?)<\/thead>/)[1];
    assert.equal((head.match(/<th\b/g) || []).length, mdT[k].cols, 'colunas tabela ' + k);
    const body = t[2].match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
    assert.equal((body.match(/<td data-label="[^"]+"/g) || []).length, mdT[k].rows * (mdT[k].cols - 1), 'data-label em toda celula ' + k);
  });
});

test('estrategia: marcacoes (regra derivada, divergencia, Set 18, Google) tem estilo proprio', () => {
  assert.ok((OUT.content.match(/<em class="rd">\(regra derivada do guia/g) || []).length >= 15);
  assert.ok(/<em class="rd">\(regra derivada do guia: as fontes não dão plano B\)<\/em>/.test(OUT.content));
  assert.ok(/<em class="rd">\(regra derivada do guia — as fontes dão âncoras, não faixas\)<\/em>/.test(OUT.content));
  assert.ok((OUT.content.match(/<span class="dv">\(divergência\)<\/span>/g) || []).length >= 3);
  assert.ok((OUT.content.match(/<span class="s18">\(Set 18\)<\/span>/g) || []).length >= 6);
  assert.ok(/<span class="s18">\(Set 18, patch 18\.5C\)<\/span>/.test(OUT.content));
  assert.ok((OUT.content.match(/<span class="nc">\(Google, não confirmado\)<\/span>/g) || []).length >= 2);
  assert.equal((OUT.content.match(/<blockquote class="nota">/g) || []).length, MD.split(/\r?\n/).filter((l, i, a) => /^>/.test(l) && !/^>/.test(a[i - 1] || '')).length);
});

test('estrategia: acoes UPAR/FICAR/ROLAR/GUARDAR viram badges so nas tabelas e sem mudar o texto', () => {
  const tables = [...OUT.content.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => m[0]).join('\n');
  const fora = OUT.content.replace(/<table[\s\S]*?<\/table>/g, '');
  assert.ok(!/class="act/.test(fora), 'badge fora de tabela');
  for (const k of ['upar', 'ficar', 'rolar', 'guardar', 'parar']) assert.ok(new RegExp(`class="act act-${k}"`).test(tables), 'sem badge ' + k);
  assert.ok(tables.includes('<strong><span class="act act-upar">UPAR 4</span></strong> ou <strong><span class="act act-ficar">FICAR 3</span></strong>'));
  assert.ok(tables.includes('<span class="act act-upar">UPAR 8</span> + <span class="act act-rolar">ROLAR</span>'));
  assert.ok(tables.includes('<span class="act act-guardar">GUARDAR</span>'));
  assert.ok(tables.includes('<span class="act act-rolar">ROLE</span> de novo'));
  assert.ok(!/<span class="act[^>]*>[^<]*SEN/.test(tables), 'SENÃO nao e acao');
  assert.equal(gen.inline('SE UPAR, role e ROLAR', { acoes: true }), 'SE <span class="act act-upar">UPAR</span>, role e <span class="act act-rolar">ROLAR</span>');
  assert.equal(gen.inline('UPAR 4', {}), 'UPAR 4');
  assert.equal(gen.inline('SENÃO UPARÁ'), 'SENÃO UPARÁ');
  assert.equal(gen.inline('SENÃO UPARÁ', { acoes: true }), 'SENÃO UPARÁ');
});

test('estrategia: checklist de 30 segundos e resumo de bolso em caixa, com atalhos no topo', () => {
  const box = OUT.content.match(/<div class="caixa">\n<h3 id="checklist-de-30-segundos">[^<]*<\/h3>\n(<ol>[\s\S]*?<\/ol>)\n<\/div>/);
  assert.ok(box, 'caixa do checklist');
  assert.equal((box[1].match(/<li>/g) || []).length, 7);
  assert.ok(/<section class="gsec caixa" aria-labelledby="resumo-de-bolso">/.test(OUT.content));
  const resumo = OUT.content.match(/<section class="gsec caixa" aria-labelledby="resumo-de-bolso">([\s\S]*?)<\/section>/)[1];
  assert.equal((resumo.match(/<li>/g) || []).length, 10);
  assert.equal((OUT.content.match(/<div class="caixa">/g) || []).length, 1);
  const quick = PAGE.match(/<nav class="quick" aria-label="Atalhos">([\s\S]*?)<\/nav>/)[1];
  assert.match(quick, /href="#checklist-de-30-segundos">Checklist rápido</);
  assert.match(quick, /href="#resumo-de-bolso">Resumo de bolso</);
  assert.ok(PAGE.indexOf('class="quick"') < PAGE.indexOf('class="glayout"'));
});

test('estrategia: estrategia.html gerado esta em dia com o .md (rode node tools/gen-guia.js)', () => {
  assert.equal(lf(PAGE), lf(gen.build(MD, read('tools/pagina-template.html'), PG)));
});

test('estrategia: cabecalho SEO, h1 unico e sem dependencia externa', () => {
  const title = PAGE.match(/<title>([^<]*)<\/title>/)[1];
  const desc = PAGE.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.ok(title.length <= 60, 'title ' + title.length);
  assert.ok(/estrat/i.test(title) && /tft/i.test(title));
  assert.ok(desc.length >= 140 && desc.length <= 160, 'description ' + desc.length);
  assert.notEqual(title, PAGE && read('guia.html').match(/<title>([^<]*)<\/title>/)[1]);
  assert.notEqual(desc, read('guia.html').match(/<meta name="description" content="([^"]*)"/)[1]);
  assert.ok(!/Em breve/i.test(PAGE));
  assert.ok(!/<script[^>]+src="https?:/i.test(PAGE) && !/<link[^>]+href="https?:/i.test(PAGE));
  assert.ok(!/<script>/i.test(PAGE), 'sem script inline');
  assert.match(PAGE, /<script src="js\/guia\.js"><\/script>/);
  assert.equal((PAGE.match(/<h1\b/g) || []).length, 1);
  assert.match(PAGE, /<h1>Estratégia padrão — TFT Set 18<\/h1>/);
  assert.match(PAGE, /og:title/);
  assert.match(PAGE, /twitter:card/);
  assert.match(PAGE, /robots" content="noindex"/);
});

test('estrategia: gerador recusa placeholder desconhecido', () => {
  assert.throws(() => gen.build(MD, '{{NADA}}', PG), /placeholder desconhecido/);
});

test('dados: copia do texto oficial da Clara (estrategia) segue igual a fonte (se existir)', { skip: !fs.existsSync(FONTE) }, () => {
  assert.equal(lf(MD), lf(fs.readFileSync(FONTE, 'utf8')));
});
