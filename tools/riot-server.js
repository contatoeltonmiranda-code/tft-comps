'use strict';
// Servidor LOCAL so de leitura que entrega o historico baixado pelo riot-fetch.js para as paginas do tft-comps.
// Seguranca: bind em 127.0.0.1, so GET/OPTIONS, Host checado (anti DNS rebinding), CORS so para o Pages e localhost,
// nunca le o conteudo da chave, nunca fala com a Riot, nunca monta caminho de arquivo a partir da URL.
//   Subir: node tools/riot-server.js   (a tarefa agendada chama isso oculto, no logon)
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const L = require('./riot-lib.js');
const PJ = require('../js/posjogo-logic.js');

const PORTA_PADRAO = 17870;
const ORIGEM_PAGES = 'https://contatoeltonmiranda-code.github.io';
const MAX_BYTES = 8 * 1024 * 1024;

function portaDe(cfg, env = process.env) {
  const ok = (n) => Number.isInteger(n) && n >= 1024 && n <= 65535;
  const doEnv = Number(env.TFT_COMPS_PORTA);
  if (ok(doEnv)) return doEnv;
  const doCfg = cfg && Number(cfg.porta);
  return ok(doCfg) ? doCfg : PORTA_PADRAO;
}

// Sem cabecalho Origin = chamada que nao veio de outra pagina (curl, mesma origem): segue sem CORS.
function origemPermitida(origem) {
  if (origem === undefined) return true;
  if (typeof origem !== 'string' || !origem) return false;
  if (origem === ORIGEM_PAGES) return true;
  return /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{2,5})?$/.test(origem);
}

function hostPermitido(host, porta) {
  return host === `127.0.0.1:${porta}` || host === `localhost:${porta}`;
}

function criarServidor({ dir, env = process.env }) {
  const arq = (nome) => path.join(dir, nome);

  function lerPartidas() {
    try {
      if (fs.statSync(arq('partidas.json')).size > MAX_BYTES) return { partidas: [], atualizadoEm: null };
      const bruto = JSON.parse(fs.readFileSync(arq('partidas.json'), 'utf8'));
      return { partidas: PJ.sanitizarPartidas(bruto).partidas, atualizadoEm: typeof bruto.atualizadoEm === 'string' ? bruto.atualizadoEm.slice(0, 40) : null };
    } catch (e) {
      return { partidas: [], atualizadoEm: null };
    }
  }

  function status() {
    const st = L.lerStatus(dir) || {};
    const existe = Boolean(env.RIOT_API_KEY) || fs.existsSync(arq('riot-key.txt'));
    return {
      chave: existe ? 'ok' : 'ausente',
      configurado: fs.existsSync(arq('config.json')),
      resultado: typeof st.resultado === 'string' ? st.resultado.slice(0, 30) : null,
      ultimaExecucao: typeof st.ultimaExecucao === 'string' ? st.ultimaExecucao.slice(0, 40) : null,
      partidas: lerPartidas().partidas.length,
    };
  }

  const srv = http.createServer((req, res) => {
    const porta = srv.address() ? srv.address().port : 0;
    const origem = req.headers.origin;
    const enviar = (codigo, corpo, extra = {}) => {
      const txt = corpo == null ? '' : JSON.stringify(corpo);
      res.writeHead(codigo, Object.assign({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-site',
      }, extra));
      res.end(txt);
    };
    if (!hostPermitido(req.headers.host, porta)) return enviar(403, { erro: 'host' });
    if (!origemPermitida(origem)) return enviar(403, { erro: 'origem' });
    const cors = origem === undefined ? {} : { 'Access-Control-Allow-Origin': origem, Vary: 'Origin' };
    if (req.method === 'OPTIONS') {
      const pre = Object.assign({}, cors, { 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '600' });
      if (req.headers['access-control-request-private-network'] === 'true') pre['Access-Control-Allow-Private-Network'] = 'true';
      res.writeHead(204, Object.assign({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, pre));
      return res.end();
    }
    if (req.method !== 'GET') return enviar(405, { erro: 'metodo' }, Object.assign({ Allow: 'GET, OPTIONS' }, cors));
    const caminho = (req.url || '').split('?')[0];
    if (caminho === '/api/ping') return enviar(200, { ok: true, app: 'tft-comps-local' }, cors);
    if (caminho === '/api/status') return enviar(200, status(), cors);
    if (caminho === '/api/partidas') return enviar(200, Object.assign({ versao: 1 }, lerPartidas()), cors);
    return enviar(404, { erro: 'nao-encontrado' }, cors);
  });
  srv.headersTimeout = 5000;
  srv.requestTimeout = 5000;
  srv.keepAliveTimeout = 2000;
  srv.maxHeadersCount = 40;
  return srv;
}

function iniciar() {
  const dir = L.dirDados();
  const porta = portaDe(L.lerConfig(dir));
  const srv = criarServidor({ dir });
  // porta ocupada = outra copia do servidor ja esta rodando: sai sem barulho
  srv.on('error', (e) => process.exit(e.code === 'EADDRINUSE' ? 0 : 1));
  srv.listen(porta, '127.0.0.1');
  return srv;
}

if (require.main === module) iniciar();

module.exports = { criarServidor, portaDe, origemPermitida, hostPermitido, PORTA_PADRAO, ORIGEM_PAGES };
