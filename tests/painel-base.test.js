const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/painel-logic.js');

test('ordRodada: estagio 1 tem 4 rodadas, os demais 7', () => {
  assert.equal(P.ordRodada('1-1'), 1);
  assert.equal(P.ordRodada('1-4'), 4);
  assert.equal(P.ordRodada('2-1'), 5);
  assert.equal(P.ordRodada('2-7'), 11);
  assert.equal(P.ordRodada('3-1'), 12);
  assert.equal(P.ordRodada('4-2'), 20);
  assert.equal(P.ordRodada('1-5'), null);
  assert.equal(P.ordRodada('2-8'), null);
  assert.equal(P.ordRodada('0-1'), null);
  assert.equal(P.ordRodada('x'), null);
  assert.equal(P.ordRodada(undefined), null);
});

test('proximaRodada: avanca dentro do estagio e vira de estagio', () => {
  assert.equal(P.proximaRodada('1-1'), '1-2');
  assert.equal(P.proximaRodada('1-4'), '2-1');
  assert.equal(P.proximaRodada('2-7'), '3-1');
  assert.equal(P.proximaRodada('3-3'), '3-4');
  assert.equal(P.proximaRodada('7-7'), '7-7');
  assert.equal(P.proximaRodada('lixo'), '1-1');
});

test('RODADAS lista 1-1 ate 7-7 em ordem (4 + 6*7 rodadas)', () => {
  assert.equal(P.RODADAS.length, 4 + 6 * 7);
  assert.equal(P.RODADAS[0], '1-1');
  assert.equal(P.RODADAS[P.RODADAS.length - 1], '7-7');
  assert.deepEqual(P.RODADAS.map(P.ordRodada), P.RODADAS.map((_, i) => i + 1));
});

test('juros: +1 a cada 10, teto +5, arredonda para baixo (guia: 33 da +3)', () => {
  assert.equal(P.juros(0), 0);
  assert.equal(P.juros(9), 0);
  assert.equal(P.juros(10), 1);
  assert.equal(P.juros(33), 3);
  assert.equal(P.juros(50), 5);
  assert.equal(P.juros(99), 5);
  assert.equal(P.juros(-5), 0);
});

test('degrau: proximo degrau de juros 10/20/30/40/50 e quanto falta', () => {
  assert.deepEqual(P.degrau(4), { juros: 0, proximo: 10, falta: 6 });
  assert.deepEqual(P.degrau(10), { juros: 1, proximo: 20, falta: 10 });
  assert.deepEqual(P.degrau(32), { juros: 3, proximo: 40, falta: 8 });
  assert.deepEqual(P.degrau(49), { juros: 4, proximo: 50, falta: 1 });
  assert.deepEqual(P.degrau(50), { juros: 5, proximo: null, falta: 0 });
  assert.deepEqual(P.degrau(77), { juros: 5, proximo: null, falta: 0 });
});

test('faixaVida: Folga 80+, Segura 41-79, Atencao 30-40, Critica <30 (estrategia-padrao Passo 1)', () => {
  assert.equal(P.faixaVida(100), 'folga');
  assert.equal(P.faixaVida(80), 'folga');
  assert.equal(P.faixaVida(79), 'segura');
  assert.equal(P.faixaVida(41), 'segura');
  assert.equal(P.faixaVida(40), 'atencao');
  assert.equal(P.faixaVida(30), 'atencao');
  assert.equal(P.faixaVida(29), 'critica');
  assert.equal(P.faixaVida(0), 'critica');
});

test('leituraOuro: degraus do Passo 2', () => {
  assert.equal(P.leituraOuro(9).id, 'abaixo');
  assert.equal(P.leituraOuro(10).id, 'armadilha');
  assert.equal(P.leituraOuro(13).id, 'armadilha');
  assert.equal(P.leituraOuro(14).id, 'lenta');
  assert.equal(P.leituraOuro(19).id, 'lenta');
  assert.equal(P.leituraOuro(20).id, 'rapida');
  assert.equal(P.leituraOuro(31).id, 'rapida');
  assert.equal(P.leituraOuro(32).id, 'meio');
  assert.equal(P.leituraOuro(49).id, 'meio');
  assert.equal(P.leituraOuro(50).id, 'maximo');
});

test('bonusStreak: 2 a 4 = +1, 5 = +2, 6+ = +3; vale para vitoria e derrota', () => {
  assert.equal(P.bonusStreak(0), 0);
  assert.equal(P.bonusStreak(1), 0);
  assert.equal(P.bonusStreak(2), 1);
  assert.equal(P.bonusStreak(4), 1);
  assert.equal(P.bonusStreak(5), 2);
  assert.equal(P.bonusStreak(6), 3);
  assert.equal(P.bonusStreak(-3), 1);
  assert.equal(P.bonusStreak(-7), 3);
});

const catalog = {
  champs: [
    { id: 'A', n: 'Alfa', c: 1 },
    { id: 'B', n: 'Beta', c: 2 },
  ],
  items: [],
};

test('estadoInicial: nova partida em 1-1, vida 100, ouro 0', () => {
  const e = P.estadoInicial();
  assert.equal(e.stage, '1-1');
  assert.equal(e.hp, 100);
  assert.equal(e.gold, 0);
  assert.equal(e.level, 1);
  assert.equal(e.streak, 0);
  assert.deepEqual(e.champs, {});
  assert.deepEqual(e.comps, {});
  assert.deepEqual(e.contest, {});
  assert.equal(e.favorita, null);
});

test('sanitizarEstado: lixo vira estado valido, limites aplicados', () => {
  assert.deepEqual(P.sanitizarEstado(null, catalog), P.estadoInicial());
  assert.deepEqual(P.sanitizarEstado('x', catalog), P.estadoInicial());
  const e = P.sanitizarEstado({
    stage: '9-9', hp: 500, gold: -3, level: 40, streak: 99, xp: { atual: -1, max: 'a' },
    aprim: 'hack', board: 'x', champs: { A: 3, B: 'z', ZZ: 2, __proto__: 4 }, comps: { c1: 2, c2: 0 },
    contest: { s1: 9, s2: -1, s3: 2 }, favorita: { x: 1 },
  }, catalog);
  assert.equal(e.stage, '1-1');
  assert.equal(e.hp, 100);
  assert.equal(e.gold, 0);
  assert.equal(e.level, 10);
  assert.equal(e.streak, 20);
  assert.deepEqual(e.xp, { atual: null, max: null });
  assert.equal(e.aprim, '');
  assert.equal(e.board, 'auto');
  assert.deepEqual(e.champs, { A: 3 });
  assert.deepEqual(e.comps, { c1: 2 });
  assert.deepEqual(e.contest, { s1: 7, s3: 2 });
  assert.equal(e.favorita, null);
});

test('sanitizarEstado: estado valido passa intacto (idempotente)', () => {
  const bom = { stage: '3-2', hp: 70, gold: 32, level: 5, streak: -2, xp: { atual: 4, max: 36 }, aprim: 'eco', board: 'forte', champs: { A: 2 }, comps: { c1: 1 }, contest: { s1: 2 }, favorita: 's1' };
  const e = P.sanitizarEstado(bom, catalog);
  assert.deepEqual(e, Object.assign({ v: 1 }, bom));
  assert.deepEqual(P.sanitizarEstado(e, catalog), e);
});

test('forcaBoard: streak de vitoria = forte, de derrota = fraca, resto medio; override manual', () => {
  const e = (o) => Object.assign(P.estadoInicial(), o);
  assert.equal(P.forcaBoard(e({ streak: 3 })), 'forte');
  assert.equal(P.forcaBoard(e({ streak: 2 })), 'forte');
  assert.equal(P.forcaBoard(e({ streak: 1 })), 'medio');
  assert.equal(P.forcaBoard(e({ streak: 0 })), 'medio');
  assert.equal(P.forcaBoard(e({ streak: -2 })), 'fraco');
  assert.equal(P.forcaBoard(e({ streak: 4, board: 'fraco' })), 'fraco');
  assert.equal(P.forcaBoard(e({ streak: -4, board: 'forte' })), 'forte');
});

test('resumoUnidades: par = 2 copias; 3-8 copias = 2 estrelas; 9+ = 3 estrelas', () => {
  const cat = { champs: [
    { id: 'a', n: 'A', c: 1 }, { id: 'b', n: 'B', c: 1 }, { id: 'c', n: 'C', c: 2 }, { id: 'd', n: 'D', c: 3 }, { id: 'e', n: 'E', c: 4 },
  ], items: [] };
  const r = P.resumoUnidades({ champs: { a: 1, b: 2, c: 3, d: 8, e: 9 } }, cat);
  assert.equal(r.total, 23);
  assert.equal(r.pares, 1);
  assert.equal(r.estrelas2, 2);
  assert.equal(r.estrelas3, 1);
  assert.equal(P.estrelasDe(1), 1);
  assert.equal(P.estrelasDe(2), 1);
  assert.equal(P.estrelasDe(3), 2);
  assert.equal(P.estrelasDe(9), 3);
  assert.deepEqual(r.porCusto[1], { unidades: 2, copias: 3, maxCopias: 2, id: 'b' });
  assert.deepEqual(r.porCusto[2], { unidades: 1, copias: 3, maxCopias: 3, id: 'c' });
});
