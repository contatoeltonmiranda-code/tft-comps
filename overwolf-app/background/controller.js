(function (root) {
  // Controlador do background: grava o que o GEP entrega do TFT (so o que a politica permite) em %LocalAppData%\tft-comps-sonda.
  // `ow` e `gepMap` entram por parametro para testar sem o Overwolf.
  // O Overwolf NAO e usado aqui para recomendar em tempo real: ver README ("Politica da Riot").
  const JOGOS_TFT = [28164, 28162, 21570]; // TFT (lista de jogos do Overwolf local), TFT PBE e id citado na doc do GEP
  const MAX_TENTATIVAS = 6;
  const ESPERA_MS = 3000;
  const MAX_ENTRADAS = 20000;
  const ERRO_FINAL = /does not list game|not supported by any|no 'game_events'|Not in a game/i;

  function criarControlador({ ow, gepMap, agora = Date.now, debounceMs = 2000, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout }) {
    let snap = {};
    let doc = null;
    let comecou = false;
    let registrado = false;
    let erro = null;
    let timer = null;
    let tentativas = 0;
    let descartadas = 0;

    const novoDoc = () => ({
      versao: 1,
      jogo: 'TFT',
      iniciado: new Date(agora()).toISOString(),
      nota: 'Filtrado: sem aprimoramentos, oponentes, roster nem credenciais. Itens do banco so do jogador local.',
      entradas: [],
    });
    const t0 = () => Date.parse(doc.iniciado);

    function registrar(entrada) {
      if (doc.entradas.length >= MAX_ENTRADAS) {
        descartadas++;
        return;
      }
      doc.entradas.push(Object.assign({ t: agora() - t0() }, entrada));
    }

    function caminho() {
      return ow.io.paths.localAppData + '\\tft-comps-sonda\\gep-' + doc.iniciado.replace(/[:.]/g, '-') + '.json';
    }

    function escreverAgora() {
      if (timer) {
        clearTimeoutFn(timer);
        timer = null;
      }
      if (!doc) return;
      const conteudo = JSON.stringify(Object.assign({}, doc, { descartadas }), null, 1);
      ow.io.writeFileContents(caminho(), conteudo, ow.io.enums.eEncoding.UTF8, false, (r) => {
        if (r && r.success === false) erro = 'Falha ao gravar o arquivo: ' + (r.error || 'desconhecido');
      });
    }

    function agendarEscrita() {
      if (!timer) {
        timer = setTimeoutFn(() => {
          timer = null;
          escreverAgora();
        }, debounceMs);
      }
    }

    function aoInfo(e) {
      gepMap.expandir(e).forEach(({ feature, key, value }) => {
        const permitida = (gepMap.CHAVES_PERMITIDAS[feature] || []).includes(key);
        if (!permitida) return;
        snap = gepMap.acumular(snap, { feature, key, value });
        const localName = snap.me && typeof snap.me.summoner_name === 'string' ? snap.me.summoner_name : '';
        const limpo = gepMap.limparParaGravar(feature, key, value, { localName });
        if (limpo !== undefined) registrar({ tipo: 'info', feature, key, value: limpo });
      });
      agendarEscrita();
    }

    function aoEvento(e) {
      const lista = e && Array.isArray(e.events) ? e.events : e && e.event ? [e.event] : [];
      lista.forEach((ev) => {
        const limpo = gepMap.limparEvento(ev);
        if (limpo) registrar(Object.assign({ tipo: 'evento' }, limpo));
      });
      agendarEscrita();
    }

    function aoErro(e) {
      registrar({ tipo: 'erro', mensagem: String((e && (e.reason || e.error)) || 'erro do GEP') });
      agendarEscrita();
    }

    function escutar() {
      const ev = ow.games.events;
      [[ev.onInfoUpdates2, aoInfo], [ev.onNewEvents, aoEvento], [ev.onError, aoErro]].forEach(([canal, fn]) => {
        canal.removeListener(fn);
        canal.addListener(fn);
      });
    }

    function pedirFeatures() {
      tentativas++;
      ow.games.events.setRequiredFeatures(gepMap.FEATURES_GRAVAR, (r) => {
        if (r && r.success) {
          registrado = true;
          erro = null;
          registrar({ tipo: 'features', pedidas: gepMap.FEATURES_GRAVAR, suportadas: r.supportedFeatures || [] });
          escutar();
          agendarEscrita();
          return;
        }
        const motivo = String((r && (r.reason || r.error)) || 'setRequiredFeatures falhou');
        if (ERRO_FINAL.test(motivo) || tentativas >= MAX_TENTATIVAS) {
          erro = motivo;
          registrar({ tipo: 'erro', mensagem: motivo });
          escreverAgora();
          return;
        }
        setTimeoutFn(pedirFeatures, ESPERA_MS);
      });
    }

    function comecar() {
      if (comecou) return;
      comecou = true;
      tentativas = 0;
      snap = {};
      descartadas = 0;
      doc = novoDoc();
      pedirFeatures();
    }

    function encerrar() {
      if (!comecou) return;
      escreverAgora();
      comecou = false;
      registrado = false;
      snap = {};
    }

    const ehTFT = (gi) => !!gi && gi.isRunning === true && JOGOS_TFT.includes(gi.classId);

    function aoJogo(e) {
      const gi = e && e.gameInfo;
      if (ehTFT(gi)) comecar();
      else if (e && e.runningChanged && (!gi || !gi.isRunning)) encerrar();
    }

    function iniciar() {
      ow.games.onGameInfoUpdated.removeListener(aoJogo);
      ow.games.onGameInfoUpdated.addListener(aoJogo);
      ow.games.getRunningGameInfo2((r) => {
        if (r && ehTFT(r.gameInfo)) comecar();
      });
    }

    return {
      iniciar,
      comecar,
      encerrar,
      estado: () => ({ comecou, registrado, erro, entradas: doc ? doc.entradas.length : 0, descartadas }),
    };
  }

  const api = { criarControlador, JOGOS_TFT };
  root.TFTController = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
