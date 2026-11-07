'use strict';
// Biblioteca do helper LOCAL da API da Riot (tft-match-v1). Sem dependencias.
// Regras: a chave so existe em arquivo/variavel FORA do repositorio e do OneDrive, so vai no cabecalho X-Riot-Token
// e so para https://<regiao>.api.riotgames.com. Nenhum dado pessoal (Riot ID, puuid, historico) e gravado no repositorio.
const fs = require('node:fs');
const path = require('node:path');
const PJ = require('../js/posjogo-logic.js');

const RAIZ_REPO = path.resolve(__dirname, '..');
const REGIOES = ['americas', 'europe', 'asia', 'sea']; // Brasil (br1) = americas
const LIMITES = [
  { n: 18, ms: 1000 }, // chave pessoal: 20 a cada 1 s
  { n: 95, ms: 120000 }, // e 100 a cada 2 min
];
const MAX_ESPERA_429 = 120000;
const ESPERA_429_PADRAO = 10000;
const TENTATIVAS = 3;
const TRAVA_VELHA_MS = 10 * 60 * 1000;
const RE_CHAVE = /^RGAPI-[A-Za-z0-9-]{20,60}$/;

class ErroRiot extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.name = 'ErroRiot';
    this.codigo = codigo; // chave | limite | nao-encontrado | rede | resposta
  }
}

// ------------------------------------------------------------ pastas e arquivos locais
function dirDados(env = process.env) {
  let dir;
  if (env.TFT_COMPS_DIR) dir = path.resolve(env.TFT_COMPS_DIR);
  else if (env.LOCALAPPDATA) dir = path.join(env.LOCALAPPDATA, 'tft-comps');
  else dir = path.join(env.HOME || env.USERPROFILE || '.', '.tft-comps');
  const rel = path.relative(RAIZ_REPO, dir);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) throw new Error('A pasta de dados nao pode ficar dentro do repositorio: ' + dir);
  if (/onedrive/i.test(dir)) throw new Error('A pasta de dados nao pode ficar no OneDrive (chave e historico nao sincronizam): ' + dir);
  return dir;
}

const chaveValida = (s) => typeof s === 'string' && RE_CHAVE.test(s);

function lerChave(dir, env = process.env) {
  const doEnv = typeof env.RIOT_API_KEY === 'string' ? env.RIOT_API_KEY.trim() : '';
  if (chaveValida(doEnv)) return doEnv;
  try {
    const t = fs.readFileSync(path.join(dir, 'riot-key.txt'), 'utf8').trim();
    return chaveValida(t) ? t : null;
  } catch (e) {
    return null;
  }
}

function lerJson(arq, padrao) {
  try {
    return JSON.parse(fs.readFileSync(arq, 'utf8'));
  } catch (e) {
    return padrao;
  }
}

function gravarAtomico(arq, texto) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const tmp = arq + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, texto);
  fs.renameSync(tmp, arq);
}

const lerConfig = (dir) => lerJson(path.join(dir, 'config.json'), null);
const gravarConfig = (dir, cfg) => gravarAtomico(path.join(dir, 'config.json'), JSON.stringify(cfg, null, 2));
const gravarStatus = (dir, st) => gravarAtomico(path.join(dir, 'status.json'), JSON.stringify(Object.assign({ ultimaExecucao: new Date().toISOString() }, st)));
const lerStatus = (dir) => lerJson(path.join(dir, 'status.json'), null);

function lerPartidas(dir) {
  const bruto = lerJson(path.join(dir, 'partidas.json'), null);
  return PJ.sanitizarPartidas(bruto).partidas;
}

// Riot ID = nome#tag. Nome 3-16 caracteres, tag 3-5 letras/numeros (regra do Riot ID); barra e controle nunca entram na URL.
function parseRiotId(texto) {
  if (typeof texto !== 'string') return null;
  const i = texto.lastIndexOf('#');
  if (i < 0) return null;
  const nome = texto.slice(0, i).trim();
  const tag = texto.slice(i + 1).trim();
  if (nome.length < 3 || nome.length > 16 || /[\\/?#%\u0000-\u001f]/.test(nome)) return null;
  if (!/^[A-Za-z0-9]{3,5}$/.test(tag)) return null;
  return { nome, tag };
}

// ------------------------------------------------------------ cliente HTTP
function criarCliente({ chave, fetchFn = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), agora = Date.now, regiao = 'americas' }) {
  if (!REGIOES.includes(regiao)) throw new Error('Regiao invalida: ' + String(regiao).slice(0, 20));
  if (!chaveValida(chave)) throw new ErroRiot('chave', 'Chave da Riot ausente ou em formato invalido.');
  const base = `https://${regiao}.api.riotgames.com`;
  const historico = [];

  async function esperarVaga() {
    for (;;) {
      const t = agora();
      while (historico.length && t - historico[0] > LIMITES[LIMITES.length - 1].ms) historico.shift();
      let espera = 0;
      LIMITES.forEach(({ n, ms }) => {
        if (historico.length >= n) espera = Math.max(espera, historico[historico.length - n] + ms - t + 1);
      });
      if (espera <= 0) break;
      await sleep(espera);
    }
    historico.push(agora());
  }

  async function pedir(caminho) {
    const url = base + caminho;
    let ultimo = null;
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
      await esperarVaga();
      let r;
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 20000);
        try {
          r = await fetchFn(url, { method: 'GET', headers: { 'X-Riot-Token': chave, Accept: 'application/json' }, signal: ctl.signal, redirect: 'error' });
        } finally {
          clearTimeout(timer);
        }
      } catch (e) {
        ultimo = new ErroRiot('rede', 'Falha de rede ao falar com a Riot.');
        if (tentativa < TENTATIVAS) await sleep(1000 * tentativa);
        continue;
      }
      if (r.status === 401 || r.status === 403) throw new ErroRiot('chave', 'A Riot recusou a chave (expirada ou invalida).');
      if (r.status === 404) throw new ErroRiot('nao-encontrado', 'A Riot nao achou o que foi pedido.');
      if (r.status === 429) {
        const seg = Number(r.headers.get('retry-after'));
        const ms = Math.min(MAX_ESPERA_429, Number.isFinite(seg) && seg > 0 ? seg * 1000 : ESPERA_429_PADRAO);
        ultimo = new ErroRiot('limite', 'Limite de chamadas da Riot atingido.');
        if (tentativa < TENTATIVAS) await sleep(ms);
        continue;
      }
      if (r.status >= 500) {
        ultimo = new ErroRiot('rede', 'A Riot esta fora do ar agora.');
        if (tentativa < TENTATIVAS) await sleep(1000 * tentativa);
        continue;
      }
      if (!r.ok) throw new ErroRiot('resposta', 'Resposta inesperada da Riot: ' + r.status);
      try {
        return await r.json();
      } catch (e) {
        throw new ErroRiot('resposta', 'A Riot devolveu algo que nao e JSON.');
      }
    }
    throw ultimo || new ErroRiot('rede', 'Falha ao falar com a Riot.');
  }

  const seg = (s) => encodeURIComponent(s);
  return {
    async resolverPuuid({ nome, tag }) {
      const d = await pedir(`/riot/account/v1/accounts/by-riot-id/${seg(nome)}/${seg(tag)}`);
      if (!d || typeof d.puuid !== 'string' || !d.puuid) throw new ErroRiot('resposta', 'A Riot nao devolveu o puuid.');
      return d.puuid;
    },
    async listarIds(puuid, { count = 20, start = 0 } = {}) {
      const d = await pedir(`/tft/match/v1/matches/by-puuid/${seg(puuid)}/ids?start=${Number(start) | 0}&count=${Math.min(200, Number(count) | 0)}`);
      return Array.isArray(d) ? d.filter((x) => typeof x === 'string' && /^[A-Za-z0-9_-]{3,40}$/.test(x)) : [];
    },
    async buscarPartida(id) {
      if (!/^[A-Za-z0-9_-]{3,40}$/.test(String(id))) throw new Error('id de partida invalido');
      return pedir(`/tft/match/v1/matches/${id}`);
    },
  };
}

// ------------------------------------------------------------ trava e sincronizacao
function pegarTrava(dir, agoraMs = Date.now()) {
  fs.mkdirSync(dir, { recursive: true });
  const arq = path.join(dir, 'fetch.lock');
  try {
    const idade = agoraMs - fs.statSync(arq).mtimeMs;
    if (idade > TRAVA_VELHA_MS) fs.rmSync(arq, { force: true });
  } catch (e) { /* sem trava */ }
  try {
    fs.writeFileSync(arq, String(process.pid), { flag: 'wx' });
  } catch (e) {
    return null;
  }
  return () => fs.rmSync(arq, { force: true });
}

async function sincronizar({ cliente, dir, puuid, maxNovas = 30, primeiraVez = 30 }) {
  const existentes = lerPartidas(dir);
  const conhecidos = new Set(existentes.map((p) => p.id));
  try {
    const ids = await cliente.listarIds(puuid, { count: conhecidos.size ? 20 : primeiraVez });
    const novos = ids.filter((id) => !conhecidos.has(id)).slice(0, maxNovas);
    const baixadas = [];
    let puladas = 0;
    for (const id of novos) {
      try {
        const reg = PJ.normalizarPartida(await cliente.buscarPartida(id), puuid);
        if (reg) baixadas.push(reg);
        else puladas += 1;
      } catch (e) {
        if (e.codigo === 'chave' || e.codigo === 'limite') throw e;
        puladas += 1;
      }
    }
    const todas = PJ.sanitizarPartidas({ partidas: baixadas.concat(existentes) }).partidas;
    if (baixadas.length || !fs.existsSync(path.join(dir, 'partidas.json'))) {
      gravarAtomico(path.join(dir, 'partidas.json'), JSON.stringify({ versao: 1, atualizadoEm: new Date().toISOString(), partidas: todas }));
    }
    gravarStatus(dir, { resultado: 'ok', novas: baixadas.length, puladas, total: todas.length });
    return { novas: baixadas.length, puladas, total: todas.length };
  } catch (e) {
    if (e instanceof ErroRiot) gravarStatus(dir, { resultado: e.codigo === 'chave' ? 'chave-invalida' : 'erro', mensagem: e.message });
    throw e;
  }
}

module.exports = {
  ErroRiot, REGIOES, dirDados, chaveValida, lerChave, lerConfig, gravarConfig, gravarStatus, lerStatus, lerPartidas, gravarAtomico, lerJson,
  parseRiotId, criarCliente, pegarTrava, sincronizar,
};
