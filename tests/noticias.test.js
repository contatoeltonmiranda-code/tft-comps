const test = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../data/catalog.js');
require('../data/noticias.js');
const CAT = window.TFT_CATALOG;
const NEWS = window.TFT_NOTICIAS;
const RESUMO = window.TFT_NOTICIAS_RESUMO;

const TIPOS = ['buff', 'nerf', 'ajuste', 'sistema', 'item', 'aprimoramento', 'comp-meta'];
const ALVO_TIPOS = ['campeao', 'traco', 'item', 'aprimoramento', 'fogo-fatuo', 'sistema'];
const ids = {
  campeao: new Set(CAT.champs.map((x) => x.id)),
  traco: new Set(CAT.traits.map((x) => x.id)),
  item: new Set(CAT.items.map((x) => x.id)),
};
const nomes = {
  campeao: new Map(CAT.champs.map((x) => [x.id, x.n])),
  traco: new Map(CAT.traits.map((x) => [x.id, x.n])),
  item: new Map(CAT.items.map((x) => [x.id, x.n])),
};

test('noticias: lista nao vazia, ids unicos, campos obrigatorios', () => {
  assert.ok(Array.isArray(NEWS) && NEWS.length >= 30);
  assert.equal(new Set(NEWS.map((n) => n.id)).size, NEWS.length);
  NEWS.forEach((n) => {
    ['id', 'data', 'patch', 'titulo', 'tipo', 'texto'].forEach((k) => assert.ok(typeof n[k] === 'string' && n[k].length > 0, n.id + ' ' + k));
    assert.match(n.data, /^2026-\d\d-\d\d$/, n.id);
    assert.match(n.patch, /^\d+\.\d+$/, n.id);
    assert.ok(TIPOS.includes(n.tipo), n.id + ' tipo ' + n.tipo);
    assert.ok(n.titulo.length <= 80, n.id + ' titulo curto');
    assert.ok(n.texto.length <= 800, n.id + ' texto curto');
    assert.ok(Array.isArray(n.alvos) && n.alvos.length > 0, n.id + ' alvos');
  });
});

test('noticias: alvos apontam para ids e nomes reais do catalogo', () => {
  NEWS.forEach((n) => {
    n.alvos.forEach((a) => {
      assert.ok(ALVO_TIPOS.includes(a.tipo), n.id + ' alvo.tipo ' + a.tipo);
      assert.ok(typeof a.nome === 'string' && a.nome.length > 0, n.id + ' alvo.nome');
      if (ids[a.tipo]) {
        assert.ok(ids[a.tipo].has(a.id), n.id + ' id inexistente no catalogo: ' + a.id);
        assert.equal(nomes[a.tipo].get(a.id), a.nome, n.id + ' nome diverge do catalogo para ' + a.id);
      } else {
        assert.equal(a.id, null, n.id + ' ' + a.tipo + ' sem id no catalogo');
      }
    });
  });
});

test('noticias: fonte oficial da Riot, so https', () => {
  const urls = new Set();
  NEWS.concat(RESUMO).forEach((n) => {
    assert.ok(n.fonte && n.fonte.nome && n.fonte.url, (n.id || n.patch) + ' fonte');
    assert.match(n.fonte.url, /^https:\/\/teamfighttactics\.leagueoflegends\.com\/(pt-br|en-us)\/news\/game-updates\/teamfight-tactics-patch-18-[56]\/$/, n.id || n.patch);
    urls.add(n.fonte.url);
  });
  assert.ok(urls.size >= 3);
});

test('noticias: ordem do mais novo para o mais antigo e patches cobertos', () => {
  for (let k = 1; k < NEWS.length; k++) assert.ok(NEWS[k - 1].data >= NEWS[k].data, NEWS[k].id + ' fora de ordem');
  const patches = new Set(NEWS.map((n) => n.patch));
  assert.deepEqual([...patches].sort(), ['18.5', '18.6']);
  assert.ok(NEWS.every((n) => (n.patch === '18.6' ? n.data >= '2026-11-04' : n.data >= '2026-10-21' && n.data <= '2026-10-27')));
});

test('noticias: resumo no topo com 2 a 3 linhas', () => {
  assert.ok(Array.isArray(RESUMO) && RESUMO.length === 1);
  assert.equal(RESUMO[0].patch, '18.6');
  assert.ok(RESUMO[0].linhas.length >= 2 && RESUMO[0].linhas.length <= 3);
  RESUMO[0].linhas.forEach((l) => assert.ok(l.length > 20 && l.length <= 300));
});

test('noticias: PT-BR acentuado, sem emoji e sem termos sem acento comuns', () => {
  const todo = NEWS.map((n) => [n.titulo, n.texto, n.alvos.map((a) => a.nome).join(' ')].join(' ')).concat(RESUMO[0].linhas).join('\n');
  assert.doesNotMatch(todo, /[\u{1F000}-\u{1FFFF}☀-➿]/u);
  const m = todo.match(/\b(nao|voce|atualizacao|atualizacoes|composicao|composicoes|tambem|caracteristica|caracteristicas|campeoes|sera|inicio|ultimo|dano s)\b/gi);
  assert.equal(m, null, 'palavras sem acento: ' + (m && m.join(', ')));
});

test('noticias: cada entrada de buff/nerf cita numeros ou motivo da fonte', () => {
  NEWS.filter((n) => n.tipo === 'buff' || n.tipo === 'nerf').forEach((n) => {
    assert.match(n.texto, /\d/, n.id + ' sem numero');
  });
});
