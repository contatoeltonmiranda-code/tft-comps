const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const F = require('../tools/riot-fetch.js');
const S = require('../tools/riot-setup.js');
const L = require('../tools/riot-lib.js');

const CHAVE = 'RGAPI-12345678-1234-1234-1234-123456789abc';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tft-fs-'));
const lerSt = (d) => JSON.parse(fs.readFileSync(path.join(d, 'status.json'), 'utf8'));

function fakeCliente({ puuid = 'PUUID1', ids = [], falha = null } = {}) {
  return {
    resolverPuuid: async () => { if (falha) throw falha; return puuid; },
    listarIds: async () => { if (falha) throw falha; return ids; },
    buscarPartida: async () => ({}),
  };
}

test('fetch sem config: registra sem-config e nao chama a Riot', async () => {
  const d = tmp();
  const r = await F.executar({ dir: d, env: {}, criar: () => { throw new Error('nao devia criar cliente'); } });
  assert.equal(r.codigo, 2);
  assert.equal(lerSt(d).resultado, 'sem-config');
});

test('fetch sem chave: registra sem-chave', async () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ riotId: 'Fulano#BR1' }));
  const r = await F.executar({ dir: d, env: {}, criar: () => { throw new Error('nao devia criar cliente'); } });
  assert.equal(r.codigo, 3);
  assert.equal(lerSt(d).resultado, 'sem-chave');
});

test('fetch ok: resolve o puuid uma vez, guarda no config e sincroniza', async () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ riotId: 'Fulano#BR1' }));
  fs.writeFileSync(path.join(d, 'riot-key.txt'), CHAVE);
  let resolvidos = 0;
  const cli = fakeCliente({ ids: [] });
  const orig = cli.resolverPuuid;
  cli.resolverPuuid = async (...a) => { resolvidos += 1; return orig(...a); };
  const r = await F.executar({ dir: d, env: {}, criar: () => cli });
  assert.equal(r.codigo, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(d, 'config.json'), 'utf8')).puuid, 'PUUID1');
  await F.executar({ dir: d, env: {}, criar: () => cli });
  assert.equal(resolvidos, 1, 'puuid ja guardado, nao pergunta de novo');
  assert.equal(lerSt(d).resultado, 'ok');
});

test('fetch: chave expirada gera status chave-invalida, codigo 4 e log sem a chave', async () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ riotId: 'Fulano#BR1', puuid: 'P' }));
  fs.writeFileSync(path.join(d, 'riot-key.txt'), CHAVE);
  const r = await F.executar({ dir: d, env: {}, criar: () => fakeCliente({ falha: new L.ErroRiot('chave', 'A Riot recusou a chave (expirada ou invalida).') }) });
  assert.equal(r.codigo, 4);
  assert.equal(lerSt(d).resultado, 'chave-invalida');
  const log = fs.readFileSync(path.join(d, 'fetch.log'), 'utf8');
  assert.ok(!log.includes('RGAPI') && !log.includes('Fulano') && !log.includes('PUUID'), log);
});

test('fetch: com a trava ocupada nao roda (evita duas execucoes juntas)', async () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ riotId: 'Fulano#BR1', puuid: 'P' }));
  fs.writeFileSync(path.join(d, 'riot-key.txt'), CHAVE);
  const solta = L.pegarTrava(d);
  const r = await F.executar({ dir: d, env: {}, criar: () => { throw new Error('nao devia'); } });
  assert.equal(r.codigo, 5);
  solta();
});

function io(respostas, ocultas = []) {
  const falas = [];
  return {
    falas,
    perguntar: async (p) => { falas.push(p); return respostas.shift() ?? ''; },
    perguntarOculto: async (p) => { falas.push(p); return ocultas.shift() ?? ''; },
    escrever: (t) => falas.push(t),
  };
}

test('setup: pergunta o Riot ID (repete se invalido), grava config.json e valida com a Riot', async () => {
  const d = tmp();
  const x = io(['semtag', 'Fulano#BR1', 's'], [CHAVE]);
  const r = await S.executarSetup({ dir: d, env: {}, ...x, criar: () => fakeCliente({ puuid: 'PUUID9' }) });
  assert.equal(r.ok, true);
  const cfg = JSON.parse(fs.readFileSync(path.join(d, 'config.json'), 'utf8'));
  assert.equal(cfg.riotId, 'Fulano#BR1');
  assert.equal(cfg.regiao, 'americas');
  assert.equal(cfg.plataforma, 'br1');
  assert.equal(cfg.puuid, 'PUUID9');
  assert.equal(fs.readFileSync(path.join(d, 'riot-key.txt'), 'utf8').trim(), CHAVE);
  assert.ok(x.falas.some((f) => /Riot ID/i.test(f)));
  assert.ok(!x.falas.join('\n').includes(CHAVE), 'a chave nunca e repetida na tela');
});

test('setup: sem colar a chave grava so o config e explica onde colar depois', async () => {
  const d = tmp();
  const x = io(['Fulano#BR1'], ['']);
  const r = await S.executarSetup({ dir: d, env: {}, ...x, criar: () => { throw new Error('sem chave nao chama a Riot'); } });
  assert.equal(r.ok, true);
  assert.equal(r.semChave, true);
  assert.ok(!fs.existsSync(path.join(d, 'riot-key.txt')));
  assert.ok(x.falas.join('\n').includes(path.join(d, 'riot-key.txt')));
});

test('setup: chave com formato errado e recusada e nao e gravada', async () => {
  const d = tmp();
  const x = io(['Fulano#BR1'], ['isso nao e chave', '']);
  const r = await S.executarSetup({ dir: d, env: {}, ...x, criar: () => { throw new Error('x'); } });
  assert.equal(r.semChave, true);
  assert.ok(!fs.existsSync(path.join(d, 'riot-key.txt')));
});

test('setup: Riot ID inexistente ou chave recusada nao quebra, avisa e mantem o config', async () => {
  const d = tmp();
  const x = io(['Fulano#BR1'], [CHAVE]);
  const r = await S.executarSetup({ dir: d, env: {}, ...x, criar: () => fakeCliente({ falha: new L.ErroRiot('nao-encontrado', 'x') }) });
  assert.equal(r.ok, true);
  assert.equal(r.validado, false);
  assert.match(x.falas.join('\n'), /nao achou|não achou/i);
  assert.ok(fs.existsSync(path.join(d, 'config.json')));
});

test('scripts de agendamento: ASCII, sem chave e sem janela (wscript //B + Run 0)', () => {
  const dir = path.join(__dirname, '../tools');
  for (const f of ['riot-instalar.ps1', 'riot-remover.ps1', 'riot-oculto.vbs']) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(/^[\x00-\x7F]*$/.test(t), f + ' deve ser ASCII (PowerShell 5.1 le sem BOM como ANSI)');
    assert.ok(!/RGAPI-/.test(t), f);
  }
  const vbs = fs.readFileSync(path.join(dir, 'riot-oculto.vbs'), 'utf8');
  assert.match(vbs, /\.Run\(.*,\s*0,/, 'janela oculta (estilo 0)');
  const ps = fs.readFileSync(path.join(dir, 'riot-instalar.ps1'), 'utf8');
  assert.match(ps, /wscript\.exe/);
  assert.match(ps, /\/\/B/);
  assert.match(ps, /AtLogOn/);
  assert.match(ps, /RepetitionInterval/);
  assert.match(ps, /\[switch\]\$DryRun/);
  assert.match(ps, /TFT-Comps-Riot-Fetch/);
  assert.match(ps, /TFT-Comps-Riot-Servidor/);
  const rm = fs.readFileSync(path.join(dir, 'riot-remover.ps1'), 'utf8');
  assert.match(rm, /Unregister-ScheduledTask/);
});
