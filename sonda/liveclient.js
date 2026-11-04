// Sonda da Riot Live Client Data API (oficial, so local): https://127.0.0.1:2999/liveclientdata/...
// Mostra o que a API realmente entrega numa partida de TFT. So leitura. Nao usa memoria, nao injeta, nao automatiza nada.
// Uso: node sonda/liveclient.js [--minutos 60] [--intervalo 5]
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { removerAprimoramentos } = require('../js/gep-map.js');

const ENDPOINTS = ['/liveclientdata/allgamedata', '/liveclientdata/gamestats', '/liveclientdata/activeplayername'];
const MAX_CORPO = 150000;
const LOOPBACK = ['127.0.0.1', 'localhost', '::1'];

function buscar(base, endpoint, timeoutMs) {
  return new Promise((resolve) => {
    const u = new URL(endpoint, base);
    if (!LOOPBACK.includes(u.hostname)) {
      resolve({ erro: 'host_nao_local' });
      return;
    }
    const lib = u.protocol === 'https:' ? https : http;
    // Certificado do jogo e autoassinado (doc da Riot). Ignorar so para loopback.
    const opts = { method: 'GET', timeout: timeoutMs, headers: { Accept: 'application/json' } };
    if (u.protocol === 'https:') opts.rejectUnauthorized = false;
    const req = lib.request(u, opts, (res) => {
      const partes = [];
      let tam = 0;
      res.on('data', (d) => {
        tam += d.length;
        if (tam <= MAX_CORPO) partes.push(d);
      });
      res.on('end', () => resolve({ status: res.statusCode, tipo: res.headers['content-type'] || null, texto: Buffer.concat(partes).toString('utf8'), truncado: tam > MAX_CORPO }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ erro: e.code || e.message }));
    req.end();
  });
}

function interpretar(r) {
  if (r.erro) return { erro: r.erro };
  let corpo = r.texto;
  if (!r.truncado) {
    try {
      corpo = removerAprimoramentos(JSON.parse(r.texto));
    } catch (e) {
      /* corpo nao e JSON: guardado como texto */
    }
  }
  return { status: r.status, tipo: r.tipo, corpo, truncado: r.truncado || undefined };
}

function chavesTopo(corpo) {
  return corpo && typeof corpo === 'object' && !Array.isArray(corpo) ? Object.keys(corpo) : [];
}

function resumir(amostras) {
  const por = {};
  amostras.forEach((a) => {
    const r = (por[a.endpoint] = por[a.endpoint] || { respostas: 0, ok: 0, erros: {}, status: {}, chavesTopo: [] });
    const n = a.repeticoes || 1;
    if (a.erro) {
      r.erros[a.erro] = (r.erros[a.erro] || 0) + n;
      return;
    }
    r.respostas += n;
    r.status[a.status] = (r.status[a.status] || 0) + n;
    if (a.status === 200) {
      r.ok += n;
      chavesTopo(a.corpo).forEach((k) => { if (!r.chavesTopo.includes(k)) r.chavesTopo.push(k); });
    }
  });
  return { respondeuAlgumaVez: Object.values(por).some((r) => r.respostas > 0), endpoints: por };
}

async function sondar({ url = 'https://127.0.0.1:2999', intervaloMs = 5000, maxAmostras = Infinity, duracaoMs = 60 * 60000, saidaDir = path.join(__dirname, 'saida'), log = console.log, sinal } = {}) {
  fs.mkdirSync(saidaDir, { recursive: true });
  const iniciado = new Date();
  const arquivo = path.join(saidaDir, 'liveclient-' + iniciado.toISOString().replace(/[:.]/g, '-') + '.json');
  const amostras = [];
  const ultimo = new Map();
  let rodadas = 0;

  const gravar = () => {
    const doc = { versao: 1, ferramenta: 'sonda/liveclient.js', url, iniciado: iniciado.toISOString(), nota: 'Campos com "augment" no nome foram removidos antes de gravar.', resumo: resumir(amostras), amostras };
    fs.writeFileSync(arquivo, JSON.stringify(doc, null, 1), 'utf8');
  };

  while (rodadas < maxAmostras && Date.now() - iniciado.getTime() < duracaoMs && !(sinal && sinal.parar)) {
    for (const endpoint of ENDPOINTS) {
      const reg = Object.assign({ t: new Date().toISOString(), endpoint }, interpretar(await buscar(url, endpoint, 4000)));
      const chave = JSON.stringify([reg.status, reg.erro, reg.corpo]);
      const anterior = ultimo.get(endpoint);
      if (anterior && anterior.chave === chave) {
        anterior.reg.repeticoes = (anterior.reg.repeticoes || 1) + 1;
        anterior.reg.ultimaVez = reg.t;
      } else {
        amostras.push(reg);
        ultimo.set(endpoint, { chave, reg });
      }
    }
    rodadas++;
    gravar();
    if (rodadas === 1 || rodadas % 12 === 0) log(`[${new Date().toLocaleTimeString('pt-BR')}] ${rodadas} rodadas, ${amostras.length} respostas diferentes gravadas`);
    if (rodadas < maxAmostras) await new Promise((ok) => setTimeout(ok, intervaloMs));
  }
  gravar();
  return { arquivo, resumo: resumir(amostras), amostras };
}

function textoFinal(res) {
  const linhas = ['', 'RESULTADO DA SONDA', '------------------'];
  linhas.push(res.resumo.respondeuAlgumaVez ? 'A API respondeu durante a partida. Veja as chaves abaixo.' : 'A API NAO respondeu (erro de conexao). No TFT ela pode simplesmente nao existir.');
  Object.entries(res.resumo.endpoints).forEach(([ep, r]) => {
    linhas.push(`${ep}: ok=${r.ok}, status=${JSON.stringify(r.status)}, erros=${JSON.stringify(r.erros)}`);
    if (r.chavesTopo.length) linhas.push('   chaves: ' + r.chavesTopo.join(', '));
  });
  linhas.push('', 'Arquivo gerado: ' + res.arquivo);
  return linhas.join('\n');
}

module.exports = { sondar, resumir, textoFinal, ENDPOINTS };

if (require.main === module) {
  const arg = (nome, padrao) => {
    const i = process.argv.indexOf('--' + nome);
    return i > -1 ? Number(process.argv[i + 1]) || padrao : padrao;
  };
  const sinal = { parar: false };
  process.on('SIGINT', () => {
    sinal.parar = true;
    console.log('\nParando e salvando...');
  });
  console.log('Sonda iniciada. Abra uma partida de TFT. Deixe rodando; para parar: Ctrl+C.');
  sondar({ intervaloMs: arg('intervalo', 5) * 1000, duracaoMs: arg('minutos', 60) * 60000, sinal }).then((res) => {
    console.log(textoFinal(res));
  });
}
