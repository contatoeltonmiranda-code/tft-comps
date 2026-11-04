const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sondar, resumir, textoFinal } = require('../sonda/liveclient.js');

function servidor(rotas) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const r = rotas[req.url];
      if (!r) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('nao');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(r));
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sonda-'));

test('sonda grava o que a API entrega, remove aprimoramentos e resume as chaves', async () => {
  const s = await servidor({
    '/liveclientdata/allgamedata': { gameData: { gameMode: 'TFT', gameTime: 12 }, activePlayer: { level: 3 }, picked_augment: 'DA_X', nested: { customAugmentContainer: 'DA_Y', ok: 1 } },
  });
  const dir = tmp();
  const res = await sondar({ url: 'http://127.0.0.1:' + s.address().port, intervaloMs: 5, maxAmostras: 3, saidaDir: dir, log: () => {} });
  s.close();
  const doc = JSON.parse(fs.readFileSync(res.arquivo, 'utf8'));
  assert.equal(doc.versao, 1);
  const all = doc.resumo.endpoints['/liveclientdata/allgamedata'];
  assert.equal(all.ok, 3);
  assert.deepEqual(all.chavesTopo.sort(), ['activePlayer', 'gameData', 'nested']);
  assert.equal(doc.resumo.endpoints['/liveclientdata/gamestats'].status['404'], 3);
  assert.equal(JSON.stringify(doc).includes('DA_X'), false);
  assert.equal(JSON.stringify(doc).includes('DA_Y'), false);
  assert.equal(doc.amostras.filter((a) => a.endpoint.endsWith('allgamedata')).length, 1, 'respostas iguais sao agrupadas');
  assert.equal(doc.amostras.find((a) => a.endpoint.endsWith('allgamedata')).repeticoes, 3);
  assert.match(textoFinal(res), /A API respondeu/);
});

test('sonda sem API no ar registra erro de conexao e nao quebra', async () => {
  const s = await servidor({});
  const porta = s.address().port;
  await new Promise((ok) => s.close(ok));
  const res = await sondar({ url: 'http://127.0.0.1:' + porta, intervaloMs: 5, maxAmostras: 2, saidaDir: tmp(), log: () => {} });
  assert.equal(res.resumo.respondeuAlgumaVez, false);
  assert.ok(res.resumo.endpoints['/liveclientdata/allgamedata'].erros.ECONNREFUSED >= 2);
  assert.match(textoFinal(res), /NAO respondeu/);
});

test('sonda recusa hosts que nao sejam loopback', async () => {
  const res = await sondar({ url: 'http://example.com', intervaloMs: 1, maxAmostras: 1, saidaDir: tmp(), log: () => {} });
  assert.equal(res.resumo.respondeuAlgumaVez, false);
  assert.ok(res.resumo.endpoints['/liveclientdata/allgamedata'].erros.host_nao_local >= 1);
});

test('resumir conta repeticoes', () => {
  const r = resumir([{ endpoint: '/a', status: 200, corpo: { x: 1 }, repeticoes: 4 }, { endpoint: '/a', erro: 'ECONNREFUSED', repeticoes: 2 }]);
  assert.equal(r.endpoints['/a'].ok, 4);
  assert.equal(r.endpoints['/a'].erros.ECONNREFUSED, 2);
});
