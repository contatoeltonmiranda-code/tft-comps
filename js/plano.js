(function () {
  // Pagina Plano: monta uma vez ao abrir (ou ao clicar em "Remontar plano") e fica parada. Sem timers, sem ler a partida.
  const { h, comBadges, dataBR } = window.TFTDom;
  const Pl = window.TFTPlano;
  const PJ = window.TFTPosjogo;
  const Fonte = window.TFTFonte;
  const CompsApi = window.TFTPainelComps;
  const catalog = window.TFT_CATALOG;
  const champById = new Map(catalog.champs.map((c) => [c.id, c]));
  const $ = (s) => document.querySelector(s);
  const CHAVE_COMPACTO = 'tft-comps:plano:compacto';
  const TIPO = { fast8: 'Fast 8', fast9: 'Fast 9', reroll: 'Reroll' };

  function lerComps() {
    let raw = null;
    try { raw = localStorage.getItem(CompsApi.STORAGE_KEY_COMPS); } catch (e) { /* sem armazenamento: usa o seed */ }
    return CompsApi.carregarComps(raw, window.TFT_SEED || [], window.TFT_SEED_VERSION || 1, catalog);
  }

  function mini(id) {
    const c = champById.get(id);
    if (!c) return null;
    return h('span', { class: `mini c${c.c}`, title: `${c.n} (custo ${c.c})` },
      h('img', { class: 'pic', src: c.img, alt: c.n, width: 36, height: 36, loading: 'lazy', decoding: 'async' }),
      h('span', { class: 'cost', text: String(c.c) }));
  }

  function desenharComps(plano, comps) {
    const porId = new Map(comps.map((c) => [c.id, c]));
    const ol = $('#pl-comps');
    ol.textContent = '';
    if (!plano.comps.length) {
      ol.append(h('li', { class: 'pl-vazio', text: 'Nenhuma comp salva. Crie ou restaure comps na página Comps.' }));
      return;
    }
    plano.comps.forEach((s) => {
      const comp = porId.get(s.id);
      const unicos = [...new Set(comp.main.map((u) => u.c))];
      ol.append(h('li', { class: 'pl-comp' },
        h('div', { class: 'pl-comp-topo' },
          h('span', { class: 'pl-num', 'aria-label': `Sugestão ${s.posicao}`, text: String(s.posicao) }),
          h('div', { class: 'pl-comp-nome' },
            h('h3', { text: s.nome }),
            h('p', {}, h('span', { class: `pl-tipo pl-tipo-${s.tipo}`, text: TIPO[s.tipo] }), h('span', { class: 'pl-estilo', text: s.estilo ? ` ${s.estilo}` : '' })))),
        h('div', { class: 'pl-minis' }, unicos.map(mini)),
        h('ul', { class: 'pl-porque', 'aria-label': `Por que sugerir ${s.nome}` }, s.motivos.map((m) => h('li', { class: `pl-m pl-m-${m.tipo}`, text: m.texto })))));
    });
  }

  function desenharEstrategia(plano) {
    const e = plano.estrategia;
    const raiz = $('#pl-estrategia');
    raiz.textContent = '';
    raiz.append(
      h('h3', { class: 'pl-estr-nome', text: e.nome }),
      h('p', { class: 'pl-estr-t', text: e.trecho }),
      h('p', { class: 'pl-ref' }, h('a', { href: 'estrategia.html#resumo-de-bolso', text: e.ref })));
    if (e.notas.length) raiz.append(h('ul', { class: 'pl-notas' }, e.notas.map((n) => h('li', { class: `pl-nota-${n.tipo}`, text: n.texto }))));
  }

  function desenharTempo() {
    const ol = $('#pl-tempo');
    ol.textContent = '';
    Pl.CHECKPOINTS.forEach((c) => {
      ol.append(h('li', { class: 'pl-marco' },
        h('h3', { text: c.marco }),
        h('p', { class: 'pl-acao' }, comBadges(c.acao)),
        h('p', { class: 'pl-regra' }, comBadges(c.regra), c.derivada ? h('span', { class: 'pl-derivada', text: ' derivada do guia' }) : null),
        h('p', { class: 'pl-troque' }, h('b', { text: 'Atenção: ' }), comBadges(c.troque.se), c.troque.entao ? ` → ${c.troque.entao}` : '', c.troque.derivada ? h('span', { class: 'pl-derivada', text: ' derivada do guia' }) : null)));
    });
  }

  function desenharPisos() {
    const ul = $('#pl-pisos');
    ul.textContent = '';
    Pl.PISOS.forEach((t) => ul.append(h('li', { text: t })));
    Pl.OUTRAS_LINHAS.forEach((l) => ul.append(h('li', {}, h('b', { text: l.nome + ': ' }), l.texto)));
  }

  function textoFonte(f, plano, nComps) {
    const partes = [`${nComps} comps salvas`];
    if (plano.fontes.patches.length) partes.push(`patches ${plano.fontes.patches.join(' e ')}`);
    let hist;
    const n = plano.fontes.partidas;
    const fora = f.partidas.length - n;
    const sufixo = fora > 0 ? `; ${fora} de evento ou contra o computador ficaram de fora` : '';
    if (f.origem === 'exemplo') hist = null;
    else if (f.origem === 'local') hist = `histórico: ${n} partidas de Ranqueada e Normal lidas do helper local${sufixo}`;
    else if (f.origem === 'arquivo') hist = `histórico: ${n} partidas de Ranqueada e Normal do arquivo importado${sufixo}`;
    else hist = `histórico: ${n} partidas de Ranqueada e Normal da cópia deste navegador (${dataBR(f.salvoEm)})${sufixo}`;
    return { partes, hist };
  }

  async function montar() {
    const comps = lerComps();
    let f;
    try {
      f = await Fonte.carregar({ fetchFn: window.fetch.bind(window), storage: window.localStorage, exemplo: window.TFT_POSJOGO_EXEMPLO, search: window.location.search });
    } catch (e) {
      f = { origem: 'exemplo', partidas: [] };
    }
    const dados = { catalog, recipes: window.TFT_RECIPES, comps };
    const reais = f.origem === 'exemplo' ? [] : f.partidas;
    const analises = reais.map((p) => PJ.analisar(p, dados));
    const plano = Pl.montarPlano({ comps, noticias: window.TFT_NOTICIAS || [], analises, catalog });
    desenharComps(plano, comps);
    desenharEstrategia(plano);
    desenharTempo();
    desenharPisos();
    const t = textoFonte(f, plano, comps.length);
    const el = $('#pl-fonte');
    el.textContent = '';
    el.append(`Montado com: ${t.partes.join(' · ')}`, ' · ', t.hist ? t.hist : h('span', {}, 'sem histórico pessoal (o ', h('a', { href: 'posjogo.html', text: 'Pós-jogo' }), ' ainda não está ligado)'), '.');
  }

  function compacto(on) {
    $('#pl-main').classList.toggle('pl-compacto', on);
    $('#pl-compacto').setAttribute('aria-pressed', String(on));
    try { localStorage.setItem(CHAVE_COMPACTO, on ? '1' : '0'); } catch (e) { /* sem armazenamento */ }
  }

  let lido = false;
  try { lido = localStorage.getItem(CHAVE_COMPACTO) === '1'; } catch (e) { /* sem armazenamento */ }
  compacto(lido);
  $('#pl-compacto').addEventListener('click', () => compacto($('#pl-compacto').getAttribute('aria-pressed') !== 'true'));
  $('#pl-recarregar').addEventListener('click', () => { montar(); });
  montar();
})();
