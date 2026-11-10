(function () {
  // Interface do Painel manual. Toda a decisao vem de TFTPainel.decidir; aqui so entrada, persistencia e desenho.
  // Texto sempre por textContent. Classes proprias com prefixo pn-.
  const P = window.TFTPainel;
  const Logic = window.TFTLogic;
  const CompsApi = window.TFTPainelComps;
  const Voz = window.TFTPainelVoz;
  // As comps do ranking sao as atuais do Elton (lista salva pelo app de comps: editadas, novas, sem as excluidas). Leitura apenas.
  function lerComps() {
    let raw = null;
    try { raw = localStorage.getItem(CompsApi.STORAGE_KEY_COMPS); } catch (e) { /* sem armazenamento: usa o seed */ }
    return CompsApi.carregarComps(raw, window.TFT_SEED || [], window.TFT_SEED_VERSION || 1, window.TFT_CATALOG);
  }
  const dados = { seed: lerComps(), catalog: window.TFT_CATALOG, recipes: window.TFT_RECIPES };
  const champs = dados.catalog.champs.slice().sort((a, b) => a.c - b.c || a.n.localeCompare(b.n, 'pt'));
  const champById = new Map(dados.catalog.champs.map((c) => [c.id, c]));
  const itemById = new Map(dados.catalog.items.map((i) => [i.id, i]));
  const componentes = Object.keys(dados.recipes.componentes).map((id) => ({ id, n: dados.recipes.componentes[id].n, img: (itemById.get(id) || {}).img || null }));

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function h(tag, attrs, ...filhos) {
    const e = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    filhos.flat().forEach((f) => { if (f != null && f !== false) e.append(f); });
    return e;
  }
  const icone = (id) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'ic');
    s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#' + id);
    s.append(u);
    return s;
  };

  // ------------------------------------------------------------------ estado
  function carregar() {
    try {
      const raw = localStorage.getItem(P.STORAGE_KEY);
      if (raw) return P.sanitizarEstado(JSON.parse(raw), dados.catalog, dados.recipes);
    } catch (e) { /* estado corrompido: comeca limpo */ }
    return P.estadoInicial();
  }
  function salvar() {
    try { localStorage.setItem(P.STORAGE_KEY, JSON.stringify(estado)); } catch (e) { /* sem armazenamento: segue sem salvar */ }
  }
  let estado = carregar();
  let resultado = null;

  function mudar(fn) {
    fn(estado);
    estado = P.sanitizarEstado(estado, dados.catalog, dados.recipes);
    salvar();
    atualizar();
  }

  const copias = (id) => estado.champs[id] || 0;
  function somaChamp(id, d) { mudar((e) => { const n = (e.champs[id] || 0) + d; if (n > 0) e.champs[id] = n; else delete e.champs[id]; }); }
  function somaComp(id, d) { mudar((e) => { const n = (e.comps[id] || 0) + d; if (n > 0) e.comps[id] = n; else delete e.comps[id]; }); }

  // ------------------------------------------------------------------ entrada: rodada, numeros, extras
  function montarRodada() {
    const est = $('#pn-estagio');
    for (let a = 1; a <= 7; a++) est.append(h('option', { value: a, text: String(a) }));
    est.addEventListener('change', () => mudar((e) => { e.stage = `${est.value}-${Math.min(Number(P.parseStage(e.stage).b), est.value === '1' ? 4 : 7)}`; }));
    $('#pn-rodada').addEventListener('change', () => mudar((e) => { e.stage = `${$('#pn-estagio').value}-${$('#pn-rodada').value}`; }));
    $('#pn-prox').addEventListener('click', () => mudar((e) => { e.stage = P.proximaRodada(e.stage); }));
  }
  function opcoesRodada(a) {
    const sel = $('#pn-rodada');
    const n = a === 1 ? 4 : 7;
    if (sel.options.length === n) return;
    sel.textContent = '';
    for (let b = 1; b <= n; b++) sel.append(h('option', { value: b, text: String(b) }));
  }

  const CAMPOS = {
    hp: (e, v) => { e.hp = v; },
    gold: (e, v) => { e.gold = v; },
    level: (e, v) => { e.level = v; },
    xpAtual: (e, v) => { e.xp.atual = v; },
    xpMax: (e, v) => { e.xp.max = v; },
  };
  function montarNumeros() {
    $$('[data-campo]').forEach((inp) => {
      const campo = inp.dataset.campo;
      inp.addEventListener('input', () => {
        const vazio = inp.value.trim() === '';
        const v = Number(inp.value);
        if (vazio && campo.startsWith('xp')) return mudar((e) => CAMPOS[campo](e, null));
        if (vazio || !Number.isFinite(v)) return;
        mudar((e) => CAMPOS[campo](e, Math.trunc(v)));
      });
      inp.addEventListener('change', syncEntrada);
      inp.addEventListener('blur', syncEntrada);
    });
    $$('[data-step]').forEach((b) => {
      const [campo, delta] = b.dataset.step.split(':');
      b.addEventListener('click', () => mudar((e) => {
        if (campo === 'streak') e.streak += Number(delta);
        else e[campo] += Number(delta);
      }));
    });
    $('#pn-streak-zero').addEventListener('click', () => mudar((e) => { e.streak = 0; }));
    $$('[data-seg]').forEach((seg) => {
      const campo = seg.dataset.seg;
      seg.addEventListener('click', (ev) => {
        const b = ev.target.closest('button');
        if (b) mudar((e) => { e[campo] = b.dataset.valor; });
      });
    });
    $('#pn-entrada').addEventListener('submit', (e) => e.preventDefault());
  }

  function textoStreak(s) {
    if (s > 0) return `${s} ${s === 1 ? 'vitória' : 'vitórias'}`;
    if (s < 0) return `${-s} ${s === -1 ? 'derrota' : 'derrotas'}`;
    return 'sem streak';
  }

  function syncEntrada() {
    const st = P.parseStage(estado.stage);
    $('#pn-estagio').value = st.a;
    opcoesRodada(st.a);
    $('#pn-rodada').value = st.b;
    const set = (sel, v) => { const el = $(sel); if (document.activeElement !== el) el.value = v == null ? '' : v; };
    set('#pn-vida', estado.hp);
    set('#pn-vida-slider', estado.hp);
    set('#pn-ouro', estado.gold);
    set('#pn-nivel', estado.level);
    set('#pn-xp-atual', estado.xp.atual);
    set('#pn-xp-max', estado.xp.max);
    $('#pn-streak').textContent = textoStreak(estado.streak);
    $$('[data-seg]').forEach((seg) => $$('button', seg).forEach((b) => b.setAttribute('aria-pressed', String(estado[seg.dataset.seg] === b.dataset.valor))));
    atualizarTiles();
    atualizarContestLista();
    syncFaixas();
  }

  // ------------------------------------------------------------------ toque: clique soma, botao direito / segurar remove
  function ligarToque(container, seletor, soma, tira) {
    let timer = null;
    let longo = null; // {el, fim}: remocao por long-press em andamento; o click que vem junto do pointerup nao pode somar
    const alvo = (e) => e.target.closest(seletor);
    const fimToque = () => {
      clearTimeout(timer);
      timer = null;
      if (longo && longo.fim == null) longo.fim = Date.now();
    };
    const suprime = (t) => {
      if (!longo || longo.el !== t) return false;
      if (longo.fim != null && Date.now() - longo.fim > 350) { longo = null; return false; }
      return true;
    };
    container.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const t = alvo(e);
      if (!t || e.target.closest('[data-tira]')) return;
      clearTimeout(timer);
      timer = setTimeout(() => { longo = { el: t, fim: null }; tira(t); if (navigator.vibrate) navigator.vibrate(12); }, 450);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((nome) => container.addEventListener(nome, fimToque));
    container.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-tira]');
      const t = alvo(e);
      if (!t || suprime(t)) return;
      if (rm) tira(t);
      else soma(t);
    });
    container.addEventListener('contextmenu', (e) => {
      const t = alvo(e);
      if (!t) return;
      e.preventDefault();
      if (!suprime(t)) tira(t);
    });
    container.addEventListener('keydown', (e) => {
      const t = alvo(e);
      if (t && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); tira(t); }
    });
  }

  // ------------------------------------------------------------------ entrada: campeoes
  const tilesChamp = new Map();
  function estadoCopias(n) {
    if (n >= 9) return '3★';
    if (n >= 3) return '2★';
    if (n === 2) return 'par';
    return '';
  }
  function montarChamps() {
    const raiz = $('#pn-champs');
    [1, 2, 3, 4, 5].forEach((custo) => {
      const lista = champs.filter((c) => c.c === custo);
      const grade = h('div', { class: 'pn-grade' });
      lista.forEach((c) => {
        const cnt = h('span', { class: 'pn-cnt', 'aria-hidden': 'true' });
        const st = h('span', { class: 'pn-st', 'aria-hidden': 'true' });
        const b = h('button', { type: 'button', class: `pn-champ pn-c${custo}`, 'data-id': c.id, 'data-fk': `champ-${c.id}` },
          h('span', { class: 'pn-ico' }, h('img', { src: c.img, alt: '', width: 44, height: 44, loading: 'lazy', decoding: 'async' }), cnt, st),
          h('span', { class: 'pn-nm', text: c.n }));
        tilesChamp.set(c.id, { b, cnt, st, c });
        grade.append(b);
      });
      raiz.append(h('section', { class: `pn-grupo-custo pn-c${custo}`, 'data-custo': custo },
        h('h3', {}, h('span', { class: 'pn-custo' }, `${custo}`), ` Custo ${custo}`, h('span', { class: 'pn-dica', text: ` · ${lista.length}` })), grade));
    });
    ligarToque(raiz, '.pn-champ', (t) => somaChamp(t.dataset.id, 1), (t) => somaChamp(t.dataset.id, -1));
    $('#pn-q-champs').addEventListener('input', filtrarChamps);
  }
  function filtrarChamps() {
    const q = Logic.norm($('#pn-q-champs').value).replace(/[^a-z0-9]/g, '');
    let achou = 0;
    tilesChamp.forEach(({ b, c }) => {
      const ok = !q || Logic.norm(c.n).replace(/[^a-z0-9]/g, '').includes(q);
      b.hidden = !ok;
      if (ok) achou += 1;
    });
    $$('.pn-grupo-custo').forEach((g) => { g.hidden = !$$('.pn-champ:not([hidden])', g).length; });
    $('#pn-champs-vazio').hidden = achou > 0;
  }
  function nomeCopias(c, n) {
    const e = estadoCopias(n);
    return `${c.n}: ${n} ${n === 1 ? 'cópia' : 'cópias'}${e ? ' (' + (e === 'par' ? 'par' : e) + ')' : ''}`;
  }
  function atualizarTiles() {
    tilesChamp.forEach(({ b, cnt, st, c }, id) => {
      const n = copias(id);
      cnt.textContent = n ? `×${n}` : '';
      st.textContent = estadoCopias(n);
      b.classList.toggle('pn-tem', n > 0);
      b.classList.toggle('pn-par', n === 2);
      b.classList.toggle('pn-estrela', n >= 3);
      b.setAttribute('aria-label', n ? `${nomeCopias(c, n)}. Enter soma, Delete remove.` : `${c.n}, custo ${c.c}. Enter soma uma cópia.`);
    });
    const tenho = $('#pn-tenho');
    tenho.textContent = '';
    Object.keys(estado.champs).map((id) => champById.get(id)).filter(Boolean).sort((a, b) => a.c - b.c || a.n.localeCompare(b.n, 'pt')).forEach((c) => {
      const n = copias(c.id);
      tenho.append(h('span', { class: `pn-chip pn-c${c.c}` },
        h('img', { src: c.img, alt: '', width: 28, height: 28 }),
        h('span', { class: 'pn-chip-t', text: `${c.n} ×${n}${estadoCopias(n) ? ' ' + estadoCopias(n) : ''}` }),
        h('button', { type: 'button', class: 'pn-chip-x', 'aria-label': `Remover uma cópia de ${c.n}`, onclick: () => somaChamp(c.id, -1) }, icone('i-x'))));
    });
    if (!tenho.children.length) tenho.append(h('span', { class: 'pn-dica', text: 'Nenhum campeão ainda.' }));
    atualizarTilesComp();
  }

  // ------------------------------------------------------------------ entrada: componentes
  const tilesComp = new Map();
  function montarComps() {
    const raiz = $('#pn-comps');
    componentes.forEach((c) => {
      const cnt = h('span', { class: 'pn-cnt', 'aria-hidden': 'true' });
      const img = c.img ? h('img', { src: c.img, alt: '', width: 40, height: 40, loading: 'lazy', decoding: 'async' }) : h('span', { class: 'pn-sem-img', 'aria-hidden': 'true' }, icone('i-comp'));
      const rm = h('button', { type: 'button', class: 'pn-menos', 'data-tira': '1', 'aria-label': `Remover um ${c.n}`, title: 'Remover um' }, icone('i-minus'));
      const b = h('div', { class: 'pn-compo', 'data-id': c.id },
        h('button', { type: 'button', class: 'pn-compo-b', 'data-fk': `comp-${c.id}` }, h('span', { class: 'pn-ico' }, img, cnt), h('span', { class: 'pn-nm', text: c.n })), rm);
      tilesComp.set(c.id, { b, cnt, c, rm, btn: $('button', b) });
      raiz.append(b);
    });
    ligarToque(raiz, '.pn-compo', (t) => somaComp(t.dataset.id, 1), (t) => somaComp(t.dataset.id, -1));
  }
  function atualizarTilesComp() {
    tilesComp.forEach(({ b, cnt, c, rm, btn }, id) => {
      const n = estado.comps[id] || 0;
      cnt.textContent = n ? `×${n}` : '';
      b.classList.toggle('pn-tem', n > 0);
      rm.hidden = n === 0;
      btn.setAttribute('aria-label', `${c.n}${n ? ': ' + n : ''}. Enter soma um.`);
    });
  }

  // ------------------------------------------------------------------ entrada: contest e favorita
  const linhasContest = new Map();
  function desenharContest() {
    const ul = $('#pn-contest');
    ul.textContent = '';
    linhasContest.clear();
    dados.seed.forEach((comp) => {
      const star = h('button', { type: 'button', class: 'pn-star', 'data-star': comp.id, 'data-fk': `cstar-${comp.id}` }, icone('i-star-o'));
      const val = h('output', { class: 'pn-cn' });
      const li = h('li', { class: 'pn-ct', 'data-id': comp.id },
        star,
        h('span', { class: 'pn-ct-nome' }, h('span', { text: comp.nome }), h('span', { class: 'pn-dica', text: comp.estilo ? ` · ${comp.estilo}` : '' })),
        h('span', { class: 'pn-step pn-step-sm', role: 'group', 'aria-label': `Jogadores na comp ${comp.nome}` },
          h('button', { type: 'button', class: 'pn-b', 'data-contest': comp.id + ':-1', 'aria-label': `Menos um jogador em ${comp.nome}` }, icone('i-minus')),
          val,
          h('button', { type: 'button', class: 'pn-b', 'data-contest': comp.id + ':1', 'aria-label': `Mais um jogador em ${comp.nome}` }, icone('i-plus'))));
      linhasContest.set(comp.id, { li, star, val, comp });
      ul.append(li);
    });
    if (!dados.seed.length) ul.append(h('li', { class: 'pn-dica', text: 'Nenhuma comp salva. Crie ou restaure comps na página Comps.' }));
    filtrarContest();
  }
  function filtrarContest() {
    const q = Logic.norm($('#pn-q-contest').value);
    linhasContest.forEach(({ li, comp }) => { li.hidden = !!q && !Logic.norm(comp.nome + ' ' + (comp.estilo || '')).includes(q); });
  }
  function montarContest() {
    const ul = $('#pn-contest');
    desenharContest();
    ul.addEventListener('click', (e) => {
      const s = e.target.closest('[data-star]');
      if (s) return mudar((st) => { st.favorita = st.favorita === s.dataset.star ? null : s.dataset.star; });
      const c = e.target.closest('[data-contest]');
      if (c) {
        const [id, d] = c.dataset.contest.split(':');
        mudar((st) => { const n = (st.contest[id] || 0) + Number(d); if (n > 0) st.contest[id] = n; else delete st.contest[id]; });
      }
    });
    $('#pn-q-contest').addEventListener('input', filtrarContest);
    // o app de comps pode mudar em outra aba: o ranking acompanha a lista salva
    window.addEventListener('storage', (ev) => {
      if (ev.key !== CompsApi.STORAGE_KEY_COMPS && ev.key !== null) return;
      dados.seed = lerComps();
      desenharContest();
      atualizar();
    });
  }
  function atualizarContestLista() {
    linhasContest.forEach(({ li, star, val, comp }, id) => {
      const fav = estado.favorita === id;
      const n = estado.contest[id] || 0;
      star.setAttribute('aria-pressed', String(fav));
      star.setAttribute('aria-label', fav ? `Tirar a estrela de ${comp.nome}` : `Marcar ${comp.nome} como favorita`);
      star.replaceChildren(icone(fav ? 'i-star' : 'i-star-o'));
      li.classList.toggle('pn-fav', fav);
      val.textContent = String(n);
    });
  }

  // ------------------------------------------------------------------ saida
  const ACT = { UPAR: 'act-upar', FICAR: 'act-ficar', ROLAR: 'act-rolar', GUARDAR: 'act-guardar' };
  const badge = (tipo) => h('span', { class: `act ${ACT[tipo]}`, text: tipo });

  function marca(regra) {
    if (regra.origem === 'derivada') return h('span', { class: 'pn-marca pn-marca-d', text: 'derivada do guia' });
    if (regra.origem === 'painel') return h('span', { class: 'pn-marca pn-marca-p', text: 'critério do painel' });
    return null;
  }
  function refRegra(regra, opts) {
    return h('span', { class: 'pn-ref' },
      h('a', { href: regra.href, text: regra.ref, title: `${regra.fonte === 'guia' ? 'Guia do Jogo' : 'Estratégia padrão'}: ${regra.trecho}` }),
      marca(regra),
      (regra.tambem || []).map((t) => h('a', { class: 'pn-ref-vida', href: t.href, text: t.ref, title: `Guia do Jogo: ${t.trecho}` })));
  }
  const fmtRange = (r) => (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`);

  function secao(id, titulo, ...filhos) {
    return h('section', { class: 'pn-card', 'aria-labelledby': id }, h('h2', { id, text: titulo }), ...filhos);
  }

  function itemCrit(c) {
    const st = c.ok === true ? 'ok' : c.ok === false ? 'no' : 'unk';
    const ic = c.ok === true ? 'i-check' : c.ok === false ? 'i-x' : 'i-unknown';
    const nome = { ok: 'Critério atendido', no: 'Critério não atendido', unk: 'Critério sem informação' }[st];
    const nomeRot = c.rotulo && !c.texto.toLowerCase().startsWith(c.rotulo.toLowerCase()) ? c.rotulo + ': ' : '';
    const rot = c.letra ? `(${c.letra}) ${nomeRot}` : nomeRot;
    return h('li', { class: `pn-crit pn-crit-${st}` }, h('span', { class: 'pn-crit-i', title: nome }, icone(ic), h('span', { class: 'sr', text: nome + ': ' })), h('span', {}, rot ? h('strong', { class: 'pn-crit-l', text: rot }) : null, c.texto, ' ', refRegra(c.regra)));
  }

  function blocoEstrategia(r) {
    const e = r.estrategia;
    return secao('pn-h-est', 'Estratégia recomendada',
      h('p', { class: 'pn-est-nome', text: e.rotulo }),
      e.carry ? h('p', { class: 'pn-dica', text: `Carry do reroll: ${e.carry.n} (custo ${e.carry.custo}, ${e.carry.copias} cópias).` }) : null,
      h('h3', { text: 'Por que' }),
      e.totalCriterios ? h('p', { class: 'pn-bateram', text: `Critérios de "Melhor momento para seguir" que bateram: ${e.bateram.length} de ${e.totalCriterios}${e.bateram.length ? ` (${e.bateram.join(', ')})` : ''}.` }) : null,
      h('ul', { class: 'pn-crits' }, e.porque.map(itemCrit)),
      h('h3', { text: 'O que faria mudar' }),
      e.mudaria.length ? h('ul', { class: 'pn-mud' }, e.mudaria.map((m) => h('li', {}, m.texto, ' ', refRegra(m.regra)))) : h('p', { class: 'pn-dica', text: 'Nada a mudar agora: todos os critérios batem.' }));
  }

  function metrica(rot, ...v) {
    return [h('dt', { text: rot }), h('dd', {}, ...v)];
  }

  function blocoAcao(r) {
    const a = r.acao;
    const o = r.ouro;
    const v = r.vida;
    const badges = h('span', { class: 'pn-badges' }, badge(a.tipo), a.tipo === 'UPAR' && a.rolarAte ? badge('ROLAR') : null);
    const metricas = h('dl', { class: 'pn-metricas' },
      metrica('Ouro agora', `${o.atual}`),
      metrica('Juros agora', `+${o.juros}`, h('span', { class: 'pn-dica', text: o.proximoDegrau == null ? ' (máximo, 50+)' : ` · próximo degrau ${o.proximoDegrau} (faltam ${o.falta})` })),
      metrica('Sobra após a ação', a.sobraTexto, a.rolagens ? h('span', { class: 'pn-dica', text: a.rolagens.max === a.rolagens.min ? ` · ${a.rolagens.max} rolagens` : ` · ${a.rolagens.min}–${a.rolagens.max} rolagens` }) : null),
      metrica('Piso', '10', h('span', { class: 'pn-dica', text: a.piso ? ` · ${a.piso.texto}` : ' · nunca abaixo, exceto no fim, morrendo' })),
      metrica('Leitura do ouro', o.leitura.texto),
      metrica('Vida', `${v.hp} · ${v.rotulo}`, h('span', { class: 'pn-dica', text: v.valeFaixa ? ` · ${v.leitura}` : ' · no estágio 2 a faixa de vida não vale (cada derrota tira pouca vida)' })));
    return secao('pn-h-acao', 'Ação agora',
      h('div', { class: 'pn-acao-topo' }, badges, h('strong', { class: 'pn-acao-titulo', text: a.titulo }), a.opcional ? h('span', { class: 'pn-marca', text: 'opcional' }) : null),
      h('p', { class: 'pn-acao-texto', text: a.texto }),
      a.preLevel ? h('p', { class: 'pn-prelevel' }, a.preLevel.texto, a.preLevel.xpAlvo != null ? ` Com o seu XP: termine em ${a.preLevel.xpAlvo} (faltam ${a.preLevel.comprar} para chegar lá).` : '') : null,
      r.rodada.tipo ? h('p', { class: 'pn-rod-tipo', text: r.rodada.tipo === 'carrossel' ? 'Rodada de carrossel.' : 'Rodada PvE.' }) : null,
      r.rodada.leitura ? h('p', { class: 'pn-rod-tipo', text: 'Rodada de leitura obrigatória: faça o roteiro de 7 passos.' }) : null,
      v.alerta ? h('p', { class: `pn-alerta pn-alerta-${v.alerta.nivel}`, role: 'alert' }, h('strong', { text: v.alerta.nivel === 'critico' ? 'Vida crítica. ' : 'Vida em atenção. ' }), v.alerta.texto.replace(/^[^:]+: /, '')) : null,
      o.aviso ? h('p', { class: 'pn-alerta pn-alerta-aviso', text: o.aviso }) : null,
      a.extras.length ? h('ul', { class: 'pn-extras-l' }, a.extras.map((x) => h('li', {}, x.texto, x.regra ? [' ', refRegra(x.regra)] : null))) : null,
      metricas,
      h('div', { class: 'pn-fonte' }, 'Regra: ', refRegra(a.regra)),
      h('details', { class: 'pn-trecho' }, h('summary', { text: 'Ver o trecho do guia' }), h('blockquote', { text: a.regra.trecho }), (a.regra.tambem || []).map((t) => h('blockquote', { class: 'pn-trecho-vida', text: `${t.ref}: ${t.trecho}` }))),
      h('p', { class: 'pn-dica', text: 'Custo do XP: 1 de ouro por XP (o guia só cita 48 de ouro para o 7→8, Set 13).' }));
  }

  const NOME_FASE = { inicio: 'Início (estágio 2)', meio: 'Meio (estágios 3 e 4)', fim: 'Fim (board final, estágio 5+)' };

  function miniChamp(id, unidades, tem) {
    const c = champById.get(id);
    return h('span', { class: `pn-mini pn-c${c.c}${tem ? ' pn-mini-tem' : ''}`, title: `${c.n} · custo ${c.c}${tem ? ' · você tem' : ' · falta'}` },
      h('img', { src: c.img, alt: c.n, width: 32, height: 32, loading: 'lazy', decoding: 'async' }),
      tem ? h('span', { class: 'pn-mini-n', 'aria-hidden': 'true', text: `×${copias(id)}` }) : null);
  }

  function linhaItem(i) {
    const rot = { pronto: 'pronto', montavel: 'dá para montar', parcial: 'falta 1 componente', falta: 'faltam 2 componentes' }[i.estado];
    return h('li', { class: `pn-item pn-item-${i.estado}` }, h('strong', { text: i.n }), i.qtd > 1 ? ` ×${i.qtd}` : '', ` · ${rot}`, i.faltam.length ? ` (${i.faltam.map((f) => f.n).join(' + ')})` : '');
  }

  function botaoFav(c) {
    return h('button', { type: 'button', class: 'pn-star', 'aria-pressed': String(c.favorita), 'data-fk': `rstar-${c.id}`, 'aria-label': c.favorita ? `Tirar a estrela de ${c.nome}` : `Marcar ${c.nome} como favorita`, onclick: () => mudar((st) => { st.favorita = st.favorita === c.id ? null : c.id; }) }, icone(c.favorita ? 'i-star' : 'i-star-o'));
  }

  function itemTop(c, pos) {
    const faltaTxt = c.faltam.slice().sort((a, b) => Number(b.alcancavel) - Number(a.alcancavel) || a.custo - b.custo);
    const itens = c.itensStatus.filter((i) => i.estado !== 'pronto').slice(0, 3);
    return h('li', { class: 'pn-top-i' },
      h('div', { class: 'pn-comp-cab' },
        h('span', { class: 'pn-pos', text: String(pos) }),
        h('h3', { text: c.nome }),
        h('span', { class: 'pn-score', title: 'Índice de encaixe de 0 a 100 (campeões 60%, itens 25%, ouro e nível 15%). Não é chance de vitória.' }, h('span', { class: 'sr', text: 'Encaixe ' }), String(c.score)),
        botaoFav(c)),
      h('p', { class: 'pn-comp-meta' }, c.estilo || 'Sem estilo', c.contest ? h('span', { class: 'pn-marca pn-marca-c', text: `${c.contest} ${c.contest === 1 ? 'jogador' : 'jogadores'} na comp` }) : null, c.favorita ? h('span', { class: 'pn-marca pn-marca-f', text: 'favorita' }) : null),
      h('div', { class: 'pn-minis' }, c.unidadesFase.map((id) => miniChamp(id, null, copias(id) > 0))),
      h('p', { class: 'pn-comp-res', text: `Tem ${c.tem.length} de ${c.unidadesFase.length} da fase${c.pares ? ` · ${c.pares} ${c.pares === 1 ? 'par' : 'pares'}` : ''} · board final ${c.coberturaFim.tem}/${c.coberturaFim.total}` }),
      faltaTxt.length ? h('p', { class: 'pn-falta' }, h('strong', { text: 'Falta: ' }), faltaTxt.map((f) => `${f.n} (custo ${f.custo}${f.alcancavel ? '' : ', fora da loja neste nível'})`).join(', ')) : h('p', { class: 'pn-falta', text: 'Fase completa.' }),
      itens.length ? h('ul', { class: 'pn-itens' }, itens.map(linhaItem)) : null);
  }

  function blocoComps(r) {
    const c = r.comps;
    return secao('pn-h-comps-s', 'Comps',
      h('p', { class: 'pn-dica', text: `Fase: ${NOME_FASE[c.fase]}. Ranking das ${c.todas.length} ${c.todas.length === 1 ? 'comp salva' : 'comps salvas'} (as suas, com edições e novas, sem as excluídas) pelo que você tem.` }),
      !c.todas.length ? h('p', { class: 'pn-vazio-i', text: 'Nenhuma comp salva. Crie ou restaure comps na página Comps.' }) : null,
      c.vazio ? h('p', { class: 'pn-vazio-i', text: 'Sem campeões nem componentes: o ranking ainda não tem sinal. Adicione o que você tem.' }) : null,
      h('ol', { class: 'pn-top' }, c.top3.map((x, k) => itemTop(x, k + 1))),
      h('details', { class: 'pn-todas' },
        h('summary', { text: `Todas as comps (${c.todas.length})` }),
        h('ol', { class: 'pn-resto', start: '4' }, c.todas.slice(3).map((x, k) => h('li', { class: 'pn-resto-i' },
          h('span', { class: 'pn-pos', text: String(k + 4) }),
          h('span', { class: 'pn-resto-n' }, x.nome, x.contest ? h('span', { class: 'pn-marca pn-marca-c', text: `${x.contest}` , title: 'Jogadores na comp' }) : null),
          h('span', { class: 'pn-resto-t', text: `${x.tem.length}/${x.unidadesFase.length} · fim ${x.coberturaFim.tem}/${x.coberturaFim.total}` }),
          h('span', { class: 'pn-score', text: String(x.score) }),
          botaoFav(x))))));
  }

  const V = { ok: ['OK', 'pn-v-ok'], arriscado: ['ARRISCADO', 'pn-v-risco'], nao: ['NÃO FORCE', 'pn-v-nao'] };

  function blocoForcar(r) {
    const f = r.forcar;
    const sel = h('select', { id: 'pn-forcar-sel', class: 'pn-sel pn-sel-largo', 'data-fk': 'forcar-sel', onchange: (e) => mudar((st) => { st.favorita = e.target.value || null; }) },
      h('option', { value: '', text: 'Escolha uma comp' }),
      dados.seed.map((c) => h('option', { value: c.id, text: c.nome, selected: estado.favorita === c.id })));
    sel.value = estado.favorita || '';
    const topo = [h('label', { class: 'pn-rotulo-b', for: 'pn-forcar-sel', text: 'Comp para forçar' }), sel];
    if (f.semComp) {
      return secao('pn-h-forcar', 'Forçar comp', ...topo, h('p', { class: 'pn-dica', text: 'Escolha acima ou marque a estrela de uma comp: o painel diz se vale forçar.' }));
    }
    const [rot, cls] = V[f.veredito];
    const unidades = f.buscar.unidades;
    const comp = f.buscar.componentes;
    return secao('pn-h-forcar', 'Forçar comp', ...topo,
      h('div', { class: 'pn-veredito' }, h('span', { class: `act ${cls}`, text: rot }), h('strong', { text: f.nome }), h('span', { class: 'pn-dica', text: ` · ${{ fast8: 'Fast 8', reroll: 'Reroll / slow roll', fast9: 'Fast 9' }[f.tipo]} · ${Math.round(f.cobertura * 100)}% da fase` })),
      h('ul', { class: 'pn-mot' }, f.motivos.map((m) => h('li', {}, m.texto, ' ', m.origem === 'painel' ? h('span', { class: 'pn-marca pn-marca-p', text: 'critério do painel' }) : m.origem === 'derivada' ? h('span', { class: 'pn-marca pn-marca-d', text: 'derivada do guia' }) : null))),
      h('h3', { text: 'O que buscar' }),
      unidades.length ? h('p', {}, h('strong', { text: 'Unidades: ' }), unidades.map((u) => `${u.n} (custo ${u.custo}${u.alcancavel ? '' : ', fora da loja neste nível'})`).join(', ')) : h('p', { class: 'pn-dica', text: 'Fase completa: foque em itens, posicionamento e nível.' }),
      comp.length ? h('p', {}, h('strong', { text: 'Componentes: ' }), comp.map((c) => `${c.n} (${c.para})`).join(', ')) : null,
      f.contest ? h('p', { class: 'pn-dica', text: `${f.contest} ${f.contest === 1 ? 'jogador' : 'jogadores'} nessa comp.` }) : null);
  }

  function renderBarra(r) {
    const a = r.acao;
    const barra = $('#pn-barra');
    barra.replaceChildren(
      h('span', { class: 'pn-barra-r', text: `Rodada ${r.rodada.stage}` }),
      h('span', { class: 'pn-badges' }, badge(a.tipo), a.tipo === 'UPAR' && a.rolarAte ? badge('ROLAR') : null),
      h('strong', { class: 'pn-barra-t', text: a.titulo }),
      h('span', { class: 'pn-barra-o', text: `Ouro ${r.ouro.atual}${a.sobra ? ' → ' + a.sobraTexto : ''}` }),
      h('span', { class: `pn-barra-v pn-faixa-${r.vida.faixa}`, text: `Vida ${r.vida.hp} · ${r.vida.rotulo}` }),
      h('span', { class: 'pn-barra-e', text: r.estrategia.rotulo }),
      h('a', { class: 'pn-pular', href: '#pn-entrada', text: 'Editar estado' }));
  }

  function renderSaida(r) {
    const saida = $('#pn-saida');
    const ativo = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null;
    saida.replaceChildren(blocoEstrategia(r), blocoAcao(r), blocoComps(r), blocoForcar(r));
    if (ativo && saida.contains(document.activeElement) === false) {
      const volta = saida.querySelector(`[data-fk="${ativo}"]`);
      if (volta) volta.focus({ preventScroll: true });
    }
  }
  const abertos = new Set();
  function guardarAbertos() {
    abertos.clear();
    $$('#pn-saida details[open]').forEach((d) => abertos.add(d.className));
  }
  function restaurarAbertos() {
    $$('#pn-saida details').forEach((d) => { if (abertos.has(d.className)) d.open = true; });
  }

  function atualizar() {
    try {
      resultado = P.decidir(estado, dados);
    } catch (e) {
      $('#pn-saida').replaceChildren(h('p', { class: 'pn-alerta pn-alerta-critico', role: 'alert', text: 'Não consegui calcular com este estado. Use Nova partida para recomeçar.' }));
      return;
    }
    guardarAbertos();
    renderBarra(resultado);
    renderSaida(resultado);
    restaurarAbertos();
    syncEntrada();
  }


  // ------------------------------------------------------------------ faixas rapidas (ouro e vida)
  const FAIXAS = { gold: Voz.FAIXAS_OURO, hp: Voz.FAIXAS_VIDA };
  function montarFaixas() {
    $$('[data-faixas]').forEach((box) => {
      const campo = box.dataset.faixas;
      FAIXAS[campo].forEach((f) => box.append(h('button', { type: 'button', 'data-faixa': f.id, 'aria-pressed': 'false', title: `Usa ${f.valor} ${campo === 'gold' ? 'de ouro' : 'de vida'}`, text: f.rotulo })));
      box.addEventListener('click', (ev) => {
        const b = ev.target.closest('button');
        const f = b && FAIXAS[campo].find((x) => x.id === b.dataset.faixa);
        if (f) mudar((e) => { e[campo] = f.valor; });
      });
    });
  }
  function syncFaixas() {
    $$('[data-faixas]').forEach((box) => {
      const atual = Voz.faixaDe(FAIXAS[box.dataset.faixas], estado[box.dataset.faixas]);
      $$('button', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.faixa === atual)));
    });
  }

  // ------------------------------------------------------------------ voz e comando de texto
  let desfazerEstado = null;
  function aplicarAcao(e, a) {
    const soma = (mapa, id, modo, n) => {
      const cur = mapa[id] || 0;
      const novo = modo === 'set' ? n : modo === 'add' ? cur + n : modo === 'remove' ? cur - n : Math.max(cur, n);
      if (novo > 0) mapa[id] = novo; else delete mapa[id];
    };
    switch (a.tipo) {
      case 'ouro': e.gold = a.valor; break;
      case 'vida': e.hp = a.valor; break;
      case 'nivel': e.level = a.valor; break;
      case 'rodada': e.stage = a.valor; break;
      case 'streak': e.streak = a.valor; break;
      case 'xp': e.xp.atual = a.atual; e.xp.max = a.max; break;
      case 'campeao': soma(e.champs, a.id, a.modo, a.n); break;
      case 'componente': soma(e.comps, a.id, a.modo, a.n); break;
      case 'comp-favorita': e.favorita = a.id; break;
      case 'contest': soma(e.contest, a.id, 'set', a.n); break;
      case 'aprimoramento': e.aprim = a.valor; break;
      case 'board': e.board = a.valor; break;
      case 'proxima': e.stage = P.proximaRodada(e.stage); break;
      default: break;
    }
  }
  function aplicarVoz(acoes) {
    if (!acoes.length) return;
    desfazerEstado = JSON.stringify(estado);
    mudar((e) => acoes.forEach((a) => aplicarAcao(e, a)));
  }
  function desfazerVoz() {
    if (!desfazerEstado) return;
    estado = P.sanitizarEstado(JSON.parse(desfazerEstado), dados.catalog, dados.recipes);
    desfazerEstado = null;
    salvar();
    atualizar();
    mostrarResultadoVoz('', { acoes: [], ambiguos: [], naoEntendi: '' });
    $('#pn-voz-status').textContent = 'Desfeito.';
  }
  function mostrarResultadoVoz(texto, r) {
    const raiz = $('#pn-voz-res');
    raiz.textContent = '';
    if (texto) raiz.append(h('p', { class: 'pn-voz-ouvi' }, 'Ouvi: ', h('q', { text: texto })));
    if (r.acoes.length) {
      raiz.append(h('ul', { class: 'pn-voz-chips', 'aria-label': 'O que foi aplicado' }, r.acoes.map((a) => h('li', { text: Voz.descrever(a) }))));
      raiz.append(h('button', { type: 'button', class: 'btn sm', id: 'pn-voz-desfazer', onclick: desfazerVoz }, 'Desfazer'));
    }
    r.ambiguos.forEach((amb) => {
      raiz.append(h('div', { class: 'pn-voz-amb' },
        h('span', { text: amb.tipo === 'contest' ? 'Contest de qual comp?' : 'Qual comp?' }),
        amb.opcoes.map((o) => h('button', { type: 'button', class: 'btn sm', onclick: (ev) => {
          aplicarVoz([amb.tipo === 'contest' ? { tipo: 'contest', id: o.id, nome: o.nome, n: amb.n } : { tipo: 'comp-favorita', id: o.id, nome: o.nome }]);
          ev.target.closest('.pn-voz-amb').remove();
          $('#pn-voz-status').textContent = `Aplicado: ${o.nome}.`;
        } }, o.nome))));
    });
    if (r.naoEntendi) raiz.append(h('p', { class: 'pn-voz-nao', text: `Não entendi: ${r.naoEntendi}` }));
  }
  function processarComando(texto) {
    const t = String(texto || '').trim();
    if (!t) return;
    const r = Voz.interpretar(t, {
      champs: dados.catalog.champs.map((c) => ({ id: c.id, n: c.n, c: c.c })),
      comps: dados.seed.map((c) => ({ id: c.id, nome: c.nome, estilo: c.estilo })),
      componentes: componentes.map((c) => ({ id: c.id, n: c.n })),
    });
    aplicarVoz(r.acoes);
    mostrarResultadoVoz(t, r);
    $('#pn-voz-status').textContent = r.acoes.length ? `${r.acoes.length} ${r.acoes.length === 1 ? 'ajuste aplicado' : 'ajustes aplicados'}.` : r.ambiguos.length ? 'Escolha a comp abaixo.' : 'Nada aplicado.';
  }
  function montarVoz() {
    const cmd = $('#pn-cmd');
    const enviar = () => { processarComando(cmd.value); cmd.value = ''; };
    $('#pn-cmd-ok').addEventListener('click', enviar);
    cmd.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); enviar(); } });
    const mic = $('#pn-mic');
    const aviso = $('#pn-voz-aviso');
    const sup = Voz.suporteVoz(window);
    const mostrarAviso = (t) => { aviso.textContent = t; aviso.hidden = !t; };
    if (!sup.ok) {
      mic.disabled = true;
      mostrarAviso(sup.aviso);
      return;
    }
    if (sup.aviso) mostrarAviso(sup.aviso);
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec = null;
    const fim = () => { rec = null; mic.setAttribute('aria-pressed', 'false'); $('#pn-mic-t').textContent = 'Falar'; };
    mic.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      try {
        rec = new Ctor();
        rec.lang = 'pt-BR';
        rec.interimResults = false;
        rec.continuous = false;
        rec.maxAlternatives = 1;
        rec.onresult = (ev) => { const t = ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : ''; processarComando(t); };
        rec.onerror = (ev) => {
          const m = Voz.mensagemErroVoz(ev && ev.error);
          if (m) $('#pn-voz-status').textContent = m;
          if (ev && (ev.error === 'network' || ev.error === 'service-not-allowed')) mostrarAviso(Voz.mensagemErroVoz('network'));
        };
        rec.onend = fim;
        rec.start();
        mic.setAttribute('aria-pressed', 'true');
        $('#pn-mic-t').textContent = 'Ouvindo… (clique para parar)';
        $('#pn-voz-status').textContent = 'Ouvindo. Fale a frase inteira, por exemplo: ouro 32 vida 70 rodada 3-2.';
      } catch (e) {
        fim();
        $('#pn-voz-status').textContent = Voz.mensagemErroVoz('network');
      }
    });
  }

  // ------------------------------------------------------------------ nova partida
  function montarNova() {
    const dlg = $('#pn-confirma');
    $('#pn-nova').addEventListener('click', () => dlg.showModal());
    $('#pn-confirma-nao').addEventListener('click', () => dlg.close());
    $('#pn-confirma-sim').addEventListener('click', () => {
      dlg.close();
      estado = P.estadoInicial();
      salvar();
      $('#pn-q-champs').value = '';
      filtrarChamps();
      atualizar();
    });
  }

  montarRodada();
  montarNumeros();
  montarFaixas();
  montarVoz();
  montarChamps();
  montarComps();
  montarContest();
  montarNova();
  atualizar();
})();
