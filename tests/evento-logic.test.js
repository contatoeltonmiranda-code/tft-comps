const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PJ = require('../js/posjogo-logic.js');
const Pl = require('../js/plano-logic.js');

// Deteccao de evento por monstros + override manual. Fixtures FICTICIAS (ids de unidade sao os do catalogo publico do Set 18).
const MONSTROS_IDS = ['DA_Krug18', 'DA_Murkwolf18', 'DA_CrimsonRaptor18', 'DA_18_Sentry', 'DA_Scuttlecrab18', 'DA_Brambleback18', 'DA_18_ElderDragon', 'DA_Cinderling18', 'DA_Sentinel18', 'DA_Gromp18_AP'];
const pU = (ids, fila, extra) => Object.assign({ id: 'BR1_' + ids.length + String(fila), fila, tipo: 'standard', eu: { colocacao: 4, unidades: ids.map((id) => ({ id, tier: 2, itens: [] })) } }, extra || {});

test('MONSTROS: so as 10 unidades neutras da selva; contarMonstros aceita id cru e id resolvido (c)', () => {
  assert.equal(PJ.MIN_MONSTROS_EVENTO, 7);
  assert.equal(PJ.contarMonstros(pU(MONSTROS_IDS, 1100)), 10);
  assert.equal(PJ.contarMonstros(pU(['DA_18_Ahri', 'DA_18_Lux_Elderwood', 'DA_18_Veigar', 'TFT18_Krug'], 1100)), 1, 'Lux Elderwood nao e Dragao Anciao; so Krug conta');
  const resolvida = { fila: 1100, eu: { unidades: [{ c: 'DA_Krug18', nome: 'Krugue' }, { c: null, nome: 'X' }, { c: 'DA_18_Ahri' }] } };
  assert.equal(PJ.contarMonstros(resolvida), 1);
  assert.equal(PJ.contarMonstros(null), 0);
  assert.equal(PJ.contarMonstros({ eu: {} }), 0);
});

test('statusEvento: fila do evento tem prioridade; 7+ monstros em fila regular = evento por monstros', () => {
  const sete = MONSTROS_IDS.slice(0, 7).concat(['DA_18_Morgana']);
  assert.deepEqual(PJ.statusEvento(pU(sete, 1100)), { evento: true, motivo: 'monstros', monstros: 7 });
  assert.deepEqual(PJ.statusEvento(pU(sete, 1090)), { evento: true, motivo: 'monstros', monstros: 7 });
  assert.equal(PJ.statusEvento(pU(MONSTROS_IDS.slice(0, 6), 1100)).evento, false, '6 monstros ainda e comp Fera do Rift possivel na ranqueada');
  assert.equal(PJ.statusEvento(pU(MONSTROS_IDS.slice(0, 6), 1100)).motivo, null);
  assert.deepEqual(PJ.statusEvento(pU(['DA_18_Ahri'], 1230)), { evento: true, motivo: 'fila', monstros: 0 }, 'fila 1230 sem monstros continua evento');
  assert.equal(PJ.statusEvento(pU(sete, 1230)).motivo, 'fila');
  assert.equal(PJ.statusEvento(pU(['DA_18_Ahri'], 1100)).evento, false);
  assert.equal(PJ.statusEvento(pU(sete, null)).motivo, 'monstros', 'sem fila, monstros ainda valem');
  assert.equal(PJ.statusEvento(pU([], null)).evento, false);
});

test('statusEvento: override manual vence a deteccao nos dois sentidos', () => {
  const sete = MONSTROS_IDS.slice(0, 7);
  const a = pU(sete, 1100, { id: 'BR1_A' });
  const b = pU(['DA_18_Ahri'], 1230, { id: 'BR1_B' });
  const c = pU(['DA_18_Ahri'], 1100, { id: 'BR1_C' });
  assert.deepEqual(PJ.statusEvento(a, { BR1_A: 'regular' }), { evento: false, motivo: 'manual-regular', monstros: 7 });
  assert.deepEqual(PJ.statusEvento(b, { BR1_B: 'regular' }), { evento: false, motivo: 'manual-regular', monstros: 0 });
  assert.deepEqual(PJ.statusEvento(c, { BR1_C: 'evento' }), { evento: true, motivo: 'manual-evento', monstros: 0 });
  assert.equal(PJ.statusEvento(a, { BR1_OUTRA: 'regular' }).motivo, 'monstros', 'override de outra partida nao afeta');
  assert.equal(PJ.statusEvento(a, { BR1_A: 'lixo' }).motivo, 'monstros', 'valor invalido e ignorado');
  assert.equal(PJ.ehEventoPartida(a, { BR1_A: 'regular' }), false);
});

test('rotuloMotivo: textos mostrados no card', () => {
  assert.equal(PJ.rotuloMotivo('fila'), 'fila do evento');
  assert.equal(PJ.rotuloMotivo('monstros'), 'monstros no tabuleiro');
  assert.equal(PJ.rotuloMotivo('manual-evento'), 'marcado por você');
  assert.equal(PJ.rotuloMotivo('manual-regular'), 'marcado por você');
  assert.equal(PJ.rotuloMotivo(null), '');
});

test('entraNasEstatisticas respeita monstros e override; pve nunca', () => {
  const sete = MONSTROS_IDS.slice(0, 7);
  const a = pU(sete, 1100, { id: 'BR1_A' });
  assert.equal(PJ.entraNasEstatisticas(a), false, 'monstros = evento = fora por padrao');
  assert.equal(PJ.entraNasEstatisticas(a, { incluirEvento: true }), true);
  assert.equal(PJ.entraNasEstatisticas(a, { overrides: { BR1_A: 'regular' } }), true);
  const b = pU(['DA_18_Ahri'], 1230, { id: 'BR1_B' });
  assert.equal(PJ.entraNasEstatisticas(b, { overrides: { BR1_B: 'regular' } }), true);
  const c = pU(['DA_18_Ahri'], 1100, { id: 'BR1_C' });
  assert.equal(PJ.entraNasEstatisticas(c, { overrides: { BR1_C: 'evento' } }), false);
  assert.equal(PJ.entraNasEstatisticas(pU([], 1220, { id: 'BR1_P', tipo: 'pve' }), { overrides: { BR1_P: 'regular' }, incluirEvento: true }), false);
});

test('estatisticas: override muda o que conta', () => {
  const sete = MONSTROS_IDS.slice(0, 7);
  const mk = (id, ids, fila, col) => ({ partida: Object.assign(pU(ids, fila, { id }), { eu: { colocacao: col, unidades: ids.map((x) => ({ id: x })) } }), comp: null, estilo: { id: 'fast8' } });
  const aps = [mk('BR1_A', sete, 1100, 8), mk('BR1_B', ['DA_18_Ahri'], 1230, 1), mk('BR1_C', ['DA_18_Ahri'], 1100, 2)];
  assert.equal(PJ.estatisticas(aps, 10).total, 1);
  assert.equal(PJ.estatisticas(aps, 10, { overrides: { BR1_A: 'regular', BR1_B: 'regular' } }).total, 3);
  assert.equal(PJ.estatisticas(aps, 10, { overrides: { BR1_C: 'evento' } }).total, 0);
});

test('overrides: so matchId -> evento|regular, sanitizado, com limite', () => {
  assert.equal(PJ.CHAVE_OVERRIDE, 'tft-comps:posjogo-override:v1');
  assert.deepEqual(PJ.lerOverrides(null), {});
  assert.deepEqual(PJ.lerOverrides('{quebrado'), {});
  assert.deepEqual(PJ.lerOverrides('[1,2]'), {});
  assert.deepEqual(PJ.lerOverrides(JSON.stringify({ BR1_A: 'evento', BR1_B: 'regular', BR1_C: 'x', 'a b': 'evento', BR1_D: 5 })), { BR1_A: 'evento', BR1_B: 'regular' });
  assert.deepEqual(PJ.lerOverrides('{"__proto__":"evento","BR1_A":"evento"}'), { BR1_A: 'evento' });
  const m1 = PJ.definirOverride({ BR1_A: 'evento' }, 'BR1_B', 'regular');
  assert.deepEqual(m1, { BR1_A: 'evento', BR1_B: 'regular' });
  assert.deepEqual(PJ.definirOverride(m1, 'BR1_A', null), { BR1_B: 'regular' }, 'null desfaz');
  assert.deepEqual(PJ.definirOverride(m1, 'id ruim!', 'evento'), m1, 'id invalido ignorado');
  assert.deepEqual(PJ.definirOverride(m1, 'BR1_Z', 'qualquer'), m1);
  assert.deepEqual(m1, { BR1_A: 'evento', BR1_B: 'regular' }, 'nao muta a entrada');
  const grande = {};
  for (let i = 0; i < 700; i++) grande['BR1_' + i] = 'evento';
  const lido = PJ.lerOverrides(JSON.stringify(grande));
  assert.ok(Object.keys(lido).length <= 500, 'limite de entradas');
  const novo = PJ.definirOverride(lido, 'BR1_NOVO', 'evento');
  assert.ok(Object.keys(novo).length <= 500);
  assert.equal(novo.BR1_NOVO, 'evento', 'a nova entra mesmo no limite');
});

test('plano: override do Pos-jogo muda o historico', () => {
  const comps = [{ id: 'c3', nome: 'c3', estilo: 'Fast 8', main: [{ c: 'DA_18_Ahri', s: 2, i: [] }], itens: [] }];
  const base = { comps, noticias: [], catalog: { champs: [], traits: [], items: [] } };
  const an = (id, fila, col, ids) => ({ partida: { id: 'BR1_' + id, quando: Number(id), fila, tipo: 'standard', eu: { colocacao: col, unidades: ids.map((x) => ({ id: x })) } }, comp: { id: 'c3', nome: 'c3' }, estilo: { id: 'fast8' } });
  const sete = MONSTROS_IDS.slice(0, 7);
  const analises = [an('1', 1100, 1, sete), an('2', 1230, 1, []), an('3', 1100, 2, [])];
  assert.equal(Pl.montarPlano({ ...base, analises }).fontes.partidas, 1, 'monstros e fila 1230 saem');
  assert.equal(Pl.montarPlano({ ...base, analises, overrides: { BR1_1: 'regular', BR1_2: 'regular' } }).fontes.partidas, 3);
  assert.equal(Pl.montarPlano({ ...base, analises, overrides: { BR1_3: 'evento' } }).fontes.partidas, 0);
});

test('posjogo.js e plano.js usam o mesmo override do localStorage', () => {
  const js = fs.readFileSync(path.join(__dirname, '../js/posjogo.js'), 'utf8');
  assert.match(js, /Isto foi evento/);
  assert.match(js, /Isto foi ranqueada/);
  assert.match(js, /PJ\.CHAVE_OVERRIDE/);
  assert.match(js, /PJ\.statusEvento/);
  assert.match(js, /PJ\.rotuloMotivo/);
  const pl = fs.readFileSync(path.join(__dirname, '../js/plano.js'), 'utf8');
  assert.match(pl, /PJ\.CHAVE_OVERRIDE/);
  assert.match(pl, /overrides/);
});
