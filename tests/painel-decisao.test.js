const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/painel-logic.js');

// Fixture pequeno e controlado: A e E custo 1, B e F custo 2, C custo 3, D custo 4, G custo 5.
const catalog = {
  champs: [
    { id: 'A', n: 'Alfa', c: 1 },
    { id: 'B', n: 'Beta', c: 2 },
    { id: 'C', n: 'Gama', c: 3 },
    { id: 'D', n: 'Delta', c: 4 },
    { id: 'E', n: 'Epsilon', c: 1 },
    { id: 'F', n: 'Zeta', c: 2 },
    { id: 'G', n: 'Eta', c: 5 },
    { id: 'H', n: 'Teta', c: 2 },
  ],
  traits: [],
  items: [
    { id: 'IE', n: 'Espada Dupla', k: 'completo' },
    { id: 'IR', n: 'Arco Veloz', k: 'completo' },
    { id: 'CS', n: 'Espada', k: 'componente' },
    { id: 'CB', n: 'Arco', k: 'componente' },
  ],
};
const recipes = {
  componentes: { CS: { n: 'Espada' }, CB: { n: 'Arco' } },
  receitas: { IE: ['CS', 'CS'], IR: ['CS', 'CB'] },
};
const u = (c, extra = {}) => ({ c, s: 1, i: [], a: [], ...extra });
const seed = [
  { id: 'x1', nome: 'Comp X', estilo: 'Fast 8', main: [u('C'), u('D', { i: ['IE'] }), u('G'), u('B')], flex: [], fases: { inicio: ['B', 'F'], meio: ['B', 'C', 'F'], origem: 'derivado' } },
  { id: 'y1', nome: 'Comp Y', estilo: 'Slowroll Nvl 6', main: [u('A', { i: ['IR'] }), u('E'), u('F'), u('C')], flex: [], fases: { inicio: ['A', 'E'], meio: ['A', 'E', 'F', 'C'], origem: 'derivado' } },
  { id: 'w1', nome: 'Comp W', estilo: 'Fast 8', main: [u('H', { i: ['IE'] }), u('D')], flex: [], fases: { inicio: ['H'], meio: ['H', 'D'], origem: 'derivado' } },
];
const dados = { seed, catalog, recipes };
const est = (o = {}) => P.sanitizarEstado(Object.assign({ stage: '2-1', hp: 100, gold: 4, level: 3 }, o), catalog);
const dec = (o) => P.decidir(est(o), dados);

// -------------------------------------------------------------- Elton: 2-1, vida 100, ouro 4

test('2-1, vida 100, ouro 4, sem nada: Economia (Open Fort), FICAR no 3, juros 0 e proximo degrau 10', () => {
  const d = dec({});
  assert.equal(d.estrategia.id, 'economia');
  assert.equal(d.estrategia.variante, 'openfort');
  assert.equal(d.acao.tipo, 'FICAR');
  assert.equal(d.acao.nivel, 3);
  assert.equal(d.acao.regra.id, 'ec-2-1');
  assert.equal(d.vida.faixa, 'folga');
  assert.equal(d.vida.valeFaixa, false);
  assert.equal(d.ouro.atual, 4);
  assert.equal(d.ouro.juros, 0);
  assert.equal(d.ouro.proximoDegrau, 10);
  assert.equal(d.ouro.falta, 6);
  assert.deepEqual([d.acao.sobra.min, d.acao.sobra.max], [4, 4]);
  assert.ok(d.estrategia.porque.length >= 2);
  assert.ok(d.estrategia.porque.some((p) => p.ok === true));
  assert.ok(d.estrategia.mudaria.length >= 1);
});

test('2-1 com upgrade (3 copias), itens uteis (2 espadas) e aprimoramento de forca: Fast 8, UPAR 4', () => {
  const d = dec({ champs: { B: 3 }, comps: { CS: 2 }, aprim: 'forca' });
  assert.equal(d.estrategia.id, 'fast8');
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 4);
  assert.equal(d.acao.regra.id, 'f8-2-1');
});

test('2-1 so com pares e sem itens: Economia mesmo com aprimoramento de forca (SENAO -> FICAR 3)', () => {
  const d = dec({ champs: { B: 2, F: 2 }, aprim: 'forca' });
  assert.equal(d.estrategia.id, 'economia');
  assert.equal(d.acao.tipo, 'FICAR');
});

test('2-1 com aprimoramento de economia e board vazio: Economia, criterio de aprimoramento marcado', () => {
  const d = dec({ aprim: 'eco' });
  assert.equal(d.estrategia.id, 'economia');
  assert.ok(d.estrategia.porque.some((p) => /economia/i.test(p.texto) && p.ok === true));
});

// -------------------------------------------------------------- estagio 2 (Fast 8)

const F8_2 = { champs: { B: 3 }, comps: { CS: 2 } };

test('2-2 a 2-7: GUARDAR, nao role (Fast 8)', () => {
  ['2-2', '2-3', '2-6', '2-7'].forEach((stage) => {
    const d = dec({ ...F8_2, stage, level: 4, gold: 12, streak: 0 });
    assert.equal(d.estrategia.id, 'fast8', stage);
    assert.equal(d.acao.tipo, 'GUARDAR', stage);
  });
});

test('2-x com muitos pares (3+): rola um pouco e para em 14 ou 20, nunca em 10', () => {
  const base = { stage: '2-2', level: 4, champs: { B: 3, A: 2, E: 2, F: 2 }, comps: { CS: 2 } };
  const alto = dec({ ...base, gold: 25 });
  assert.equal(alto.acao.tipo, 'ROLAR');
  assert.equal(alto.acao.rolarAte.min, 20);
  const medio = dec({ ...base, gold: 16 });
  assert.equal(medio.acao.tipo, 'ROLAR');
  assert.equal(medio.acao.rolarAte.min, 14);
  const baixo = dec({ ...base, gold: 13 });
  assert.equal(baixo.acao.tipo, 'GUARDAR');
});

test('2-3 com win streak e board forte: UPAR 5; sem streak: GUARDAR', () => {
  const forte = dec({ ...F8_2, stage: '2-3', level: 4, gold: 15, streak: 3 });
  assert.equal(forte.acao.tipo, 'UPAR');
  assert.equal(forte.acao.nivel, 5);
  assert.equal(forte.acao.regra.id, 'f8-2-3');
  const sem = dec({ ...F8_2, stage: '2-3', level: 4, gold: 15, streak: 0 });
  assert.equal(sem.acao.tipo, 'GUARDAR');
});

test('2-4 carrossel: GUARDAR e pegar o item que a comp precisa', () => {
  const d = dec({ ...F8_2, stage: '2-4', level: 4, gold: 15 });
  assert.equal(d.acao.tipo, 'GUARDAR');
  assert.equal(d.rodada.tipo, 'carrossel');
  assert.equal(d.acao.regra.id, 'f8-2-4');
});

test('2-5: board forte e ouro >= 10 = UPAR 5; senao FICAR', () => {
  const up = dec({ ...F8_2, stage: '2-5', level: 4, gold: 12, streak: 2 });
  assert.equal(up.acao.tipo, 'UPAR');
  assert.equal(up.acao.nivel, 5);
  const poucoOuro = dec({ ...F8_2, stage: '2-5', level: 4, gold: 8, streak: 2 });
  assert.equal(poucoOuro.acao.tipo, 'FICAR');
  const fraco = dec({ ...F8_2, stage: '2-5', level: 4, gold: 30, streak: 0 });
  assert.equal(fraco.acao.tipo, 'FICAR');
});

// -------------------------------------------------------------- estagio 3

const F8_3 = { champs: { B: 3, C: 1 }, comps: { CS: 2 }, hp: 70 };

test('3-1: FICAR, nao sobe ao 6 por impulso; win streak + board forte = UPAR 6; pre-level para o 3-2', () => {
  const d = dec({ ...F8_3, stage: '3-1', level: 5, gold: 30, streak: 0 });
  assert.equal(d.acao.tipo, 'FICAR');
  assert.equal(d.acao.regra.id, 'f8-3-1');
  assert.ok(d.acao.preLevel && /3-2/.test(d.acao.preLevel.texto));
  const ag = dec({ ...F8_3, stage: '3-1', level: 5, gold: 30, streak: 3 });
  assert.equal(ag.acao.tipo, 'UPAR');
  assert.equal(ag.acao.nivel, 6);
});

test('3-2, ouro 32, vida 70: Fast 8 padrao, UPAR 6, juros +3, proximo degrau 40, faixa Segura', () => {
  const d = dec({ ...F8_3, stage: '3-2', level: 5, gold: 32 });
  assert.equal(d.estrategia.id, 'fast8');
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 6);
  assert.equal(d.acao.regra.id, 'f8-3-2');
  assert.equal(d.vida.faixa, 'segura');
  assert.equal(d.vida.valeFaixa, true);
  assert.equal(d.ouro.juros, 3);
  assert.equal(d.ouro.proximoDegrau, 40);
  assert.equal(d.ouro.falta, 8);
  assert.equal(d.ouro.leitura.id, 'meio');
  assert.equal(d.acao.sobra, null);
  assert.match(d.acao.sobraTexto, /XP/);
});

test('3-2 com XP informado: sobra = ouro - custo do XP', () => {
  const d = dec({ ...F8_3, stage: '3-2', level: 5, gold: 32, xp: { atual: 20, max: 36 } });
  assert.equal(d.acao.custoXp, 16);
  assert.deepEqual([d.acao.sobra.min, d.acao.sobra.max], [16, 16]);
});

test('3-2 com ouro ~20 e board bom: pode UPAR (opcional, economia fica ruim); com 15: FICAR', () => {
  const ok = dec({ ...F8_3, stage: '3-2', level: 5, gold: 22, streak: 2 });
  assert.equal(ok.acao.tipo, 'UPAR');
  assert.equal(ok.acao.opcional, true);
  const baixo = dec({ ...F8_3, stage: '3-2', level: 5, gold: 15, streak: 0 });
  assert.notEqual(baixo.acao.tipo, 'UPAR');
});

test('3-2 a 3-5 com 3+ pares: 2-3 rolagens por rodada, parando em 32', () => {
  const d = dec({ stage: '3-3', level: 6, hp: 70, gold: 42, champs: { B: 3, A: 2, E: 2, F: 2 }, comps: { CS: 2 } });
  assert.equal(d.acao.tipo, 'ROLAR');
  assert.equal(d.acao.rolarAte.min, 32);
  assert.equal(d.acao.limiteRolagens, 3);
  assert.equal(d.acao.regra.id, 'f8-3-roll');
  assert.ok(d.acao.sobra.min >= 32);
  const parado = dec({ stage: '3-3', level: 6, hp: 70, gold: 32, champs: { B: 3, A: 2, E: 2, F: 2 }, comps: { CS: 2 } });
  assert.notEqual(parado.acao.tipo, 'ROLAR');
});

test('3-3 e 3-6 (level torto): FICAR, nao compre XP', () => {
  const d = dec({ ...F8_3, stage: '3-3', level: 6, gold: 36 });
  assert.equal(d.acao.tipo, 'FICAR');
  assert.equal(d.acao.regra.id, 'f8-3-3');
});

test('3-5: muito rico (50+) ou streak = UPAR 7; senao FICAR 6 e GUARDAR rumo a 50', () => {
  const rico = dec({ ...F8_3, stage: '3-5', level: 6, gold: 55 });
  assert.equal(rico.acao.tipo, 'UPAR');
  assert.equal(rico.acao.nivel, 7);
  const pobre = dec({ ...F8_3, stage: '3-5', level: 6, gold: 30 });
  assert.equal(pobre.acao.tipo, 'FICAR');
  assert.equal(pobre.acao.nivel, 6);
  assert.match(pobre.acao.texto, /50/);
});

test('3-7: 2 jogadores na comp = UPAR 8 e ROLAR antes de todos, ate 20-30', () => {
  const d = dec({ ...F8_3, stage: '3-7', level: 7, gold: 50, favorita: 'x1', contest: { x1: 2 } });
  assert.equal(d.estrategia.id, 'fast8');
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 8);
  assert.deepEqual([d.acao.rolarAte.min, d.acao.rolarAte.max], [20, 30]);
  assert.equal(d.acao.regra.id, 'f8-3-7');
  assert.ok(d.estrategia.porque.some((p) => /2 jogadores|contest/i.test(p.texto)));
});

test('3-7 sem pressao: UPAR 7 se ainda nao foi', () => {
  const d = dec({ ...F8_3, stage: '3-7', level: 6, gold: 40 });
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 7);
});

// -------------------------------------------------------------- estagio 4

test('4-1: no 6 UPAR 7 com pre-level (terminar 2 XP abaixo do 8)', () => {
  const d = dec({ ...F8_3, stage: '4-1', level: 6, gold: 40 });
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 7);
  assert.ok(/8/.test(d.acao.preLevel.texto) && /2 XP/.test(d.acao.preLevel.texto));
  const sete = dec({ ...F8_3, stage: '4-1', level: 7, gold: 40, xp: { atual: 30, max: 48 } });
  assert.equal(sete.acao.tipo, 'FICAR');
  assert.equal(sete.acao.preLevel.xpAlvo, 46);
  assert.equal(sete.acao.preLevel.comprar, 16);
});

test('4-2, ouro 45, vida 50: Fast 8, UPAR 8 e ROLAR ate 20-30, piso ~40, faixa Segura', () => {
  const d = dec({ ...F8_3, stage: '4-2', level: 7, gold: 45, hp: 50, xp: { atual: 40, max: 48 } });
  assert.equal(d.estrategia.id, 'fast8');
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 8);
  assert.deepEqual([d.acao.rolarAte.min, d.acao.rolarAte.max], [20, 30]);
  assert.equal(d.acao.regra.id, 'f8-4-2');
  assert.equal(d.vida.faixa, 'segura');
  assert.equal(d.acao.custoXp, 8);
  assert.deepEqual([d.acao.sobra.min, d.acao.sobra.max], [20, 30]);
  assert.equal(d.ouro.piso.minimo, 10);
  assert.equal(d.ouro.piso.contexto.valor, 40);
  assert.ok(d.acao.rolarAte.regra || d.acao.regra);
});

test('4-2 com ouro < 40 e vida segura: FICAR 7, GUARDAR e subir no 4-5', () => {
  const d = dec({ ...F8_3, stage: '4-2', level: 7, gold: 30, hp: 50 });
  assert.equal(d.acao.tipo, 'FICAR');
  assert.equal(d.acao.nivel, 7);
  assert.match(d.acao.texto, /4-5/);
});

test('4-2 com vida em Atencao (30-40) e pouco ouro: nao adie o roll down para o 4-5', () => {
  const d = dec({ ...F8_3, stage: '4-2', level: 7, gold: 30, hp: 35 });
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 8);
  assert.ok(d.acao.rolarAte);
  assert.equal(d.vida.faixa, 'atencao');
  assert.equal(d.vida.alerta.nivel, 'aviso');
});

test('4-2 ja no nivel 8: so rolar ate 20-30 se tem ouro', () => {
  const d = dec({ ...F8_3, stage: '4-2', level: 8, gold: 45, hp: 60 });
  assert.equal(d.acao.tipo, 'ROLAR');
  assert.deepEqual([d.acao.rolarAte.min, d.acao.rolarAte.max], [20, 30]);
});

test('4-5 sem ter subido: UPAR 8 + ROLAR; ja no 8: sem regra propria (matriz)', () => {
  const d = dec({ ...F8_3, stage: '4-5', level: 7, gold: 45, hp: 60 });
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 8);
  assert.equal(d.acao.regra.id, 'f8-4-5');
  const ja = dec({ ...F8_3, stage: '4-5', level: 8, gold: 25, hp: 60 });
  assert.notEqual(ja.acao.regra.id, 'f8-4-5');
});

test('5-1: estabilizou = UPAR 9; senao ROLAR de novo no 8', () => {
  const bom = dec({ ...F8_3, stage: '5-1', level: 8, gold: 30, hp: 70, streak: 2 });
  assert.equal(bom.acao.tipo, 'UPAR');
  assert.equal(bom.acao.nivel, 9);
  const mal = dec({ ...F8_3, stage: '5-1', level: 8, gold: 30, hp: 45, streak: -3 });
  assert.equal(mal.acao.tipo, 'ROLAR');
  assert.equal(mal.acao.regra.id, 'f8-5-1');
});

test('5-5 e 6-1: UPAR 9 se ainda nao foi', () => {
  const d = dec({ ...F8_3, stage: '5-5', level: 8, gold: 30, hp: 70, streak: 0 });
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 9);
  assert.equal(d.acao.regra.id, 'f8-5-5');
});

test('depois do 6-1 sem regra propria: matriz vida x board, marcada como derivada', () => {
  const d = dec({ ...F8_3, stage: '6-3', level: 9, gold: 30, hp: 70 });
  assert.equal(d.acao.regra.origem, 'derivada');
  assert.equal(d.acao.regra.derivada, true);
});

// -------------------------------------------------------------- vida

test('vida < 30 (Critica) com board fraco: ROLAR ate 10 e alerta critico', () => {
  const d = dec({ ...F8_3, stage: '3-5', hp: 25, level: 6, gold: 45, streak: -3 });
  assert.equal(d.vida.faixa, 'critica');
  assert.equal(d.vida.alerta.nivel, 'critico');
  assert.equal(d.acao.tipo, 'ROLAR');
  assert.equal(d.acao.rolarAte.min, 10);
  assert.equal(d.acao.regra.origem, 'derivada');
  assert.equal(d.acao.sobra.min, 10);
});

test('vida < 30 com ouro ja no piso: GUARDAR (nao role abaixo de 10)', () => {
  const d = dec({ ...F8_3, stage: '3-5', hp: 25, level: 6, gold: 9, streak: -3 });
  assert.equal(d.acao.tipo, 'GUARDAR');
  assert.ok(d.ouro.aviso);
});

test('vida em Atencao com board fraco: ROLAR agora ate 32 no estagio 3 e ate 20 no 4; sem Open Fort', () => {
  const e3 = dec({ ...F8_3, stage: '3-4', hp: 38, level: 6, gold: 50, streak: -3 });
  assert.equal(e3.acao.tipo, 'ROLAR');
  assert.equal(e3.acao.rolarAte.min, 32);
  const e4 = dec({ ...F8_3, stage: '4-3', hp: 38, level: 8, gold: 50, streak: -3 });
  assert.equal(e4.acao.tipo, 'ROLAR');
  assert.equal(e4.acao.rolarAte.min, 20);
});

test('vida em Atencao com board medio no 4-x: antecipa o spike (UPAR 8 + ROLAR no 4-4, nao espera o 4-5)', () => {
  const d = dec({ ...F8_3, stage: '4-4', hp: 38, level: 7, gold: 50, streak: 0 });
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 8);
});

test('estagio 2 ignora faixas de vida (cada derrota tira pouca vida)', () => {
  const d = dec({ ...F8_2, stage: '2-3', hp: 45, level: 4, gold: 15 });
  assert.equal(d.vida.valeFaixa, false);
  assert.equal(d.vida.alerta, null);
  assert.equal(d.acao.tipo, 'GUARDAR');
});

// -------------------------------------------------------------- reroll

const RR = { champs: { A: 5, E: 2, B: 2 }, comps: { CS: 1, CB: 1 }, hp: 90 };

test('Reroll custo 1: 5 copias de custo 1, item BIS montavel e sem contest, 3-1 no nivel 4: ROLAR ate 32', () => {
  const d = dec({ ...RR, stage: '3-1', level: 4, gold: 40 });
  assert.equal(d.estrategia.id, 'reroll');
  assert.equal(d.estrategia.variante, 'custo1');
  assert.equal(d.acao.tipo, 'ROLAR');
  assert.equal(d.acao.rolarAte.min, 32);
  assert.equal(d.acao.regra.id, 'rr-c1-3-1');
  assert.equal(d.acao.rolagens.max, 4);
  assert.ok(d.estrategia.porque.every((p) => p.ok !== false));
});

test('Reroll custo 1 vira Fast 8 se 1 jogador joga a mesma comp (qualquer contest pesa)', () => {
  const d = dec({ ...RR, stage: '3-1', level: 4, gold: 40, contest: { y1: 1 } });
  assert.equal(d.estrategia.id, 'fast8');
  assert.ok(d.estrategia.mudaria.some((m) => /Reroll/.test(m.texto)));
});

test('Reroll custo 1 sem item BIS: nao recomenda; diz que falta o item', () => {
  const d = dec({ ...RR, comps: {}, stage: '3-1', level: 4, gold: 40 });
  assert.equal(d.estrategia.id, 'fast8');
  assert.ok(d.estrategia.mudaria.some((m) => /BIS/.test(m.texto)));
});

test('Reroll custo 1 com 3 copias apenas: nao chega a 4+', () => {
  const d = dec({ ...RR, champs: { A: 3 }, stage: '3-1', level: 4, gold: 40 });
  assert.equal(d.estrategia.id, 'fast8');
});

test('Reroll custo 1: 3-2 guarda ate 50 e depois faz slow roll so do excedente', () => {
  const g = dec({ ...RR, stage: '3-2', level: 5, gold: 44 });
  assert.equal(g.estrategia.id, 'reroll');
  assert.equal(g.acao.tipo, 'GUARDAR');
  const r = dec({ ...RR, stage: '3-2', level: 5, gold: 60 });
  assert.equal(r.acao.tipo, 'ROLAR');
  assert.equal(r.acao.rolarAte.min, 50);
});

test('Reroll custo 1: bateu 3 estrelas (9 copias) = PARAR de rolar e UPAR', () => {
  const d = dec({ ...RR, champs: { A: 9 }, stage: '3-5', level: 5, gold: 60 });
  assert.equal(d.estrategia.id, 'reroll');
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.regra.id, 'rr-c1-3-5');
});

test('Reroll custo 1 no 4-1: ultima rodada de rolar; se nao bateu, ver Abandonar (derivada)', () => {
  const d = dec({ ...RR, stage: '4-1', level: 5, gold: 40 });
  assert.equal(d.acao.tipo, 'ROLAR');
  assert.equal(d.acao.regra.id, 'rr-c1-4-1');
  assert.ok(d.acao.extras.some((x) => x.regra && x.regra.origem === 'derivada'));
});

test('Reroll custo 2: 2+ copias de custo 2 com item BIS; no 4-1 rola ate 20', () => {
  const d = dec({ champs: { H: 2 }, comps: { CS: 2 }, hp: 80, stage: '4-1', level: 6, gold: 50 });
  assert.equal(d.estrategia.id, 'reroll');
  assert.equal(d.estrategia.variante, 'custo2');
  assert.equal(d.acao.tipo, 'ROLAR');
  assert.equal(d.acao.rolarAte.min, 20);
  assert.equal(d.acao.regra.id, 'rr-c2-4-1');
});

test('Reroll custo 2 no 3-2: com 50+ de ouro UPAR 6 e slow roll; senao UPAR 6 so no 3-5', () => {
  const rico = dec({ champs: { H: 2 }, comps: { CS: 2 }, hp: 80, stage: '3-2', level: 5, gold: 55 });
  assert.equal(rico.estrategia.variante, 'custo2');
  assert.equal(rico.acao.tipo, 'UPAR');
  assert.equal(rico.acao.nivel, 6);
  const pobre = dec({ champs: { H: 2 }, comps: { CS: 2 }, hp: 80, stage: '3-2', level: 5, gold: 35 });
  assert.notEqual(pobre.acao.tipo, 'UPAR');
});

test('Reroll com vida em Atencao: sai do slow roll e rola para estabilizar', () => {
  const d = dec({ ...RR, stage: '3-3', level: 5, gold: 55, hp: 36 });
  assert.equal(d.estrategia.id, 'reroll');
  assert.equal(d.acao.tipo, 'ROLAR');
  assert.equal(d.acao.rolarAte.min, 32);
});

// -------------------------------------------------------------- contest

test('contest 3+ na comp: segue Fast 8 e avisa para pivotar; Forcar diz nao force', () => {
  const d = dec({ ...F8_3, stage: '3-2', level: 5, gold: 32, favorita: 'x1', contest: { x1: 3 } });
  assert.equal(d.estrategia.id, 'fast8');
  assert.ok(d.acao.extras.some((x) => /pivote|troque de comp/i.test(x.texto)));
  assert.equal(d.forcar.veredito, 'nao');
});

test('contest 2 na comp: avisa para rolar antes dos outros ou ter plano B', () => {
  const d = dec({ ...F8_3, stage: '3-2', level: 5, gold: 32, favorita: 'x1', contest: { x1: 2 } });
  assert.ok(d.acao.extras.some((x) => /antes dos outros|plano B/i.test(x.texto)));
});

// -------------------------------------------------------------- economia / Fast 9

test('4-1 com 80+ de vida, aprimoramento de economia e sem contest: Economia, Fast 9 (UPAR sem rolar)', () => {
  const d = dec({ ...F8_3, stage: '4-1', level: 7, gold: 60, hp: 85, aprim: 'eco', favorita: 'x1' });
  assert.equal(d.estrategia.id, 'economia');
  assert.equal(d.estrategia.variante, 'fast9');
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.rolarAte, null);
  assert.equal(d.acao.regra.id, 'ec-4-x-3b');
});

test('4-1 com menos de 80 de vida e aprimoramento de economia: sem Fast 9, vai de 3A (UPAR 8 + ROLAR)', () => {
  const d = dec({ ...F8_3, stage: '4-1', level: 7, gold: 60, hp: 75, aprim: 'eco' });
  assert.equal(d.estrategia.id, 'economia');
  assert.equal(d.estrategia.variante, 'antecipado');
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 8);
  assert.deepEqual([d.acao.rolarAte.min, d.acao.rolarAte.max], [20, 30]);
  assert.ok(d.estrategia.mudaria.some((m) => /80/.test(m.texto)));
});

test('Fast 9 contestado nao entra: 4-1, vida 85, eco, 1 jogador na comp = 3A', () => {
  const d = dec({ ...F8_3, stage: '4-1', level: 7, gold: 60, hp: 85, aprim: 'eco', favorita: 'x1', contest: { x1: 1 } });
  assert.notEqual(d.estrategia.variante, 'fast9');
});

test('5-1 em Fast 9: UPAR 9 e ROLAR pelos custo 5 (1-2 de 2 estrelas), parando em 10', () => {
  const d = dec({ ...F8_3, stage: '5-1', level: 8, gold: 60, hp: 85, aprim: 'eco', favorita: 'x1' });
  assert.equal(d.estrategia.variante, 'fast9');
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 9);
  assert.equal(d.acao.rolarAte.min, 10);
  assert.equal(d.acao.regra.id, 'ec-5-1-3b');
});

test('Open Fort: 2-2 a 2-7 GUARDAR; 3-1 sai da loss streak; 3-2 UPAR 6 com 30+', () => {
  const g = dec({ stage: '2-3', level: 3, gold: 8, hp: 90 });
  assert.equal(g.estrategia.variante, 'openfort');
  assert.equal(g.acao.tipo, 'GUARDAR');
  const s = dec({ stage: '3-1', level: 4, gold: 48, hp: 80, streak: -4 });
  assert.equal(s.estrategia.id, 'economia');
  assert.equal(s.acao.regra.id, 'ec-3-1');
  const t = dec({ stage: '3-2', level: 5, gold: 50, hp: 75, streak: 0 });
  assert.equal(t.estrategia.id, 'fast8');
});

test('Open Fort nao vale com vida em Atencao no estagio 3 (sem Open Fort)', () => {
  const d = dec({ stage: '3-1', level: 4, gold: 30, hp: 35, streak: -4 });
  assert.notEqual(d.estrategia.id, 'economia');
});

// -------------------------------------------------------------- metadados

test('todo resultado: estrategia, acao e regra completos; derivada vira marca explicita', () => {
  P.RODADAS.forEach((stage) => {
    [{ hp: 100, gold: 20 }, { hp: 35, gold: 45, streak: -3 }, { hp: 20, gold: 5, streak: 3 }].forEach((o) => {
      const d = dec({ ...F8_3, ...o, stage, level: 6 });
      assert.ok(['fast8', 'reroll', 'economia'].includes(d.estrategia.id), stage);
      assert.ok(['UPAR', 'FICAR', 'ROLAR', 'GUARDAR'].includes(d.acao.tipo), stage + ' ' + d.acao.tipo);
      assert.ok(d.acao.regra && d.acao.regra.id && d.acao.regra.ref && ['guia', 'derivada', 'painel'].includes(d.acao.regra.origem), stage);
      assert.equal(d.acao.regra.derivada, d.acao.regra.origem === 'derivada');
      assert.ok(Number.isFinite(d.ouro.juros) && d.ouro.juros >= 0 && d.ouro.juros <= 5, stage);
      assert.ok(d.comps.top3.length === 2 || d.comps.top3.length === 3, stage);
    });
  });
});

test('decidir e deterministico e nao altera o estado recebido', () => {
  const e = est({ ...F8_3, stage: '3-2', level: 5, gold: 32 });
  const antes = JSON.stringify(e);
  const a = P.decidir(e, dados);
  const b = P.decidir(e, dados);
  assert.equal(JSON.stringify(e), antes);
  assert.deepEqual(a, b);
});

// -------------------------------------------------------------- ajustes de revisao

test('Open Fort: 2-5 com win streak (board forte) quebra a loss streak e vai de Fast 8 (UPAR 5)', () => {
  const d = dec({ stage: '2-5', level: 4, gold: 14, hp: 95, streak: 3 });
  assert.equal(d.estrategia.id, 'fast8');
  assert.equal(d.acao.tipo, 'UPAR');
  assert.equal(d.acao.nivel, 5);
});

test('3-2 ja no nivel 6 com 3+ pares: nao manda "subir ao 6", vai para a rolagem de estagio 3', () => {
  const d = dec({ stage: '3-2', level: 6, hp: 70, gold: 44, champs: { B: 3, A: 2, E: 2, F: 2 }, comps: { CS: 2 } });
  assert.equal(d.acao.tipo, 'ROLAR');
  assert.equal(d.acao.regra.id, 'f8-3-roll');
});

test('regra que manda subir quando o nivel ja foi atingido: texto nao se contradiz', () => {
  const d = dec({ ...F8_3, stage: '3-5', level: 7, gold: 60 });
  assert.equal(d.acao.tipo, 'FICAR');
  assert.match(d.acao.texto, /Já está no nível 7/);
  assert.ok(!/suba ao 7/.test(d.acao.texto));
});

test('sanitizarEstado com recipes: componente desconhecido sai, os 10 componentes das receitas ficam', () => {
  const e = P.sanitizarEstado({ comps: { CS: 2, LIXO: 1 } }, catalog, recipes);
  assert.deepEqual(e.comps, { CS: 2 });
  const sem = P.sanitizarEstado({ comps: { CS: 2, LIXO: 1 } }, catalog);
  assert.deepEqual(sem.comps, { CS: 2, LIXO: 1 });
});
