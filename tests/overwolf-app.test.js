const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP = path.join(__dirname, '..', 'overwolf-app');
const manifest = JSON.parse(fs.readFileSync(path.join(APP, 'manifest.json'), 'utf8'));
const { criarControlador, JOGOS_TFT } = require('../overwolf-app/background/controller.js');
const G = require('../js/gep-map.js');

function fakeOw() {
  const listeners = { info: [], eventos: [], jogo: [], erro: [] };
  const chamadas = { features: [], escritas: [] };
  const ow = {
    games: {
      onGameInfoUpdated: { addListener: (f) => listeners.jogo.push(f), removeListener: () => {} },
      getRunningGameInfo2: (cb) => cb({ success: true, gameInfo: null }),
      events: {
        setRequiredFeatures: (features, cb) => { chamadas.features.push(features); cb({ success: true, supportedFeatures: features }); },
        onInfoUpdates2: { addListener: (f) => listeners.info.push(f), removeListener: () => {} },
        onNewEvents: { addListener: (f) => listeners.eventos.push(f), removeListener: () => {} },
        onError: { addListener: (f) => listeners.erro.push(f), removeListener: () => {} },
      },
    },
    io: {
      paths: { localAppData: 'C:\\Docs' },
      enums: { eEncoding: { UTF8: 'UTF8' } },
      writeFileContents: (file, content, enc, uac, cb) => { chamadas.escritas.push({ file, content, enc, uac }); cb({ success: true }); },
    },
  };
  return { ow, listeners, chamadas };
}
const agendador = () => {
  const fila = [];
  return { setTimeoutFn: (fn) => { fila.push(fn); return fila.length; }, clearTimeoutFn: () => {}, rodar: () => fila.splice(0).forEach((f) => f()) };
};

test('manifest: janela overlay nao rouba foco nem clique e fica so no jogo', () => {
  const w = manifest.data.windows.overlay;
  assert.equal(w.clickthrough, true);
  assert.equal(w.ignore_keyboard_events, true);
  assert.equal(w.grab_keyboard_focus, false);
  assert.equal(w.show_in_taskbar, false);
  assert.equal(w.in_game_only, true);
  assert.equal(w.transparent, true);
  assert.equal(w.topmost, true);
  assert.equal(manifest.data.windows.background.is_background_page, true);
  assert.equal(manifest.data.start_window, 'background');
});

test('manifest: permissoes minimas e jogos do TFT (sem LoL)', () => {
  assert.deepEqual(manifest.permissions.slice().sort(), ['FileSystem', 'GameInfo']);
  JOGOS_TFT.forEach((id) => assert.ok(manifest.data.game_events.includes(id), 'game_events ' + id));
  assert.equal(manifest.data.game_events.includes(5426), false);
  assert.equal(manifest.data.game_targeting.type, 'dedicated');
  assert.equal(manifest.data.game_targeting.game_ids.includes(5426), false);
  manifest.data.launch_events.forEach((e) => assert.equal(e.start_minimized, true));
});

test('manifest: arquivos referenciados existem', () => {
  const arquivos = [manifest.meta.icon, ...Object.values(manifest.data.windows).map((w) => w.file)];
  arquivos.forEach((f) => assert.ok(fs.existsSync(path.join(APP, f)), f));
});

test('vendor/ e copia fiel dos arquivos do projeto (rodar node overwolf-app/sync.js se falhar)', () => {
  const pares = [['data/catalog.js', 'vendor/catalog.js'], ['data/seed.js', 'vendor/seed.js'], ['data/recipes.js', 'vendor/recipes.js'], ['js/recommend.js', 'vendor/recommend.js'], ['js/gep-map.js', 'vendor/gep-map.js']];
  pares.forEach(([a, b]) => {
    assert.equal(fs.readFileSync(path.join(__dirname, '..', a), 'utf8'), fs.readFileSync(path.join(APP, b), 'utf8'), b);
  });
});

test('overlay e background so incluem scripts locais (sem rede, sem CDN)', () => {
  ['overlay/overlay.html', 'background/background.html'].forEach((f) => {
    const html = fs.readFileSync(path.join(APP, f), 'utf8');
    assert.equal(/(src|href)=["']https?:/i.test(html), false, f);
    assert.equal(/<script[^>]*>\s*\S/i.test(html.replace(/<script[^>]*src=[^>]*><\/script>/gi, '')), false, 'sem script inline em ' + f);
  });
});

test('controlador: pede so as features seguras e nunca augments', () => {
  const { ow, chamadas } = fakeOw();
  const c = criarControlador({ ow, gepMap: G, ...agendador() });
  c.comecar();
  assert.equal(chamadas.features.length, 1);
  assert.deepEqual(chamadas.features[0], G.FEATURES_GRAVAR);
  assert.equal(chamadas.features[0].includes('augments'), false);
});

test('controlador: grava so o permitido e sem aprimoramentos/oponentes/credenciais', () => {
  const { ow, listeners, chamadas } = fakeOw();
  const ag = agendador();
  const c = criarControlador({ ow, gepMap: G, agora: () => 1000, ...ag });
  c.comecar();
  const info = listeners.info[0];
  info({ feature: 'me', info: { me: { gold: '9', summoner_name: 'Elton' } } });
  info({ feature: 'augments', info: { me: { picked_augment: '{"slot_1":{"name":"DA_SEGREDO"}}' } } });
  info({ feature: 'board', info: { board: { opponent_board_pieces: '{"cell_1":{"name":"DA_18_Varus"}}', board_pieces: '{"cell_1":{"name":"DA_18_Ornn","level":"1"}}' } } });
  info({ feature: 'lcu_info', category: 'credentials', key: 'token', value: 'SEGREDO_TOKEN' });
  info({ feature: 'bench', category: 'bench', key: 'item_bench', value: '[{"summoner":"Elton","bench_items":[{"name":"DA_Component_BFSword","count":1}]},{"summoner":"Rival","bench_items":[{"name":"DA_Component_ChainVest","count":9}]}]' });
  listeners.eventos[0]({ events: [{ name: 'round_start', data: 'PVE' }, { name: 'picked_augment', data: 'DA_SEGREDO' }] });
  ag.rodar();
  assert.ok(chamadas.escritas.length >= 1);
  const ultima = chamadas.escritas[chamadas.escritas.length - 1];
  assert.match(ultima.file, /^C:\\Docs\\tft-comps-sonda\\gep-.*\.json$/);
  assert.equal(ultima.uac, false);
  const txt = ultima.content;
  ['DA_SEGREDO', 'SEGREDO_TOKEN', 'Rival', 'ChainVest'].forEach((s) => assert.equal(txt.includes(s), false, s));
  const doc = JSON.parse(txt);
  assert.equal(doc.versao, 1);
  assert.ok(doc.entradas.some((e) => e.feature === 'me' && e.key === 'gold' && e.value === '9'));
  assert.ok(doc.entradas.some((e) => e.feature === 'board' && e.key === 'board_pieces'));
  assert.ok(doc.entradas.some((e) => e.tipo === 'evento' && e.name === 'round_start'));
  assert.ok(doc.entradas.some((e) => e.key === 'item_bench' && e.value.includes('BFSword')));
});

test('controlador: tenta de novo se setRequiredFeatures falhar e registra o motivo', () => {
  const { ow, chamadas } = fakeOw();
  let n = 0;
  ow.games.events.setRequiredFeatures = (f, cb) => { n++; chamadas.features.push(f); cb(n < 3 ? { success: false, reason: 'Provider is not ready.' } : { success: true, supportedFeatures: f }); };
  const ag = agendador();
  const c = criarControlador({ ow, gepMap: G, ...ag });
  c.comecar();
  ag.rodar();
  ag.rodar();
  assert.equal(n, 3);
  assert.equal(c.estado().registrado, true);
});

test('controlador: falha final (jogo fora do manifest) para de tentar e vai para o relatorio', () => {
  const { ow, chamadas } = fakeOw();
  ow.games.events.setRequiredFeatures = (f, cb) => cb({ success: false, reason: "This app's manifest does not list game 99999 in 'game_events'" });
  const ag = agendador();
  const c = criarControlador({ ow, gepMap: G, ...ag });
  c.comecar();
  ag.rodar();
  ag.rodar();
  assert.equal(c.estado().registrado, false);
  assert.match(c.estado().erro, /does not list game/);
  assert.ok(chamadas.escritas.length >= 1);
  assert.ok(JSON.parse(chamadas.escritas.pop().content).entradas.some((e) => e.tipo === 'erro' && /does not list game/.test(e.mensagem)));
});

test('controlador: so reage ao TFT em execucao', () => {
  const { ow, listeners, chamadas } = fakeOw();
  const c = criarControlador({ ow, gepMap: G, ...agendador() });
  c.iniciar();
  listeners.jogo[0]({ gameInfo: { isRunning: true, classId: 5426 }, runningChanged: true });
  assert.equal(chamadas.features.length, 0);
  listeners.jogo[0]({ gameInfo: { isRunning: true, classId: JOGOS_TFT[0] }, runningChanged: true });
  assert.equal(chamadas.features.length, 1);
});
