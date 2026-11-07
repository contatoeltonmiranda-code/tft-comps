const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const L = require('../tools/riot-lib.js');

const CHAVE = 'RGAPI-12345678-1234-1234-1234-123456789abc';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tft-riot-'));
const resp = (status, body, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

function cliente(rotas, extra = {}) {
  const chamadas = [];
  const esperas = [];
  const fetchFn = async (url, opts) => {
    chamadas.push({ url, opts });
    const r = rotas(url, chamadas.length);
    if (r instanceof Error) throw r;
    return r;
  };
  const c = L.criarCliente({ chave: CHAVE, fetchFn, sleep: async (ms) => { esperas.push(ms); }, agora: () => 0, ...extra });
  return { c, chamadas, esperas };
}

test('dirDados: usa TFT_COMPS_DIR, senao %LOCALAPPDATA%\\tft-comps', () => {
  assert.equal(L.dirDados({ TFT_COMPS_DIR: 'C:\\x\\y' }), path.resolve('C:\\x\\y'));
  assert.equal(L.dirDados({ LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' }), path.join('C:\\Users\\a\\AppData\\Local', 'tft-comps'));
});

test('dirDados recusa pasta dentro do OneDrive ou do repositorio (dados pessoais e chave nunca la)', () => {
  assert.throws(() => L.dirDados({ TFT_COMPS_DIR: 'C:\\Users\\a\\OneDrive\\Documentos\\tft' }), /OneDrive/);
  assert.throws(() => L.dirDados({ TFT_COMPS_DIR: path.join(__dirname, '..', 'dados') }), /reposit/i);
});

test('lerChave: variavel de ambiente vence o arquivo; formato invalido e ignorado', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'riot-key.txt'), '  ' + CHAVE + '\r\n');
  assert.equal(L.lerChave(d, {}), CHAVE);
  assert.equal(L.lerChave(d, { RIOT_API_KEY: 'RGAPI-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }), 'RGAPI-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  fs.writeFileSync(path.join(d, 'riot-key.txt'), 'qualquer coisa');
  assert.equal(L.lerChave(d, {}), null);
  assert.equal(L.lerChave(tmp(), {}), null);
});

test('chaveValida: so o formato RGAPI-...', () => {
  assert.ok(L.chaveValida(CHAVE));
  assert.ok(!L.chaveValida('RGAPI-'));
  assert.ok(!L.chaveValida('abc'));
  assert.ok(!L.chaveValida(CHAVE + '\n&rm'));
});

test('riotId: valida nome#tag', () => {
  assert.deepEqual(L.parseRiotId('Fulano#BR1'), { nome: 'Fulano', tag: 'BR1' });
  assert.deepEqual(L.parseRiotId('  José Silva #12345 '), { nome: 'José Silva', tag: '12345' });
  assert.equal(L.parseRiotId('semtag'), null);
  assert.equal(L.parseRiotId('a#b'), null);
  assert.equal(L.parseRiotId('a/b#BR1'), null, 'barra no nome nao entra na URL');
  assert.equal(L.parseRiotId('Nome#TAG_LONGA'), null);
});

test('cliente: chave so vai no cabecalho X-Riot-Token e so para *.api.riotgames.com', async () => {
  const { c, chamadas } = cliente(() => resp(200, { puuid: 'p' }));
  await c.resolverPuuid({ nome: 'Fulano', tag: 'BR1' });
  assert.match(chamadas[0].url, /^https:\/\/americas\.api\.riotgames\.com\/riot\/account\/v1\/accounts\/by-riot-id\/Fulano\/BR1$/);
  assert.equal(chamadas[0].opts.headers['X-Riot-Token'], CHAVE);
  assert.ok(!chamadas[0].url.includes('RGAPI'), 'chave nunca na URL');
  assert.throws(() => L.criarCliente({ chave: CHAVE, fetchFn: async () => {}, regiao: 'evil.example.com/' }), /regi/i);
});

test('cliente: nome com espaco/acento/barra e codificado na URL', async () => {
  const { c, chamadas } = cliente(() => resp(200, { puuid: 'p' }));
  await c.resolverPuuid({ nome: 'José Silva', tag: 'BR1' });
  assert.match(chamadas[0].url, /by-riot-id\/Jos%C3%A9%20Silva\/BR1$/);
});

test('cliente: lista ids e baixa partida nos caminhos oficiais da tft-match-v1', async () => {
  const { c, chamadas } = cliente((url) => (url.includes('/ids') ? resp(200, ['BR1_1', 'BR1_2']) : resp(200, { metadata: { match_id: 'BR1_1' } })));
  assert.deepEqual(await c.listarIds('PUUID_X', { count: 20 }), ['BR1_1', 'BR1_2']);
  await c.buscarPartida('BR1_1');
  assert.equal(chamadas[0].url, 'https://americas.api.riotgames.com/tft/match/v1/matches/by-puuid/PUUID_X/ids?start=0&count=20');
  assert.equal(chamadas[1].url, 'https://americas.api.riotgames.com/tft/match/v1/matches/BR1_1');
  await assert.rejects(() => c.buscarPartida('../../etc'), /id/i);
});

test('429: espera o Retry-After e tenta de novo; gasta no maximo 3 tentativas', async () => {
  let n = 0;
  const { c, esperas } = cliente(() => (++n < 3 ? resp(429, {}, { 'retry-after': '7' }) : resp(200, ['BR1_7'])));
  assert.deepEqual(await c.listarIds('P', {}), ['BR1_7']);
  assert.deepEqual(esperas.filter((e) => e >= 7000), [7000, 7000]);
  const { c: c2 } = cliente(() => resp(429, {}, { 'retry-after': '1' }));
  await assert.rejects(() => c2.listarIds('P', {}), (e) => e.codigo === 'limite');
});

test('429 sem Retry-After usa espera padrao e limita o teto em 2 minutos', async () => {
  let n = 0;
  const { c, esperas } = cliente(() => (++n < 2 ? resp(429, {}, { 'retry-after': '99999' }) : resp(200, [])));
  await c.listarIds('P', {});
  assert.ok(esperas.includes(120000));
});

test('401/403: erro de chave, sem repetir e sem vazar a chave na mensagem', async () => {
  for (const status of [401, 403]) {
    const { c, chamadas } = cliente(() => resp(status, { status: { message: 'Forbidden' } }));
    await assert.rejects(() => c.listarIds('P', {}), (e) => e.codigo === 'chave' && !String(e.message).includes('RGAPI') && !String(e.stack).includes(CHAVE));
    assert.equal(chamadas.length, 1);
  }
});

test('404 vira erro nao-encontrado; 5xx e rede tentam de novo e depois falham', async () => {
  const { c } = cliente(() => resp(404, {}));
  await assert.rejects(() => c.resolverPuuid({ nome: 'abc', tag: 'BR1' }), (e) => e.codigo === 'nao-encontrado');
  let n = 0;
  const { c: c2, chamadas } = cliente(() => (++n < 2 ? resp(503, {}) : resp(200, ['BR1_9'])));
  assert.deepEqual(await c2.listarIds('P', {}), ['BR1_9']);
  assert.equal(chamadas.length, 2);
  const { c: c3 } = cliente(() => new Error('ECONNRESET'));
  await assert.rejects(() => c3.listarIds('P', {}), (e) => e.codigo === 'rede');
});

test('limitador: nunca passa de 18 chamadas por segundo (segura abaixo dos 20/s da chave pessoal)', async () => {
  let agora = 0;
  const esperas = [];
  const c = L.criarCliente({
    chave: CHAVE,
    fetchFn: async () => resp(200, []),
    sleep: async (ms) => { esperas.push(ms); agora += ms; },
    agora: () => agora,
  });
  for (let i = 0; i < 40; i++) await c.listarIds('P', {});
  assert.ok(esperas.length > 0, 'precisou esperar');
  const total = esperas.reduce((s, x) => s + x, 0);
  assert.ok(total >= 1000, 'tempo total >= 1s para 40 chamadas: ' + total);
});

const rawDe = (id, quando, col) => ({
  metadata: { match_id: id },
  info: { game_datetime: quando, game_length: 1800, queue_id: 1100, tft_set_number: 18, participants: [{ puuid: 'EU', placement: col, level: 8, last_round: 36, gold_left: 5, units: [{ character_id: 'TFT18_Ahri', tier: 2, itemNames: [] }] }] },
});

test('sincronizar: baixa so as partidas novas, grava atomico e atualiza o status', async () => {
  const d = tmp();
  const baixadas = [];
  let ids = ['BR1_3', 'BR1_2', 'BR1_1'];
  const { c } = cliente((url) => {
    if (url.includes('/ids')) return resp(200, ids);
    const id = url.split('/').pop();
    baixadas.push(id);
    return resp(200, rawDe(id, 1000 + Number(id.split('_')[1]), 2));
  });
  const r1 = await L.sincronizar({ cliente: c, dir: d, puuid: 'EU' });
  assert.equal(r1.novas, 3);
  assert.deepEqual(baixadas.sort(), ['BR1_1', 'BR1_2', 'BR1_3']);
  const arq = JSON.parse(fs.readFileSync(path.join(d, 'partidas.json'), 'utf8'));
  assert.equal(arq.partidas.length, 3);
  assert.equal(arq.partidas[0].id, 'BR1_3', 'mais nova primeiro');
  assert.ok(!JSON.stringify(arq).includes('EU"'), 'sem puuid no arquivo');
  assert.deepEqual(fs.readdirSync(d).filter((f) => f.includes('.tmp')), [], 'sem arquivo temporario');
  ids = ['BR1_4', 'BR1_3', 'BR1_2', 'BR1_1'];
  baixadas.length = 0;
  const r2 = await L.sincronizar({ cliente: c, dir: d, puuid: 'EU' });
  assert.equal(r2.novas, 1);
  assert.deepEqual(baixadas, ['BR1_4']);
  const st = JSON.parse(fs.readFileSync(path.join(d, 'status.json'), 'utf8'));
  assert.equal(st.resultado, 'ok');
  assert.equal(st.total, 4);
  const r3 = await L.sincronizar({ cliente: c, dir: d, puuid: 'EU' });
  assert.equal(r3.novas, 0);
});

test('sincronizar: limita o numero de partidas novas por execucao', async () => {
  const d = tmp();
  const todos = Array.from({ length: 80 }, (_, i) => 'BR1_' + (100 - i));
  const { c, chamadas } = cliente((url) => (url.includes('/ids') ? resp(200, todos) : resp(200, rawDe(url.split('/').pop(), 5000, 3))));
  const r = await L.sincronizar({ cliente: c, dir: d, puuid: 'EU', maxNovas: 10 });
  assert.equal(r.novas, 10);
  assert.equal(chamadas.length, 11);
});

test('sincronizar: partida que falha (404) e pulada, e uma que nao e do jogador nao entra', async () => {
  const d = tmp();
  const { c } = cliente((url) => {
    if (url.includes('/ids')) return resp(200, ['BR1_1', 'BR1_2', 'BR1_3']);
    if (url.endsWith('BR1_2')) return resp(404, {});
    if (url.endsWith('BR1_3')) return resp(200, { ...rawDe('BR1_3', 3, 1), info: { ...rawDe('BR1_3', 3, 1).info, participants: [{ puuid: 'OUTRO', placement: 1 }] } });
    return resp(200, rawDe('BR1_1', 1, 4));
  });
  const r = await L.sincronizar({ cliente: c, dir: d, puuid: 'EU' });
  assert.equal(r.novas, 1);
  assert.equal(r.puladas, 2);
});

test('sincronizar: chave invalida grava status chave-invalida e relanca', async () => {
  const d = tmp();
  const { c } = cliente(() => resp(403, {}));
  await assert.rejects(() => L.sincronizar({ cliente: c, dir: d, puuid: 'EU' }), (e) => e.codigo === 'chave');
  assert.equal(JSON.parse(fs.readFileSync(path.join(d, 'status.json'), 'utf8')).resultado, 'chave-invalida');
});

test('trava: duas execucoes ao mesmo tempo nao se atropelam; trava velha e ignorada', () => {
  const d = tmp();
  const a = L.pegarTrava(d, 1000);
  assert.ok(a);
  assert.equal(L.pegarTrava(d, 2000), null);
  a();
  assert.ok(L.pegarTrava(d, 3000));
  const velho = path.join(d, 'fetch.lock');
  fs.writeFileSync(velho, '1');
  const antigo = new Date(Date.now() - 3600 * 1000);
  fs.utimesSync(velho, antigo, antigo);
  assert.ok(L.pegarTrava(d, Date.now()), 'trava de 1 hora atras e considerada morta');
});
