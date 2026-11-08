(function () {
  // Pagina Pos-jogo: le o historico (helper local, copia do navegador, arquivo ou exemplo), analisa e desenha. Texto por textContent.
  const { h, dataBR } = window.TFTDom;
  const PJ = window.TFTPosjogo;
  const Fonte = window.TFTFonte;
  const CompsApi = window.TFTPainelComps;
  const catalog = window.TFT_CATALOG;
  const itemById = new Map(catalog.items.map((i) => [i.id, i]));
  const $ = (s) => document.querySelector(s);
  const POR_PAGINA = 15;

  const MOTIVO = {
    offline: (porta) => `O programa local não respondeu em 127.0.0.1:${porta}. Ele sobe sozinho quando você entra no Windows, depois de instalar as tarefas.`,
    'sem-config': () => 'O programa local está ligado, mas falta o setup (seu Riot ID).',
    'sem-chave': () => 'O programa local está ligado, mas falta a chave da Riot.',
    'chave-invalida': () => 'A Riot recusou a chave. A chave de teste vale 24 horas: gere outra no portal e rode o setup de novo.',
    vazio: () => 'O programa local está pronto, mas ainda não baixou nenhuma partida. A próxima busca roda em até 15 minutos.',
  };

  let fonte = null;
  let analises = [];
  let mostrando = POR_PAGINA;

  function lerComps() {
    let raw = null;
    try { raw = localStorage.getItem(CompsApi.STORAGE_KEY_COMPS); } catch (e) { /* sem armazenamento: usa o seed */ }
    return CompsApi.carregarComps(raw, window.TFT_SEED || [], window.TFT_SEED_VERSION || 1, catalog);
  }

  const ord = (n) => `${n}º`;
  const minutos = (s) => (s ? `${Math.round(s / 60)} min` : '');
  const num1 = (n) => (n == null ? '–' : String(n).replace('.', ','));

  // ---------------------------------------------------------------- banner da fonte
  function desenharFonte() {
    const el = $('#pj-fonte');
    const porta = Fonte.portaDe(window.location.search);
    el.className = 'pj-fonte pj-fonte-' + fonte.origem;
    el.textContent = '';
    if (fonte.origem === 'local') {
      el.append(h('b', { text: 'Dados reais. ' }), `${fonte.partidas.length} partidas lidas do programa local${fonte.atualizadoEm ? ` (atualizado em ${dataBR(fonte.atualizadoEm)})` : ''}.`);
    } else if (fonte.origem === 'cache' || fonte.origem === 'arquivo') {
      el.append(h('b', { text: fonte.origem === 'arquivo' ? 'Arquivo importado. ' : 'Cópia deste navegador. ' }),
        `${fonte.partidas.length} partidas${fonte.salvoEm ? ` salvas em ${dataBR(fonte.salvoEm)}` : ''}. `,
        fonte.motivo !== 'ok' && MOTIVO[fonte.motivo] ? MOTIVO[fonte.motivo](porta) : '');
    } else {
      el.append(h('span', { class: 'pj-tag-exemplo', text: 'EXEMPLO' }), h('b', { text: ' Dados fictícios. ' }),
        'Estas partidas não são suas: servem só para você ver como a página fica. ', MOTIVO[fonte.motivo] ? MOTIVO[fonte.motivo](porta) : '');
    }
    $('#pj-como').open = fonte.origem === 'exemplo';
  }

  // ---------------------------------------------------------------- resumo
  function celula(txt, cls) { return h('td', { class: cls || null, text: txt }); }

  function tabela(sel, linhas, rotuloPrim) {
    const t = $(sel);
    t.textContent = '';
    t.append(h('thead', {}, h('tr', {}, [rotuloPrim, 'Partidas', 'Média', 'Top 4', 'Vitórias'].map((x) => h('th', { scope: 'col', text: x })))));
    const corpo = h('tbody');
    if (!linhas.length) corpo.append(h('tr', {}, h('td', { colspan: 5, class: 'pj-vazio', text: 'Sem dados ainda.' })));
    linhas.forEach((l) => corpo.append(h('tr', {},
      h('th', { scope: 'row', text: l.nome }), celula(String(l.n), 'pj-n'), celula(num1(l.media), 'pj-n'), celula(l.top4 == null ? '–' : `${String(l.top4).replace('.', ',')}%`, 'pj-n'), celula(l.vitorias == null ? '–' : `${String(l.vitorias).replace('.', ',')}%`, 'pj-n'))));
    t.append(corpo);
  }

  // 'padrao' = Ranqueada + Normal (o que conta por padrao); 'todas' = tudo, inclusive evento; ou o id de uma fila.
  function filtradas() {
    const fila = $('#pj-fila').value;
    if (fila === 'padrao') return analises.filter((a) => !PJ.ehEvento(a.partida.fila) && a.partida.tipo !== 'pve');
    return analises.filter((a) => fila === 'todas' || String(a.partida.fila) === fila);
  }

  function desenharResumo() {
    const lista = filtradas();
    const bloco = $('#pj-resumo-bloco');
    bloco.hidden = !analises.length;
    if (!analises.length) return;
    const e = PJ.estatisticas(lista, Number($('#pj-ultimas').value), { incluirEvento: $('#pj-fila').value !== 'padrao' });
    const cards = $('#pj-cards');
    cards.textContent = '';
    [
      ['Partidas', String(e.total)],
      ['Colocação média', num1(e.media)],
      ['Top 4', e.top4 == null ? '–' : `${String(e.top4).replace('.', ',')}%`],
      ['Vitórias', e.vitorias == null ? '–' : `${String(e.vitorias).replace('.', ',')}%`],
      [`Últimas ${e.ultimas.n}`, `${num1(e.ultimas.media)}º · top 4 ${e.ultimas.top4 == null ? '–' : String(e.ultimas.top4).replace('.', ',') + '%'}`],
    ].forEach(([r, v]) => cards.append(h('li', { class: 'pj-card' }, h('span', { class: 'pj-card-r', text: r }), h('b', { class: 'pj-card-v', text: v }))));
    tabela('#pj-por-comp', e.porComp, 'Comp');
    tabela('#pj-por-estilo', e.porEstilo, 'Estilo');
    const fila = $('#pj-fila').value;
    const deFora = lista.length - e.total;
    $('#pj-aviso-fila').textContent = fila === 'padrao'
      ? 'Estatísticas só de Ranqueada e Normal. Evento e modos especiais têm regras próprias e distorcem a média: escolha a fila no filtro para vê-los separados.'
      : deFora > 0 ? `${deFora} ${deFora === 1 ? 'partida contra o computador fica' : 'partidas contra o computador ficam'} fora das estatísticas.` : '';
    $('#pj-aviso-amostra').textContent = e.total < 20
      ? `Com ${e.total} partidas a média ainda balança muito; olhe as tendências, não os números exatos. “Estilo” é inferido do board final (nível e 3★), não do que você decidiu.`
      : '“Estilo” é inferido do board final (nível e 3★), não do que você decidiu.';
  }

  // ---------------------------------------------------------------- partida
  function miniUnidade(u) {
    const itens = h('span', { class: 'pj-itens' }, u.itens.map((i) => {
      const it = i.id ? itemById.get(i.id) : null;
      return it && it.img ? h('img', { src: it.img, alt: i.n, title: i.n, width: 20, height: 20, decoding: 'async' }) : h('span', { class: 'pj-item-x', title: i.n, text: '?' });
    }));
    const pic = u.img ? h('img', { class: 'pic', src: u.img, alt: u.nome, width: 44, height: 44, decoding: 'async' }) : h('span', { class: 'pj-sem-img', text: '?' });
    return h('li', { class: 'pj-un', title: u.c ? `${u.nome} · custo ${u.custo} · ${u.tier}★` : `${u.nome} (não achado no catálogo)` },
      h('span', { class: 'pj-estrelas', 'aria-label': `${u.tier} estrelas`, text: '★'.repeat(u.tier) }),
      h('span', { class: `mini pj-mini c${u.custo || 1}` }, pic),
      h('span', { class: 'pj-un-nome', text: u.nome }),
      itens);
  }

  function pill(t) {
    return h('li', { class: `pj-traco pj-traco-${t.estilo}`, title: `${t.nome} ${t.unidades}` },
      t.img ? h('img', { src: t.img, alt: '', width: 16, height: 16, decoding: 'async' }) : null,
      h('span', { text: `${t.nome} ${t.unidades}` }));
  }

  function desenharAnalise(a) {
    const eu = a.partida.eu;
    const caixa = h('div', { class: 'pj-analise' });
    // comp mais parecida
    const sec1 = h('section', { class: 'pj-sec' }, h('h4', { text: 'Comp salva mais parecida' }));
    if (a.comp) {
      sec1.append(h('p', {}, h('b', { text: a.comp.nome }), ` (${a.comp.sim}% de encaixe, ${a.comp.tem} de ${a.comp.total} campeões)`), h('div', { class: 'pj-barra', role: 'img', 'aria-label': `${a.comp.sim}% de encaixe` }, h('span', { style: `width:${a.comp.sim}%` })));
    } else if (a.maisPerto) {
      sec1.append(h('p', { class: 'pj-dica', text: `Nenhuma comp sua bate com o board final. A mais perto, ${a.maisPerto.nome}, tem ${a.maisPerto.tem} de ${a.maisPerto.total} campeões (${a.maisPerto.sim}%).` }));
    } else {
      sec1.append(h('p', { class: 'pj-dica', text: 'Você não tem comps salvas para comparar.' }));
    }
    if (a.ranking.length > 1) sec1.append(h('p', { class: 'pj-dica', text: 'Outras: ' + a.ranking.slice(a.comp ? 1 : 0).map((r) => `${r.nome} (${r.sim}%)`).join(' · ') }));
    // estilo
    const sec2 = h('section', { class: 'pj-sec' }, h('h4', { text: 'Estratégia que parece ter sido seguida' }),
      h('p', {}, h('b', { text: PJ.ESTILOS[a.estilo.id] }), ' — ', a.estilo.porque),
      h('p', { class: 'pj-dica', text: 'É uma leitura do board final. A API não diz o que você decidiu em cada rodada.' }));
    // erros
    const sec3 = h('section', { class: 'pj-sec' }, h('h4', { text: 'Onde pode ter errado' }));
    if (!a.achados.length) sec3.append(h('p', { class: 'pj-dica', text: 'Nada nos dados da API contradiz a Estratégia padrão. Isso não quer dizer que a partida foi perfeita: veja o que a API não mostra.' }));
    a.achados.forEach((x) => {
      const href = x.regra.href && /^[a-z]+\.html#[\w-]+$/.test(x.regra.href) ? x.regra.href : null;
      sec3.append(h('div', { class: `pj-achado pj-achado-${x.gravidade}` },
        h('span', { class: 'pj-nivel', text: x.gravidade === 'aviso' ? 'Atenção' : 'Observação' }),
        h('p', { text: x.texto }),
        h('p', { class: 'pj-regra' }, 'Guia: “', x.regra.trecho, '” ', href ? h('a', { href, text: x.regra.ref }) : x.regra.ref)));
    });
    // nao sabe
    const sec4 = h('section', { class: 'pj-sec' }, h('h4', { text: 'O que a API não mostra (não dá para saber)' }), h('ul', { class: 'pj-nao' }, a.naoSabe.map((t) => h('li', { text: t }))));
    caixa.append(sec1, sec2, sec3, sec4);
    if (a.avisos.length) caixa.append(h('ul', { class: 'pj-avisos' }, a.avisos.map((t) => h('li', { text: t }))));
    return caixa;
  }

  function resto(p) {
    const t = [p.versao.replace(/^Version\s+/i, 'v').replace(/\s*\(.*$/, ''), minutos(p.duracao)].filter(Boolean).join(' · ');
    return t ? (p.fila ? ' · ' : '') + t : '';
  }

  function desenharPartida(a, idx) {
    const p = a.partida;
    const eu = p.eu;
    const exemplo = fonte.origem === 'exemplo';
    const grupo = eu.colocacao <= 4 ? 'top' : 'baixo';
    const atencao = a.achados.filter((x) => x.gravidade === 'aviso').length;
    const resumoAnalise = `${a.comp ? 'Comp: ' + a.comp.nome : 'Sem comp reconhecida'} · ${PJ.ESTILOS[a.estilo.id]}${atencao ? ` · ${atencao} ${atencao === 1 ? 'ponto de atenção' : 'pontos de atenção'}` : ''}`;
    const det = h('details', { class: 'pj-det', open: idx === 0 ? true : null }, h('summary', {}, h('span', { text: 'Análise' }), h('small', { text: resumoAnalise })), desenharAnalise(a));
    return h('li', { class: `pj-partida pj-col-${grupo}` },
      h('div', { class: 'pj-topo' },
        h('span', { class: `pj-col pj-col-n${eu.colocacao}`, 'aria-label': `${eu.colocacao}º lugar`, text: ord(eu.colocacao) }),
        h('div', { class: 'pj-meta' },
          h('b', {}, exemplo ? h('span', { class: 'pj-tag-exemplo', text: 'EXEMPLO' }) : null, exemplo ? ' ' : '', p.quando ? dataBR(p.quando) : 'Sem data'),
          h('span', {}, h('span', { class: PJ.ehEvento(p.fila) ? 'pj-fila pj-fila-evento' : 'pj-fila', text: PJ.nomeFila(p.fila) }), PJ.ehEvento(p.fila) ? h('span', { class: 'pj-tag-evento', text: 'Evento' }) : null, resto(p))),
        h('ul', { class: 'pj-nums', 'aria-label': 'Resumo da partida' },
          h('li', {}, h('small', { text: 'Nível' }), h('b', { text: eu.nivel == null ? '–' : String(eu.nivel) })),
          h('li', {}, h('small', { text: 'Eliminado em' }), h('b', { text: eu.rodada ? `≈${eu.rodada}` : '–' })),
          h('li', {}, h('small', { text: 'Ouro restante' }), h('b', { text: eu.ouroRestante == null ? '–' : String(eu.ouroRestante) })),
          h('li', {}, h('small', { text: 'Eliminou' }), h('b', { text: eu.eliminados == null ? '–' : String(eu.eliminados) })))),
      h('ul', { class: 'pj-board', 'aria-label': 'Board final' }, eu.unidades.map(miniUnidade)),
      eu.tracosAtivos.length ? h('ul', { class: 'pj-tracos', 'aria-label': 'Traços ativos' }, eu.tracosAtivos.map(pill)) : null,
      eu.aprimoramentos.length ? h('p', { class: 'pj-aprim' }, h('b', { text: 'Aprimoramentos: ' }), eu.aprimoramentos.join(' · ')) : h('p', { class: 'pj-aprim' }, h('b', { text: 'Aprimoramentos: ' }), 'a API da Riot não informa.'),
      det);
  }

  function desenharLista() {
    const lista = filtradas();
    $('#pj-lista-bloco').hidden = !analises.length;
    const ol = $('#pj-lista');
    ol.textContent = '';
    lista.slice(0, mostrando).forEach((a, i) => ol.append(desenharPartida(a, i)));
    if (analises.length && !lista.length) ol.append(h('li', { class: 'pj-vazio', text: 'Nenhuma partida nessa fila.' }));
    $('#pj-mais').hidden = lista.length <= mostrando;
  }

  function desenharFiltros() {
    const sel = $('#pj-fila');
    const atual = sel.value || 'padrao';
    const filas = [...new Set(analises.map((a) => a.partida.fila))].filter((f) => f != null).sort((a, b) => Number(PJ.ehEvento(a)) - Number(PJ.ehEvento(b)) || a - b);
    const temRegular = analises.some((a) => !PJ.ehEvento(a.partida.fila) && a.partida.tipo !== 'pve');
    sel.textContent = '';
    sel.append(h('option', { value: 'padrao', text: 'Ranqueada + Normal' }), h('option', { value: 'todas', text: 'Todas' }),
      ...filas.map((f) => h('option', { value: String(f), text: PJ.nomeFila(f) + (PJ.ehEvento(f) ? ' (evento)' : '') })));
    const alvo = [...sel.options].some((o) => o.value === atual) ? atual : 'padrao';
    sel.value = alvo === 'padrao' && !temRegular && analises.length ? 'todas' : alvo;
  }

  function tudo() {
    desenharFonte();
    desenharFiltros();
    desenharResumo();
    desenharLista();
  }

  async function carregar() {
    $('#pj-fonte').textContent = 'Carregando…';
    try {
      fonte = await Fonte.carregar({ fetchFn: window.fetch.bind(window), storage: window.localStorage, exemplo: window.TFT_POSJOGO_EXEMPLO, search: window.location.search });
    } catch (e) {
      fonte = { origem: 'exemplo', motivo: 'offline', partidas: PJ.sanitizarPartidas(window.TFT_POSJOGO_EXEMPLO).partidas };
    }
    analisar();
  }

  function analisar() {
    const dados = { catalog, recipes: window.TFT_RECIPES, comps: lerComps() };
    analises = fonte.partidas.map((p) => PJ.analisar(p, dados));
    mostrando = POR_PAGINA;
    tudo();
  }

  $('#pj-recarregar').addEventListener('click', carregar);
  $('#pj-fila').addEventListener('change', () => { mostrando = POR_PAGINA; desenharResumo(); desenharLista(); });
  $('#pj-ultimas').addEventListener('change', desenharResumo);
  $('#pj-mais').addEventListener('click', () => { mostrando += POR_PAGINA; desenharLista(); });
  $('#pj-esquecer').addEventListener('click', () => { Fonte.esquecer(window.localStorage); carregar(); });
  $('#pj-arquivo').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    const r = f.size > 8 * 1024 * 1024 ? { ok: false, erro: 'Arquivo grande demais.' } : Fonte.importarTexto(await f.text(), window.localStorage);
    if (!r.ok) {
      $('#pj-fonte').className = 'pj-fonte pj-fonte-erro';
      $('#pj-fonte').textContent = r.erro;
      return;
    }
    fonte = { origem: 'arquivo', motivo: 'ok', partidas: r.partidas, salvoEm: new Date().toISOString() };
    analisar();
  });
  window.addEventListener('storage', (ev) => { if (ev.key === CompsApi.STORAGE_KEY_COMPS && fonte) analisar(); });
  carregar();
})();
