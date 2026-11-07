'use strict';
// Setup unico: pergunta o Riot ID (nome#tag) e grava a config LOCAL (fora do repositorio e do OneDrive).
//   node tools/riot-setup.js
// A chave da Riot e opcional aqui: digitada invisivel ou colada depois em riot-key.txt.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const readline = require('node:readline');
const L = require('./riot-lib.js');

// So o dono do arquivo le a chave (Windows: tira a heranca e deixa o usuario atual).
function protegerArquivo(arq) {
  try {
    if (process.platform === 'win32') execFileSync('icacls', [arq, '/inheritance:r', '/grant:r', `${process.env.USERNAME}:(R,W)`], { stdio: 'ignore' });
    else fs.chmodSync(arq, 0o600);
  } catch (e) { /* melhor esforco */ }
}

async function executarSetup({ dir, env = process.env, perguntar, perguntarOculto, escrever, criar = L.criarCliente }) {
  const falar = (t) => escrever(t);
  falar('\nSetup do TFT Comps: pos-jogo automatico');
  falar('Pasta local (fora do repositorio e do OneDrive): ' + dir + '\n');

  let riotId = null;
  for (let i = 0; i < 3 && !riotId; i++) {
    const t = await perguntar('Seu Riot ID, no formato nome#tag (exemplo: Fulano#BR1): ');
    riotId = L.parseRiotId(t);
    if (!riotId) falar('Formato invalido. Use nome#tag: nome de 3 a 16 caracteres, # e a tag de 3 a 5 letras ou numeros.');
  }
  if (!riotId) return { ok: false };

  const arqChave = path.join(dir, 'riot-key.txt');
  let chave = L.lerChave(dir, env);
  if (chave) falar('Ja existe uma chave configurada. So Enter mantem; ou cole outra para trocar.');
  for (let i = 0; i < 3; i++) {
    const t = (await perguntarOculto('Cole a chave da Riot (RGAPI-..., nao aparece na tela) ou so Enter para colar depois: ')).trim();
    if (!t) break;
    if (!L.chaveValida(t)) {
      falar('Isso nao parece uma chave da Riot (comeca com RGAPI-). Tente de novo ou so Enter.');
      continue;
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(arqChave, t + '\n');
    protegerArquivo(arqChave);
    chave = t;
    falar('Chave gravada em ' + arqChave);
    break;
  }

  const cfg = { riotId: `${riotId.nome}#${riotId.tag}`, regiao: 'americas', plataforma: 'br1' };
  const anterior = L.lerConfig(dir);
  if (anterior && anterior.riotId === cfg.riotId && anterior.puuid) cfg.puuid = anterior.puuid;
  let validado = false;
  if (chave) {
    try {
      cfg.puuid = await criar({ chave, regiao: cfg.regiao }).resolverPuuid(riotId);
      validado = true;
      falar('Riot ID confirmado pela Riot.');
    } catch (e) {
      if (e.codigo === 'nao-encontrado') falar('A Riot nao achou esse Riot ID. Confira nome e tag (e se a conta e do Brasil).');
      else if (e.codigo === 'chave') falar('A Riot recusou a chave. Chave de desenvolvimento vale 24 h: gere outra no portal e rode o setup de novo.');
      else falar('Nao deu para falar com a Riot agora. O config foi salvo; a tarefa agendada tenta de novo depois.');
    }
  }
  L.gravarConfig(dir, cfg);
  falar('Config gravada em ' + path.join(dir, 'config.json'));
  if (!chave) falar('\nFalta a chave. Cole ela (so a linha RGAPI-...) neste arquivo e salve:\n  ' + arqChave);
  falar('\nProximo passo: powershell -ExecutionPolicy Bypass -File tools\\riot-instalar.ps1');
  return { ok: true, semChave: !chave, validado };
}

function criarIO() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const perguntar = (p) => new Promise((r) => rl.question(p, r));
  const perguntarOculto = (p) => new Promise((resolver) => {
    const orig = rl._writeToOutput;
    process.stdout.write(p);
    rl._writeToOutput = () => {};
    rl.question('', (t) => {
      rl._writeToOutput = orig;
      process.stdout.write('\n');
      resolver(t);
    });
  });
  return { perguntar, perguntarOculto, escrever: (t) => console.log(t), fechar: () => rl.close() };
}

if (require.main === module) {
  const io = criarIO();
  executarSetup({ dir: L.dirDados(), ...io }).then(
    (r) => { io.fechar(); process.exit(r.ok ? 0 : 1); },
    (e) => { io.fechar(); console.error('Erro:', e.message); process.exit(1); },
  );
}

module.exports = { executarSetup };
