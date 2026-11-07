const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/partidas-fonte.js');

const reg = (id, col = 3, quando = 10) => ({ id, quando, eu: { colocacao: col, nivel: 8, ultimaRodada: 30, unidades: [] } });
const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};
const resp = (corpo, ok = true) => ({ ok, json: async () => corpo });
const exemplo = { partidas: [reg('EXEMPLO_01')] };

function rede(rotas) {
  const chamadas = [];
  const fetchFn = async (url, opts) => {
    chamadas.push({ url, opts });
    const r = rotas(url);
    if (r instanceof Error) throw r;
    return r;
  };
  return { fetchFn, chamadas };
}

test('portaDe: padrao 17870; ?porta= valido entre 1024 e 65535', () => {
  assert.equal(F.portaDe(''), 17870);
  assert.equal(F.portaDe('?porta=18000'), 18000);
  assert.equal(F.portaDe('?porta=80'), 17870);
  assert.equal(F.portaDe('?porta=abc'), 17870);
  assert.equal(F.portaDe('?x=1&porta=65535'), 65535);
});

test('servidor local no ar com partidas: origem local, chama so 127.0.0.1, sem credenciais, e guarda copia', async () => {
  const { fetchFn, chamadas } = rede((u) => (u.endsWith('/api/status') ? resp({ chave: 'ok', configurado: true }) : resp({ partidas: [reg('BR1_1'), reg('BR1_2', 5, 20)], atualizadoEm: '2026-11-07T10:00:00Z' })));
  const st = memoria();
  const r = await F.carregar({ fetchFn, storage: st, exemplo, search: '' });
  assert.equal(r.origem, 'local');
  assert.deepEqual(r.partidas.map((p) => p.id), ['BR1_2', 'BR1_1']);
  chamadas.forEach((c) => {
    assert.match(c.url, /^http:\/\/127\.0\.0\.1:17870\/api\/(partidas|status)$/);
    assert.equal(c.opts.credentials, 'omit');
    assert.equal(c.opts.method, 'GET');
  });
  assert.ok(st.getItem(F.CHAVE_CACHE));
});

test('servidor off e sem copia: mostra o exemplo (nunca como se fosse real)', async () => {
  const { fetchFn } = rede(() => new Error('Failed to fetch'));
  const r = await F.carregar({ fetchFn, storage: memoria(), exemplo, search: '' });
  assert.equal(r.origem, 'exemplo');
  assert.equal(r.motivo, 'offline');
  assert.equal(r.partidas[0].id, 'EXEMPLO_01');
});

test('servidor off com copia anterior: usa a copia e avisa a data', async () => {
  const st = memoria();
  st.setItem(F.CHAVE_CACHE, JSON.stringify({ salvoEm: '2026-11-06T10:00:00.000Z', origem: 'local', partidas: [reg('BR1_9')] }));
  const { fetchFn } = rede(() => new Error('x'));
  const r = await F.carregar({ fetchFn, storage: st, exemplo, search: '' });
  assert.equal(r.origem, 'cache');
  assert.equal(r.partidas[0].id, 'BR1_9');
  assert.equal(r.salvoEm, '2026-11-06T10:00:00.000Z');
});

test('servidor no ar mas sem partidas: exemplo com o motivo vindo do status (sem chave, sem config, chave expirada)', async () => {
  for (const [st, motivo] of [[{ chave: 'ausente', configurado: false }, 'sem-config'], [{ chave: 'ausente', configurado: true }, 'sem-chave'], [{ chave: 'ok', configurado: true, resultado: 'chave-invalida' }, 'chave-invalida'], [{ chave: 'ok', configurado: true, resultado: 'ok' }, 'vazio']]) {
    const { fetchFn } = rede((u) => (u.endsWith('/api/status') ? resp(st) : resp({ partidas: [] })));
    const r = await F.carregar({ fetchFn, storage: memoria(), exemplo, search: '' });
    assert.equal(r.origem, 'exemplo');
    assert.equal(r.motivo, motivo);
  }
});

test('resposta com lixo ou HTTP de erro nao quebra: cai no exemplo', async () => {
  const a = await F.carregar({ fetchFn: rede(() => resp({ partidas: [{ id: '<x>' }, null, 5] })).fetchFn, storage: memoria(), exemplo, search: '' });
  assert.equal(a.origem, 'exemplo');
  const b = await F.carregar({ fetchFn: rede(() => resp({}, false)).fetchFn, storage: memoria(), exemplo, search: '' });
  assert.equal(b.origem, 'exemplo');
  const c = await F.carregar({ fetchFn: rede(() => ({ ok: true, json: async () => { throw new Error('json'); } })).fetchFn, storage: memoria(), exemplo, search: '' });
  assert.equal(c.origem, 'exemplo');
});

test('storage quebrado (modo privado) nao impede de carregar', async () => {
  const ruim = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
  const { fetchFn } = rede((u) => (u.endsWith('/api/status') ? resp({}) : resp({ partidas: [reg('BR1_1')] })));
  const r = await F.carregar({ fetchFn, storage: ruim, exemplo, search: '' });
  assert.equal(r.origem, 'local');
});

test('importarTexto: valida, sanitiza e guarda; recusa lixo, JSON invalido e arquivo enorme', () => {
  const st = memoria();
  const ok = F.importarTexto(JSON.stringify({ partidas: [reg('BR1_1'), { id: '<x>' }] }), st);
  assert.equal(ok.ok, true);
  assert.equal(ok.partidas.length, 1);
  assert.equal(ok.descartadas, 1);
  assert.equal(JSON.parse(st.getItem(F.CHAVE_CACHE)).origem, 'arquivo');
  assert.equal(F.importarTexto('{{{', st).ok, false);
  assert.equal(F.importarTexto(JSON.stringify({ partidas: [] }), st).ok, false);
  assert.equal(F.importarTexto('x'.repeat(9 * 1024 * 1024), st).ok, false);
});

test('esquecer apaga a copia', () => {
  const st = memoria();
  st.setItem(F.CHAVE_CACHE, '{}');
  F.esquecer(st);
  assert.equal(st.getItem(F.CHAVE_CACHE), null);
});

test('lerReais: so devolve historico real (local, arquivo ou copia), nunca o exemplo', async () => {
  const st = memoria();
  assert.deepEqual(F.lerReais(st), []);
  F.importarTexto(JSON.stringify({ partidas: [reg('BR1_1')] }), st);
  assert.equal(F.lerReais(st).length, 1);
});
