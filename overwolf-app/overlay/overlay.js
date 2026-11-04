(function () {
  // Desenha o overlay. Todo texto entra por textContent. Funciona dentro do Overwolf e no navegador (previa).
  const hud = document.getElementById('hud');
  const catalog = window.TFT_CATALOG || { champs: [] };
  const champs = new Map(catalog.champs.map((c) => [c.id, c]));
  const RE_IMG = /^[\w.-]+\.png$/;

  function el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function miniatura(id, falta) {
    const c = champs.get(id);
    const nome = c ? c.n : id;
    const arquivo = c && typeof c.img === 'string' ? c.img.split('/').pop() : '';
    const img = el('img', 'peca c' + (c ? c.c : 1) + (falta ? ' falta' : ''));
    img.alt = (falta ? 'Falta ' : 'Tem ') + nome;
    img.width = 24;
    img.height = 24;
    if (RE_IMG.test(arquivo)) img.src = '../assets/champs/' + arquivo;
    return img;
  }

  function topo(titulo, meta) {
    const t = el('div', 'topo');
    t.appendChild(el('span', 'titulo', titulo));
    if (meta) t.appendChild(el('span', 'meta', meta));
    return t;
  }

  function limpar() {
    while (hud.firstChild) hud.removeChild(hud.firstChild);
  }

  function resumoItens(it) {
    const total = it.prontos.length + it.montaveis.length + it.parciais.length + it.faltando.length;
    return total ? `itens ${it.prontos.length + it.montaveis.length}/${total}` : '';
  }

  function renderRecomendacoes(res, estado) {
    limpar();
    if (!res || res.fase === 'aprimoramento' || res.fase === 'desconhecido') return;
    if (res.fase === 'encerrado') {
      hud.appendChild(topo('Comps', 'encerrado após a rodada 2-1'));
      return;
    }
    const meta = estado ? `${estado.stage} · ${estado.gold} ouro · nível ${estado.level}` : '';
    hud.appendChild(topo('Comps sugeridas', meta));
    if (res.semDados || !res.top.length) {
      hud.appendChild(el('p', 'aviso', 'Aguardando campeões no banco ou no tabuleiro.'));
      return;
    }
    const ul = el('ol', 'lista');
    res.top.forEach((r, i) => {
      const li = el('li', 'linha');
      const cab = el('div', 'cab');
      cab.appendChild(el('span', 'rank', String(i + 1)));
      cab.appendChild(el('span', 'nome', r.nome));
      const score = el('span', 'score', String(r.score));
      score.appendChild(el('small', null, '/100'));
      cab.appendChild(score);
      li.appendChild(cab);
      const pecas = el('div', 'pecas');
      r.tem.forEach((id) => pecas.appendChild(miniatura(id, false)));
      r.faltam.forEach((f) => pecas.appendChild(miniatura(f.c, true)));
      const itens = resumoItens(r.itens);
      if (itens) pecas.appendChild(el('span', 'resumo', itens));
      li.appendChild(pecas);
      ul.appendChild(li);
    });
    hud.appendChild(ul);
  }

  function renderStatus(st) {
    limpar();
    hud.appendChild(topo('TFT Comps', 'modo sonda'));
    const linha = el('div', 'status');
    linha.appendChild(el('span', 'ponto' + (st.erro ? ' erro' : st.registrado ? ' ok' : '')));
    const txt = st.erro ? 'Sonda com erro: ' + st.erro : st.registrado ? `Gravando sonda TFT · ${st.entradas} registros` : 'Sonda aguardando o GEP…';
    linha.appendChild(el('span', null, txt));
    hud.appendChild(linha);
    hud.appendChild(el('p', 'aviso', 'Sem recomendações ao vivo (política da Riot para TFT).'));
  }

  window.TFTOverlay = { renderRecomendacoes, renderStatus };

  const ow = window.overwolf;
  if (ow && ow.windows && ow.windows.getMainWindow) {
    const atualizar = () => {
      const bg = ow.windows.getMainWindow();
      if (bg && bg.TFTBg) renderStatus(bg.TFTBg.controlador.estado());
    };
    atualizar();
    setInterval(atualizar, 2000);
  }
})();
