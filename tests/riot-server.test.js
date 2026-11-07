const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const S = require('../tools/riot-server.js');
const L = require('../tools/riot-lib.js');

const CHAVE = 'RGAPI-12345678-1234-1234-1234-123456789abc';
const PAGES = 'https://contatoeltonmiranda-code.github.io';

function dirComDados() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tft-srv-'));
  fs.writeFileSync(path.join(d, 'riot-key.txt'), CHAVE);
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ riotId: 'Segredo#BR1', puuid: 'PUUID-SECRETO' }));
  const reg = { id: 'BR1_1', quando: 5, duracao: 100, versao: 'v', fila: 1100, tipo: 'standard', set: 18, eu: { colocacao: 2, nivel: 8, ultimaRodada: 30, ouroRestante: 1, eliminados: 0, dano: 1, augments: [], tracos: [], unidades: [] } };
  fs.writeFileSync(path.join(d, 'partidas.json'), JSON.stringify({ versao: 1, atualizadoEm: 'x', partidas: [reg] }));
  fs.writeFileSync(path.join(d, 'status.json'), JSON.stringify({ resultado: 'ok', novas: 1, total: 1, ultimaExecucao: 'x' }));
  return d;
}

async function subir(dir) {
  const srv = S.criarServidor({ dir, env: {} });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { srv, porta: srv.address().port };
}

function pedir(porta, { metodo = 'GET', caminho = '/', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: porta, method: metodo, path: caminho, headers, setHost: !('Host' in headers) }, (res) => {
      let corpo = '';
      res.on('data', (c) => (corpo += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, corpo }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('escuta somente em 127.0.0.1', async () => {
  const { srv } = await subir(dirComDados());
  assert.equal(srv.address().address, '127.0.0.1');
  srv.close();
});

test('GET /api/partidas devolve o historico; GET /api/status resume sem expor chave nem Riot ID', async () => {
  const { srv, porta } = await subir(dirComDados());
  const p = await pedir(porta, { caminho: '/api/partidas' });
  assert.equal(p.status, 200);
  assert.match(p.headers['content-type'], /application\/json/);
  assert.equal(JSON.parse(p.corpo).partidas.length, 1);
  const s = await pedir(porta, { caminho: '/api/status' });
  const st = JSON.parse(s.corpo);
  assert.equal(st.chave, 'ok');
  assert.equal(st.configurado, true);
  assert.equal(st.partidas, 1);
  [p.corpo, s.corpo].forEach((t) => assert.ok(!/RGAPI|PUUID-SECRETO|Segredo/.test(t), 'vazou: ' + t));
  srv.close();
});

test('sem arquivos: partidas vazio e status diz o que falta', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tft-vazio-'));
  const { srv, porta } = await subir(d);
  const p = JSON.parse((await pedir(porta, { caminho: '/api/partidas' })).corpo);
  assert.deepEqual(p.partidas, []);
  const st = JSON.parse((await pedir(porta, { caminho: '/api/status' })).corpo);
  assert.equal(st.chave, 'ausente');
  assert.equal(st.configurado, false);
  srv.close();
});

test('cabecalhos de seguranca em toda resposta', async () => {
  const { srv, porta } = await subir(dirComDados());
  const r = await pedir(porta, { caminho: '/api/partidas' });
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['cross-origin-resource-policy'], 'same-site');
  srv.close();
});

test('CORS: libera o Pages e localhost; recusa qualquer outra origem (403, sem Allow-Origin)', async () => {
  const { srv, porta } = await subir(dirComDados());
  for (const o of [PAGES, 'http://localhost:8765', 'http://127.0.0.1:8765']) {
    const r = await pedir(porta, { caminho: '/api/partidas', headers: { Origin: o } });
    assert.equal(r.status, 200, o);
    assert.equal(r.headers['access-control-allow-origin'], o);
    assert.match(r.headers.vary, /Origin/);
  }
  for (const o of ['https://evil.example.com', 'http://localhost.evil.com', 'https://contatoeltonmiranda-code.github.io.evil.com', 'null', 'http://127.0.0.1.evil.com:80', PAGES + '/', 'http://contatoeltonmiranda-code.github.io']) {
    const r = await pedir(porta, { caminho: '/api/partidas', headers: { Origin: o } });
    assert.equal(r.status, 403, o);
    assert.equal(r.headers['access-control-allow-origin'], undefined, o);
    assert.ok(!r.corpo.includes('partidas'), 'nao devolve dados a origem recusada');
  }
  srv.close();
});

test('preflight OPTIONS: so GET, aceita Private Network Access', async () => {
  const { srv, porta } = await subir(dirComDados());
  const r = await pedir(porta, { metodo: 'OPTIONS', caminho: '/api/partidas', headers: { Origin: PAGES, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Private-Network': 'true' } });
  assert.equal(r.status, 204);
  assert.equal(r.headers['access-control-allow-origin'], PAGES);
  assert.equal(r.headers['access-control-allow-methods'], 'GET, OPTIONS');
  assert.equal(r.headers['access-control-allow-private-network'], 'true');
  const ruim = await pedir(porta, { metodo: 'OPTIONS', caminho: '/api/partidas', headers: { Origin: 'https://evil.example.com' } });
  assert.equal(ruim.status, 403);
  srv.close();
});

test('so leitura: POST, PUT, DELETE, PATCH viram 405', async () => {
  const { srv, porta } = await subir(dirComDados());
  for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const r = await pedir(porta, { metodo: m, caminho: '/api/partidas' });
    assert.equal(r.status, 405, m);
    assert.equal(r.headers.allow, 'GET, OPTIONS');
  }
  srv.close();
});

test('DNS rebinding: Host diferente de 127.0.0.1/localhost com a porta e recusado', async () => {
  const { srv, porta } = await subir(dirComDados());
  for (const h of ['evil.example.com', 'evil.example.com:' + porta, '127.0.0.1.evil.com:' + porta, 'localhost:1']) {
    const r = await pedir(porta, { caminho: '/api/partidas', headers: { Host: h } });
    assert.equal(r.status, 403, h);
  }
  const ok = await pedir(porta, { caminho: '/api/partidas', headers: { Host: 'localhost:' + porta } });
  assert.equal(ok.status, 200);
  srv.close();
});

test('rotas desconhecidas e tentativas de path traversal viram 404 e nunca tocam o disco', async () => {
  const { srv, porta } = await subir(dirComDados());
  for (const c of ['/', '/riot-key.txt', '/config.json', '/api/../riot-key.txt', '/api/%2e%2e/riot-key.txt', '/api/partidas/../../config.json', '/..%2f..%2fetc/passwd', '/api/partidas?x=../../riot-key.txt-vazio']) {
    const r = await pedir(porta, { caminho: c });
    assert.ok([403, 404, 200].includes(r.status), c + ' -> ' + r.status);
    assert.ok(!/RGAPI|PUUID-SECRETO|Segredo/.test(r.corpo), c);
    if (!c.startsWith('/api/partidas?')) assert.equal(r.status, 404, c);
  }
  srv.close();
});

test('arquivo de partidas adulterado ou gigante nao derruba nem injeta lixo', async () => {
  const d = dirComDados();
  fs.writeFileSync(path.join(d, 'partidas.json'), '{{{ nao e json');
  let { srv, porta } = await subir(d);
  let r = await pedir(porta, { caminho: '/api/partidas' });
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse(r.corpo).partidas, []);
  srv.close();
  fs.writeFileSync(path.join(d, 'partidas.json'), JSON.stringify({ partidas: [{ id: '<script>alert(1)</script>', eu: { colocacao: 1 } }, { id: 'BR1_1', eu: { colocacao: 99 } }] }));
  ({ srv, porta } = await subir(d));
  r = await pedir(porta, { caminho: '/api/partidas' });
  assert.deepEqual(JSON.parse(r.corpo).partidas, []);
  srv.close();
});

test('porta: padrao 17870, aceita config e variavel, rejeita fora de 1024-65535', () => {
  assert.equal(S.portaDe(null, {}), 17870);
  assert.equal(S.portaDe({ porta: 18000 }, {}), 18000);
  assert.equal(S.portaDe({ porta: 18000 }, { TFT_COMPS_PORTA: '18500' }), 18500);
  assert.equal(S.portaDe({ porta: 80 }, {}), 17870);
  assert.equal(S.portaDe({ porta: 'x' }, { TFT_COMPS_PORTA: '99999' }), 17870);
});

test('origemPermitida: casos de borda', () => {
  assert.equal(S.origemPermitida(PAGES), true);
  assert.equal(S.origemPermitida('http://localhost'), true);
  assert.equal(S.origemPermitida('http://localhost:abc'), false);
  assert.equal(S.origemPermitida('https://localhost:8765'), false, 'https em localhost nao e a origem do projeto');
  assert.equal(S.origemPermitida(undefined), true, 'sem Origin = nao e navegador de outro site');
  assert.equal(S.origemPermitida(''), false);
});

test('o servidor nunca le o conteudo da chave nem fala com a Riot', () => {
  const src = fs.readFileSync(path.join(__dirname, '../tools/riot-server.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/lerChave|readFileSync\([^)]*key/i.test(src), 'servidor so deve saber se a chave existe');
  assert.ok(!/https?\.request|fetch\(|api\.riotgames|X-Riot-Token/.test(src), 'servidor nao fala com a Riot');
  assert.ok(typeof L.lerChave === 'function');
});
