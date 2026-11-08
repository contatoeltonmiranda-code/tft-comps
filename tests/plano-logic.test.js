const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Pl = require('../js/plano-logic.js');

const catalog = {
  champs: [
    { id: 'A', n: 'Alfa', c: 1, t: ['TR1'] },
    { id: 'B', n: 'Beta', c: 2, t: ['TR1'] },
    { id: 'C', n: 'Gama', c: 3, t: ['TR1'] },
    { id: 'D', n: 'Delta', c: 4, t: ['TR2'] },
    { id: 'E', n: 'Epsilon', c: 4, t: ['TR2'] },
    { id: 'F', n: 'Zeta', c: 5, t: ['TR3'] },
  ],
  traits: [{ id: 'TR1', n: 'Sabugueiro' }, { id: 'TR2', n: 'Solar' }, { id: 'TR3', n: 'Lunar' }],
  items: [],
};
const u = (c) => ({ c, s: 1, i: [] });
const comps = [
  { id: 'c1', nome: 'Sabugueiro A', estilo: 'Nível 8', main: [u('A'), u('B'), u('C')] },
  { id: 'c2', nome: 'Solar D', estilo: 'Fast 9', main: [u('D'), u('E'), u('F')] },
  { id: 'c3', nome: 'Reroll Alfa', estilo: 'Slowroll Nvl 6', main: [u('A'), u('D')] },
  { id: 'c4', nome: 'Lunar F', estilo: 'Nível 10', main: [u('F')] },
];
const noticia = (patch, tipo, alvos, titulo = 'x') => ({ id: patch + tipo + alvos.map((a) => a.id).join(), data: '2026-11-04', patch, titulo, tipo, alvos, texto: 't', fonte: { nome: 'n', url: 'https://x.y' } });
const campeao = (id, nome) => ({ tipo: 'campeao', id, nome });
const traco = (id, nome) => ({ tipo: 'traco', id, nome });

const base = { comps, noticias: [], analises: [], catalog };

test('sem historico e sem noticias: ordem da lista do usuario decide e devolve 3 comps', () => {
  const p = Pl.montarPlano(base);
  assert.deepEqual(p.comps.map((c) => c.id), ['c1', 'c2', 'c3']);
  assert.equal(p.fontes.partidas, 0);
  p.comps.forEach((c) => assert.ok(c.motivos.length >= 1));
  assert.ok(p.comps[0].motivos.some((m) => /posi[cç][aã]o 1/i.test(m.texto)));
});

test('buff e nerf do patch mais novo mexem no ranking (campeao e traco)', () => {
  const noticias = [
    noticia('18.6', 'buff', [campeao('F', 'Zeta')]),
    noticia('18.6', 'nerf', [traco('TR1', 'Sabugueiro')]),
  ];
  const p = Pl.montarPlano({ ...base, noticias });
  // c1 tem 3 campeoes do traco TR1 (nerf) -> cai; c2 e c4 tem Zeta (buff) -> sobem
  const ordem = p.comps.map((c) => c.id);
  assert.ok(ordem.indexOf('c2') < ordem.indexOf('c1') || !ordem.includes('c1'), ordem.join());
  const c2 = p.comps.find((c) => c.id === 'c2');
  assert.ok(c2.motivos.some((m) => m.tipo === 'patch' && /buff/i.test(m.texto) && /Zeta/.test(m.texto) && /18\.6/.test(m.texto)));
});

test('patch antigo pesa menos que o novo e patches alem dos 2 mais novos nao contam', () => {
  const novo = Pl.montarPlano({ ...base, noticias: [noticia('18.6', 'buff', [campeao('F', 'Zeta')])] });
  const velho = Pl.montarPlano({ ...base, noticias: [noticia('18.5', 'buff', [campeao('F', 'Zeta')]), noticia('18.6', 'ajuste', [campeao('A', 'Alfa')])] });
  const velhoMuito = Pl.montarPlano({ ...base, noticias: [noticia('18.3', 'buff', [campeao('F', 'Zeta')]), noticia('18.5', 'ajuste', []), noticia('18.6', 'ajuste', [])] });
  const s = (p) => p.pontuacao.find((x) => x.id === 'c2').patch;
  assert.ok(s(novo) > s(velho) && s(velho) > 0);
  assert.equal(s(velhoMuito), 0);
});

test('historico pessoal: media boa sobe a comp, media ruim derruba', () => {
  const an = (compId, col, quando) => ({ partida: { id: 'p' + quando, quando, eu: { colocacao: col } }, comp: { id: compId, nome: compId }, estilo: { id: 'fast8' } });
  const bom = [an('c3', 1, 1), an('c3', 2, 2), an('c3', 1, 3)];
  const p1 = Pl.montarPlano({ ...base, analises: bom });
  assert.equal(p1.comps[0].id, 'c3', 'c3 com 3 partidas boas vai para o topo');
  const m = p1.comps[0].motivos.find((x) => x.tipo === 'historico');
  assert.match(m.texto, /3 partidas/);
  assert.match(m.texto, /1[,.]33/);
  assert.match(m.texto, /100%/);
  const ruim = [an('c1', 8, 1), an('c1', 7, 2), an('c1', 8, 3)];
  const p2 = Pl.montarPlano({ ...base, analises: ruim });
  assert.ok(!p2.comps.slice(0, 2).some((c) => c.id === 'c1'), 'c1 com 3 partidas ruins cai para fora do top 2');
});

test('uma partida so pesa pouco (encolhimento em direcao a media 4,5)', () => {
  const an = [{ partida: { id: 'p1', quando: 1, eu: { colocacao: 1 } }, comp: { id: 'c4', nome: 'Lunar F' }, estilo: { id: 'fast8' } }];
  const p = Pl.montarPlano({ ...base, analises: an });
  const c4 = p.pontuacao.find((x) => x.id === 'c4');
  const c3 = p.pontuacao.find((x) => x.id === 'c3');
  assert.ok(c4.historico > 0 && c4.historico < 2.5, String(c4.historico));
  assert.equal(c3.historico, 0);
});

test('o plano nao inclui comps de fora da lista e respeita o tamanho pedido', () => {
  assert.equal(Pl.montarPlano({ ...base, comps: comps.slice(0, 2) }).comps.length, 2);
  assert.equal(Pl.montarPlano({ ...base, comps: [] }).comps.length, 0);
  assert.equal(Pl.montarPlano({ ...base, tamanho: 1 }).comps.length, 1);
});

test('tipo da comp vem do estilo (reroll, fast9, fast8)', () => {
  const p = Pl.montarPlano({ ...base, tamanho: 4 });
  const t = Object.fromEntries(p.comps.map((c) => [c.id, c.tipo]));
  assert.deepEqual(t, { c1: 'fast8', c2: 'fast9', c3: 'reroll', c4: 'fast9' });
});

test('estrategia: Fast 8 padrao sempre; nota de reroll e fast 9 quando a comp 1 pede', () => {
  const p = Pl.montarPlano(base);
  assert.equal(p.estrategia.id, 'fast8');
  assert.match(p.estrategia.nome, /Fast 8/);
  const so = Pl.montarPlano({ ...base, comps: [comps[2]] });
  assert.ok(so.estrategia.notas.some((n) => /reroll/i.test(n.texto)));
  const f9 = Pl.montarPlano({ ...base, comps: [comps[1]] });
  assert.ok(f9.estrategia.notas.some((n) => /Fast 9/.test(n.texto)));
});

test('estrategia: historico mostra qual linha rendeu mais top 4 (so com 3+ partidas na linha)', () => {
  const an = (id, col, estilo) => ({ partida: { id, quando: 1, eu: { colocacao: col } }, comp: null, estilo: { id: estilo } });
  const analises = [an('1', 6, 'fast8'), an('2', 7, 'fast8'), an('3', 5, 'fast8'), an('4', 2, 'reroll'), an('5', 1, 'reroll'), an('6', 3, 'reroll')];
  const p = Pl.montarPlano({ ...base, analises });
  const nota = p.estrategia.notas.find((n) => n.tipo === 'historico');
  assert.ok(nota);
  assert.match(nota.texto, /Reroll/);
  const pouco = Pl.montarPlano({ ...base, analises: analises.slice(0, 4) });
  assert.ok(!pouco.estrategia.notas.some((n) => n.tipo === 'historico'));
});

test('linha do tempo: 5 marcos na ordem, com acao e regra do guia', () => {
  assert.deepEqual(Pl.CHECKPOINTS.map((c) => c.marco), ['2-1', 'Fim do 2', '3-2', '4-1', '4-2']);
  Pl.CHECKPOINTS.forEach((c) => {
    assert.ok(c.acao && c.regra && c.troque && c.troque.se);
  });
});

function normMd(md) {
  return md
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => (/^\s*\|/.test(l) ? l.split('|').map((c) => c.trim()).filter(Boolean).join(' | ') : l))
    .join('\n')
    .replace(/\*/g, '')
    .replace(/[ \t]+/g, ' ');
}

test('fidelidade: todo texto do plano que vem do guia existe, palavra por palavra, em estrategia-padrao.md', () => {
  const md = normMd(fs.readFileSync(path.join(__dirname, '../data/estrategia-padrao.md'), 'utf8'));
  const faltam = [];
  const confere = (t, onde) => { if (!md.includes(t)) faltam.push(onde + ' -> ' + t); };
  Pl.CHECKPOINTS.forEach((c) => {
    confere(c.acao, c.marco + ' acao');
    confere(c.regra, c.marco + ' regra');
    confere(c.troque.se, c.marco + ' troque.se');
    if (c.troque.entao) confere(c.troque.entao, c.marco + ' troque.entao');
  });
  Pl.PISOS.forEach((t, i) => confere(t, 'piso ' + i));
  Pl.OUTRAS_LINHAS.forEach((l) => confere(l.texto, 'linha ' + l.id));
  confere(Pl.PADRAO.trecho, 'padrao');
  [[comps[2]], [comps[1]]].forEach((lista) => Pl.montarPlano({ ...base, comps: lista }).estrategia.notas.forEach((n) => n.trecho && confere(n.trecho, 'nota ' + n.tipo)));
  assert.deepEqual(faltam, []);
});

test('estatica: o mesmo insumo gera exatamente o mesmo plano (sem relogio, sem aleatorio)', () => {
  const a = Pl.montarPlano({ ...base, noticias: [noticia('18.6', 'buff', [campeao('F', 'Zeta')])] });
  const b = Pl.montarPlano({ ...base, noticias: [noticia('18.6', 'buff', [campeao('F', 'Zeta')])] });
  assert.deepEqual(a, b);
  const src = fs.readFileSync(path.join(__dirname, '../js/plano-logic.js'), 'utf8');
  assert.ok(!/Date\.now|new Date|Math\.random|localStorage|fetch\(/.test(src), 'logica pura');
});

test('politica: o plano nao recebe nem usa estado de partida em andamento', () => {
  const src = fs.readFileSync(path.join(__dirname, '../js/plano-logic.js'), 'utf8');
  assert.ok(!/\bestado\b|\bgold\b|\bhp\b/.test(src.replace(/\/\/.*$/gm, '')), 'plano nao le ouro, vida nem rodada atual');
});

test('patchesRecentes ordena numericamente (18.10 > 18.9)', () => {
  const r = Pl.patchesRecentes([noticia('18.9', 'buff', []), noticia('18.10', 'buff', []), noticia('18.5', 'buff', [])]);
  assert.deepEqual(r, ['18.10', '18.9']);
});

test('historico do plano ignora evento e pve; so Ranqueada+Normal conta', () => {
  const an = (id, fila, tipo, col) => ({ partida: { id, quando: Number(id), fila, tipo, eu: { colocacao: col } }, comp: { id: 'c3', nome: 'c3' }, estilo: { id: 'fast8' } });
  const evento = [an('1', 1230, 'standard', 1), an('2', 1230, 'standard', 1), an('3', 1220, 'pve', 1)];
  const p0 = Pl.montarPlano({ ...base, analises: evento });
  assert.equal(p0.pontuacao.find((x) => x.id === 'c3').historico, 0, 'evento nao pesa');
  assert.equal(p0.fontes.partidas, 0);
  assert.ok(p0.comps.every((c) => c.motivos.some((m) => /Sem partidas suas/.test(m.texto)) || c.id !== 'c3'));
  const reg = evento.concat([an('4', 1100, 'standard', 1), an('5', 1090, 'normal', 2)]);
  const p1 = Pl.montarPlano({ ...base, analises: reg });
  assert.ok(p1.pontuacao.find((x) => x.id === 'c3').historico > 0);
  assert.equal(p1.fontes.partidas, 2);
  const m = p1.comps.find((c) => c.id === 'c3').motivos.find((x) => x.tipo === 'historico');
  assert.match(m.texto, /2 partidas/);
});

test('estrategia por estilo tambem ignora evento', () => {
  const an = (id, col, estilo, fila) => ({ partida: { id, quando: 1, fila, tipo: 'standard', eu: { colocacao: col } }, comp: null, estilo: { id: estilo } });
  const analises = [an('1', 6, 'fast8', 1100), an('2', 7, 'fast8', 1100), an('3', 5, 'fast8', 1100), an('4', 2, 'reroll', 1230), an('5', 1, 'reroll', 1230), an('6', 3, 'reroll', 1230)];
  const p = Pl.montarPlano({ ...base, analises });
  assert.ok(!p.estrategia.notas.some((n) => n.tipo === 'historico'));
});
