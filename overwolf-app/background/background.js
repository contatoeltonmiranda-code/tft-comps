(function () {
  // Cola do Overwolf: liga o controlador (gravacao filtrada do GEP) e mostra o overlay enquanto o TFT roda.
  // O overlay mostra o status da gravacao. Recomendacao ao vivo NAO esta ligada de proposito (ver README).
  const ow = window.overwolf;
  if (!ow) return;
  const controlador = TFTController.criarControlador({ ow, gepMap: TFTGepMap });
  window.TFTBg = { controlador };

  function janelaOverlay(acao) {
    ow.windows.obtainDeclaredWindow('overlay', (r) => {
      if (r && r.success) ow.windows[acao](r.window.id, () => {});
    });
  }

  ow.games.onGameInfoUpdated.addListener((e) => {
    const gi = e && e.gameInfo;
    if (gi && gi.isRunning && TFTController.JOGOS_TFT.includes(gi.classId)) janelaOverlay('restore');
    else if (e && e.runningChanged) janelaOverlay('close');
  });
  ow.games.getRunningGameInfo2((r) => {
    if (r && r.gameInfo && r.gameInfo.isRunning && TFTController.JOGOS_TFT.includes(r.gameInfo.classId)) janelaOverlay('restore');
  });
  controlador.iniciar();
})();
