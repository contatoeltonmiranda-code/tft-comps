const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Reg = require('../js/painel-regras.js');
const PJ = require('../js/posjogo-logic.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
// Mesma normalizacao dos outros testes de fidelidade: sem negrito, celulas de tabela separadas por " | ".
function normMd(md) {
  return md
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => (/^\s*\|/.test(l) ? l.split('|').map((c) => c.trim()).filter(Boolean).join(' | ') : l))
    .join('\n')
    .replace(/\*/g, '')
    .replace(/[ \t]+/g, ' ');
}
const GUIA = normMd(read('data/guia-do-jogo.md'));
const SECAO13 = GUIA.slice(GUIA.indexOf('## 13. Perda de vida'));
const VIDA_IDS = Object.keys(Reg.REGRAS).filter((id) => id.startsWith('g-vida-'));

test('vida: 6 regras novas da secao 13 na tabela de fontes (gvida), link guia.html#perda-de-vida, origem guia', () => {
  assert.deepEqual(VIDA_IDS.sort(), ['g-vida-conta', 'g-vida-contar', 'g-vida-e2', 'g-vida-e3', 'g-vida-e4', 'g-vida-e5']);
  VIDA_IDS.forEach((id) => {
    const r = Reg.REGRAS[id];
    assert.equal(r.href, 'guia.html#perda-de-vida', id);
    assert.equal(r.fonte, 'guia', id);
    assert.equal(r.origem, 'guia', id);
    assert.equal(r.secao, 'Guia · Perda de vida', id);
  });
  assert.ok(read('guia.html').includes('id="perda-de-vida"'));
});

test('vida: cada trecho da secao 13 existe, palavra por palavra, dentro da secao 13 do guia-do-jogo.md', () => {
  const faltam = [];
  VIDA_IDS.forEach((id) => {
    if (!SECAO13.includes(Reg.REGRAS[id].trecho)) faltam.push(id);
  });
  Object.entries(PJ.REGRAS_VIDA).forEach(([id, r]) => {
    if (!SECAO13.includes(r.trecho)) faltam.push('pos-jogo ' + id);
  });
  assert.deepEqual(faltam, []);
});

test('vida: regras de vida do Painel ganharam a citacao (q-4-1, f8-piso-vida e as demais), so como fonte extra', () => {
  const ids = Object.keys(Reg.VIDA);
  assert.ok(ids.length >= 20, 'regras com citacao: ' + ids.length);
  ['q-4-1', 'f8-piso-vida', 'f8m-a', 'rrm-f', 'ecm-3a-vida', 'ec-aband-80', 'ec-piso-vida80', 'p1-atencao', 'p1-critica', 'pan-agir', 'pan-panico'].forEach((id) => assert.ok(Reg.VIDA[id], id));
  ids.forEach((id) => {
    assert.ok(Reg.REGRAS[id], id);
    Reg.VIDA[id].forEach((x) => assert.ok(VIDA_IDS.includes(x), id + ' -> ' + x));
    const r = Reg.regra(id);
    assert.equal(r.tambem.length, Reg.VIDA[id].length, id);
    r.tambem.forEach((t) => assert.equal(t.href, 'guia.html#perda-de-vida', id));
    // a regra em si (trecho, href, origem) segue a mesma do registro: nada da logica mudou
    assert.equal(r.trecho, Reg.REGRAS[id].trecho, id);
    assert.equal(r.href, Reg.REGRAS[id].href, id);
    assert.equal(Reg.REGRAS[id].tambem, undefined, id);
  });
  assert.equal(Reg.regra('f8-4-2').tambem, undefined);
  assert.deepEqual(Reg.regra('q-4-1').tambem.map((t) => t.id), ['g-vida-e4']);
  assert.deepEqual(Reg.regra('f8-piso-vida').tambem.map((t) => t.id), ['g-vida-e5']);
});

test('vida: a citacao casa com o assunto (80+ no 4-1 -> estagio 4; Atencao 30-40 -> estagio 5 em diante)', () => {
  assert.match(Reg.regra('q-4-1').tambem[0].trecho, /80\+ de vida no 4-1/);
  assert.match(Reg.regra('ec-piso-vida80').tambem[0].trecho, /80\+ de vida no 4-1/);
  assert.match(Reg.regra('f8-piso-vida').tambem[0].trecho, /30–40 de vida/);
  assert.match(Reg.regra('p1-atencao').tambem[0].trecho, /30–40 de vida/);
  assert.match(Reg.regra('ecm-of-e').tambem[0].trecho, /Estágio 2 é a hora barata/);
});

test('vida: nenhum numero de dano do Painel/Pos-jogo contradiz a secao 13 (estagio 3 = 6 de base, estagio 4 = 7; nao 5 e 8)', () => {
  assert.match(SECAO13, /\n3 \| 6 \| Começa a doer\./);
  assert.match(SECAO13, /\n4 \| 7 \| A Riot baixou de 8 para 7/);
  const textos = Object.values(Reg.REGRAS).filter((r) => !r.id.startsWith('g-vida-')).map((r) => r.trecho).concat(Object.values(PJ.REGRAS).map((r) => r.trecho));
  textos.forEach((t) => assert.doesNotMatch(t, /dano base|\b5 de base|\b8 de base|estágio 3[^.]*\b5 de dano|estágio 4[^.]*\b8 de dano/i, t));
  ['data/estrategia-padrao.md', 'js/painel.js', 'js/painel-logic.js', 'js/posjogo-logic.js', 'js/plano-logic.js'].forEach((f) => {
    assert.doesNotMatch(read(f), /dano base/i, f);
  });
});

test('vida: Pos-jogo cita a secao 13 nos achados de eliminacao; o trecho antigo da Estrategia padrao continua', () => {
  assert.deepEqual(Object.keys(PJ.REGRAS_VIDA).sort(), ['caiu-antes-do-4-1', 'nivel-baixo-tarde', 'ouro-parado']);
  Object.keys(PJ.REGRAS_VIDA).forEach((id) => {
    assert.ok(PJ.REGRAS[id], id);
    assert.equal(PJ.REGRAS_VIDA[id].href, 'guia.html#perda-de-vida', id);
    assert.match(PJ.REGRAS_VIDA[id].href, /^[a-z]+\.html#[\w-]+$/);
    assert.ok(PJ.REGRAS[id].href.startsWith('estrategia.html#'), id);
  });
});

test('vida: as paginas renderizam a citacao extra (Painel: link e trecho; Pos-jogo: linha Vida)', () => {
  const painel = read('js/painel.js');
  assert.match(painel, /regra\.tambem \|\| \[\]/);
  assert.match(painel, /a\.regra\.tambem \|\| \[\]/);
  const pos = read('js/posjogo.js');
  assert.match(pos, /x\.tambem/);
  assert.match(pos, /'Vida: “'/);
});
