'use strict';
// Baixa as partidas novas do TFT (API oficial da Riot) e grava LOCAL, fora do repositorio e do OneDrive.
//   node tools/riot-fetch.js        (a tarefa agendada chama isso oculto a cada 15 min e no logon)
// Sem chave ou sem config: registra o motivo em status.json e sai. Nunca imprime a chave, o Riot ID nem o puuid.
const fs = require('node:fs');
const path = require('node:path');
const L = require('./riot-lib.js');

const LOG_MAX = 200 * 1024;

function registrar(dir, texto) {
  try {
    const arq = path.join(dir, 'fetch.log');
    let atual = '';
    try { atual = fs.readFileSync(arq, 'utf8'); } catch (e) { /* primeiro log */ }
    if (atual.length > LOG_MAX) atual = atual.slice(-LOG_MAX / 2);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(arq, atual + new Date().toISOString() + ' ' + texto + '\n');
  } catch (e) { /* log e opcional */ }
}

// Codigos de saida: 0 ok, 2 sem config, 3 sem chave, 4 chave recusada, 5 ja rodando, 1 outro erro.
async function executar({ dir, env = process.env, criar = L.criarCliente }) {
  const fim = (codigo, resultado, mensagem) => {
    if (resultado) L.gravarStatus(dir, { resultado, mensagem });
    registrar(dir, `[${resultado || 'ok'}] ${mensagem}`);
    return { codigo, mensagem };
  };
  const cfg = L.lerConfig(dir);
  if (!cfg || !L.parseRiotId(cfg.riotId)) return fim(2, 'sem-config', 'Falta rodar o setup (node tools/riot-setup.js).');
  const chave = L.lerChave(dir, env);
  if (!chave) return fim(3, 'sem-chave', 'Falta a chave da Riot (riot-key.txt ou RIOT_API_KEY).');
  const solta = L.pegarTrava(dir);
  if (!solta) return fim(5, null, 'Outra execucao em andamento.');
  try {
    const cliente = criar({ chave, regiao: cfg.regiao || 'americas' });
    let puuid = typeof cfg.puuid === 'string' ? cfg.puuid : null;
    if (!puuid) {
      puuid = await cliente.resolverPuuid(L.parseRiotId(cfg.riotId));
      L.gravarConfig(dir, Object.assign({}, cfg, { puuid }));
    }
    const r = await L.sincronizar({ cliente, dir, puuid });
    return fim(0, null, `Partidas novas: ${r.novas}. Total guardado: ${r.total}.`);
  } catch (e) {
    if (e instanceof L.ErroRiot) {
      registrar(dir, `[${e.codigo}] ${e.message}`);
      if (e.codigo !== 'chave') L.gravarStatus(dir, { resultado: 'erro', mensagem: e.message });
      else L.gravarStatus(dir, { resultado: 'chave-invalida', mensagem: e.message });
      return { codigo: e.codigo === 'chave' ? 4 : 1, mensagem: e.message };
    }
    registrar(dir, '[erro] ' + String(e && e.message).slice(0, 200).replace(/RGAPI-[A-Za-z0-9-]+/g, '***'));
    L.gravarStatus(dir, { resultado: 'erro', mensagem: 'Erro inesperado (veja fetch.log).' });
    return { codigo: 1, mensagem: 'erro' };
  } finally {
    solta();
  }
}

if (require.main === module) {
  executar({ dir: L.dirDados() }).then((r) => process.exit(r.codigo), () => process.exit(1));
}

module.exports = { executar };
