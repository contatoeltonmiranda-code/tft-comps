(function (root) {
  // Entrada por voz/texto do Painel: frase falada -> lista de acoes sobre o estado digitado. Puro: sem DOM, sem rede, sem microfone.
  // O reconhecimento de voz em si (Web Speech API) fica em painel.js; aqui so se interpreta o texto.
  const MAX_TEXTO = 400;

  const UNIDADES = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9 };
  const DEZ_A_19 = { dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
  const DEZENAS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
  const CENTENAS = { cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900 };

  // Faixas rapidas: o valor usado e conservador (borda de baixo), porque as regras do guia sao "ouro >= X".
  const FAIXAS_OURO = [
    { id: '<20', rotulo: '< 20', valor: 15, min: 0, max: 19 },
    { id: '20-30', rotulo: '20–30', valor: 20, min: 20, max: 29 },
    { id: '30-40', rotulo: '30–40', valor: 32, min: 30, max: 39 },
    { id: '40-50', rotulo: '40–50', valor: 40, min: 40, max: 49 },
    { id: '50+', rotulo: '50+', valor: 50, min: 50, max: 999 },
  ];
  const FAIXAS_VIDA = [
    { id: '<30', rotulo: 'Crítica < 30', valor: 20, min: 0, max: 29 },
    { id: '30-40', rotulo: 'Atenção 30–40', valor: 35, min: 30, max: 40 },
    { id: '41-79', rotulo: 'Segura 41–79', valor: 60, min: 41, max: 79 },
    { id: '80+', rotulo: 'Folga 80+', valor: 90, min: 80, max: 100 },
  ];
  function faixaDe(faixas, valor) {
    if (!Number.isFinite(valor)) return null;
    const f = faixas.find((x) => valor >= x.min && valor <= x.max);
    return f ? f.id : null;
  }

  // ------------------------------------------------------------ texto
  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/['’`]/g, '')
      .replace(/\./g, '')
      .replace(/(\d)\s*[-/]\s*(\d)/g, '$1§$2')
      .replace(/[^a-z0-9§ ]+/g, ' ')
      .replace(/§/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function lerNumero(tokens, i) {
    let total = 0;
    let j = i;
    let estado = 'inicio';
    const eNumero = (t) => t in UNIDADES || t in DEZ_A_19 || t in DEZENAS || t in CENTENAS;
    let consumiu = false;
    while (j < tokens.length) {
      let t = tokens[j];
      let pulou = 0;
      if (t === 'e' && consumiu && (estado === 'centena' || estado === 'dezena') && j + 1 < tokens.length && eNumero(tokens[j + 1])) {
        t = tokens[j + 1];
        pulou = 1;
      }
      if (t in CENTENAS && estado === 'inicio') { total += CENTENAS[t]; estado = 'centena'; }
      else if (t in DEZENAS && (estado === 'inicio' || estado === 'centena')) { total += DEZENAS[t]; estado = 'dezena'; }
      else if (t in DEZ_A_19 && (estado === 'inicio' || estado === 'centena')) { total += DEZ_A_19[t]; estado = 'fim'; }
      else if (t in UNIDADES && (estado === 'inicio' || estado === 'centena' || estado === 'dezena') && !(estado === 'dezena' && UNIDADES[t] === 0)) { total += UNIDADES[t]; estado = 'fim'; }
      else break;
      consumiu = true;
      j += 1 + pulou;
      if (estado === 'fim') break;
    }
    return consumiu ? { valor: total, ate: j } : null;
  }

  function numeroPorExtenso(texto) {
    const tokens = norm(texto).split(' ').filter(Boolean);
    const r = tokens.length ? lerNumero(tokens, 0) : null;
    return r && r.ate === tokens.length ? r.valor : null;
  }

  function converterNumeros(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length;) {
      const r = lerNumero(tokens, i);
      if (r) { out.push(String(r.valor)); i = r.ate; } else { out.push(tokens[i]); i += 1; }
    }
    return out;
  }

  // ------------------------------------------------------------ fuzzy
  function distancia(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 9;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return dp[a.length][b.length];
  }
  const tolerancia = (chave) => (chave.length <= 4 ? 0 : chave.length <= 7 ? 1 : 2);

  const PALAVRAS_NOME_FRACAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a']);
  const NAO_E_NOME = new Set(['tenho', 'tem', 'mais', 'peguei', 'comprei', 'vendi', 'sem', 'ouro', 'vida', 'nivel', 'rodada', 'comp', 'estagio', 'proxima', 'board']);

  // entidades: [{id, nome, chaves:[...]}]; apelidos = palavras do nome com 4+ letras e unicas na lista.
  function montarEntidades(lista) {
    const base = (Array.isArray(lista) ? lista : []).filter((x) => x && typeof x.id === 'string' && typeof x.n === 'string');
    const contagem = new Map();
    const palavrasDe = (n) => norm(n).split(' ').filter((p) => p.length >= 4 && !PALAVRAS_NOME_FRACAS.has(p));
    base.forEach((e) => new Set(palavrasDe(e.n)).forEach((p) => contagem.set(p, (contagem.get(p) || 0) + 1)));
    return base.map((e) => {
      const completo = norm(e.n).replace(/ /g, '');
      const chaves = new Set([completo]);
      palavrasDe(e.n).forEach((p) => { if (contagem.get(p) === 1) chaves.add(p); });
      return { id: e.id, nome: e.n, chaves: [...chaves].filter((c) => c.length >= 3) };
    });
  }

  function acharEntidade(entidades, frase) {
    let melhor = null;
    let empate = false;
    entidades.forEach((e) => {
      e.chaves.forEach((k) => {
        const d = distancia(frase, k);
        if (d > tolerancia(k)) return;
        if (!melhor || d < melhor.d) { melhor = { e, d }; empate = false; } else if (d === melhor.d && melhor.e.id !== e.id) empate = true;
      });
    });
    return melhor && !empate ? melhor.e : null;
  }

  // ------------------------------------------------------------ interpretacao
  const MODO_ADD = new Set(['peguei', 'comprei', 'pegar', 'comprar', 'mais', 'adicionar', 'adiciona', 'ganhei', 'achei', 'acheu']);
  const MODO_REMOVE = new Set(['vendi', 'vender', 'tirei', 'tirar', 'remove', 'remover', 'removi', 'perdi', 'sem']);
  const MODO_SET = new Set(['tenho', 'tem', 'temos', 'ter']);
  const FILLER = new Set(['tenho', 'tem', 'e', 'de', 'do', 'da', 'o', 'a', 'os', 'as', 'um', 'uma', 'meu', 'minha', 'com', 'agora', 'esta', 'ta', 'estou', 'mais', 'peguei', 'comprei', 'vendi', 'tirei', 'ate', 'em', 'na', 'no']);

  function interpretar(texto, ctx) {
    const c = ctx || {};
    const acoes = [];
    const ambiguos = [];
    let s = norm(String(texto == null ? '' : texto).slice(0, MAX_TEXTO));
    if (!s) return { acoes, ambiguos, naoEntendi: '' };
    s = converterNumeros(s.split(' ')).join(' ');

    const tomar = (re, cb) => {
      s = s.replace(re, (...m) => {
        const a = cb(m);
        if (a === null || a === undefined) return m[0];
        if (a !== true) acoes.push(a);
        return ' ';
      });
    };
    const dentro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

    tomar(/\bproxima rodada\b/, () => ({ tipo: 'proxima' }));
    tomar(/\b(?:sem|zerar|zera|zere)\s+(?:a\s+)?(?:streak|sequencia)\b/, () => ({ tipo: 'streak', valor: 0 }));
    tomar(/\b(?:streak|sequencia)\s+(?:de\s+)?(vitorias?|derrotas?)\s+(\d{1,2})\b/, (m) => ({ tipo: 'streak', valor: (m[1].startsWith('v') ? 1 : -1) * Number(m[2]) }));
    tomar(/\b(?:streak|sequencia)\s+(?:de\s+)?(\d{1,2})\s+(vitorias?|derrotas?)\b/, (m) => ({ tipo: 'streak', valor: (m[2].startsWith('v') ? 1 : -1) * Number(m[1]) }));
    tomar(/\b(\d{1,2})\s+(vitorias?|derrotas?)(?:\s+seguidas?)?\b/, (m) => ({ tipo: 'streak', valor: (m[2].startsWith('v') ? 1 : -1) * Number(m[1]) }));
    tomar(/\b(?:xp|experiencia)\s+(\d{1,3})\s*(?:de|-)?\s*(\d{1,3})\b/, (m) => (Number(m[2]) > 0 ? { tipo: 'xp', atual: Number(m[1]), max: Number(m[2]) } : null));

    // numero antes da palavra so com "de" ("32 de ouro"); depois "ouro 32"; por fim "32 ouros".
    const campos = [
      { tipo: 'ouro', kw: '(?:ouros?|golds?)', min: 0, max: 999 },
      { tipo: 'vida', kw: '(?:vida|hp)', min: 0, max: 100 },
      { tipo: 'nivel', kw: '(?:nivel|level|lvl)', min: 1, max: 10 },
    ];
    const jaTem = (tipo) => acoes.some((a) => a.tipo === tipo);
    campos.forEach((f) => tomar(new RegExp(`\\b(\\d{1,4})\\s+de\\s+${f.kw}\\b`), (m) => (dentro(Number(m[1]), f.min, f.max) && !jaTem(f.tipo) ? { tipo: f.tipo, valor: Number(m[1]) } : null)));
    tomar(/\b(?:estagio|rodada|round)\s+(\d)(?:\s*-\s*|\s+(?:rodada\s+)?|)(\d)\b/, (m) => {
      const a = Number(m[1]);
      const b = Number(m[2]);
      return dentro(a, 1, 7) && dentro(b, 1, a === 1 ? 4 : 7) && !jaTem('rodada') ? { tipo: 'rodada', valor: `${a}-${b}` } : null;
    });
    campos.forEach((f) => tomar(new RegExp(`\\b${f.kw}\\s+(\\d{1,4})\\b`), (m) => (dentro(Number(m[1]), f.min, f.max) && !jaTem(f.tipo) ? { tipo: f.tipo, valor: Number(m[1]) } : null)));
    campos.forEach((f) => tomar(new RegExp(`(?<!\\b(?:ouros?|golds?|vida|hp|nivel|level|lvl|xp)\\s)\\b(\\d{1,4})\\s+${f.kw}\\b`), (m) => (dentro(Number(m[1]), f.min, f.max) && !jaTem(f.tipo) ? { tipo: f.tipo, valor: Number(m[1]) } : null)));

    tomar(/\baprimoramento\s+(?:de\s+)?(economia|eco|forca|combate)\b/, (m) => ({ tipo: 'aprimoramento', valor: m[1].startsWith('e') ? 'eco' : 'forca' }));
    tomar(/\b(?:board|tabuleiro)\s+(?:esta\s+|ta\s+|e\s+)?(forte|medio|fraco)\b/, (m) => ({ tipo: 'board', valor: m[1] }));

    // comps: usa o nome; casa o maior trecho de palavras que ainda acha alguma comp.
    const compsEnt = montarEntidades((Array.isArray(c.comps) ? c.comps : []).map((x) => ({ id: x.id, n: x.nome })));
    const palavrasComp = new Map(compsEnt.map((e) => [e.id, norm(e.nome).split(' ')]));
    function achaComps(palavras) {
      return compsEnt.filter((e) => palavras.every((p) => palavrasComp.get(e.id).some((q) => distancia(p, q) <= (p.length >= 6 ? 1 : 0)))).map((e) => ({ id: e.id, nome: e.nome }));
    }
    function resolverComp(palavras) {
      for (let k = Math.min(4, palavras.length); k >= 1; k--) {
        const achou = achaComps(palavras.slice(0, k));
        if (achou.length) return { k, opcoes: achou };
      }
      return null;
    }
    {
      const ct = /\bcontest\s+([a-z ]+?)\s+(\d)\b/.exec(s);
      if (ct) {
        const r = resolverComp(ct[1].split(' ').filter(Boolean));
        const n = Number(ct[2]);
        if (r && dentro(n, 0, 7)) {
          if (r.opcoes.length === 1) acoes.push({ tipo: 'contest', id: r.opcoes[0].id, nome: r.opcoes[0].nome, n });
          else ambiguos.push({ tipo: 'contest', n, opcoes: r.opcoes });
          s = s.replace(ct[0], ' ');
        }
      }
      const cp = /\b(?:forcar\s+|favorita\s+)?comp(?:osicao)?\s+([a-z0-9 ]+)/.exec(s);
      if (cp) {
        const palavras = cp[1].split(' ').filter(Boolean);
        const r = resolverComp(palavras);
        if (r) {
          if (r.opcoes.length === 1) acoes.push({ tipo: 'comp-favorita', id: r.opcoes[0].id, nome: r.opcoes[0].nome });
          else ambiguos.push({ tipo: 'comp-favorita', opcoes: r.opcoes });
          const resto = palavras.slice(r.k).join(' ');
          s = s.replace(cp[0], ' ' + resto + ' ');
        }
      }
    }

    // campeoes e componentes: n-gramas de ate 3 palavras contra nomes e apelidos.
    const grupos = [
      { tipo: 'campeao', ents: montarEntidades(c.champs) },
      { tipo: 'componente', ents: montarEntidades((Array.isArray(c.componentes) ? c.componentes : []).map((x) => ({ id: x.id, n: x.n }))) },
    ];
    const tokens = s.split(' ').filter(Boolean);
    const usado = tokens.map(() => false);
    const achados = [];
    grupos.forEach((g) => {
      if (!g.ents.length) return;
      for (let i = 0; i < tokens.length; i++) {
        if (usado[i]) continue;
        for (let len = Math.min(3, tokens.length - i); len >= 1; len--) {
          const fatia = tokens.slice(i, i + len);
          if (fatia.some((t, k) => usado[i + k] || /\d/.test(t) || NAO_E_NOME.has(t) || PALAVRAS_NOME_FRACAS.has(t) && (k === 0 || k === len - 1))) continue;
          const e = acharEntidade(g.ents, fatia.join(''));
          if (e) {
            for (let k = 0; k < len; k++) usado[i + k] = true;
            achados.push({ g, e, i, fim: i + len });
            i += len - 1;
            break;
          }
        }
      }
    });
    achados.sort((a, b) => a.i - b.i);
    achados.forEach((a, idx) => {
      let p = a.i - 1;
      let n = null;
      if (p >= 0 && /^\d+$/.test(tokens[p]) && !usado[p]) { n = Number(tokens[p]); usado[p] = true; p -= 1; }
      const limite = idx > 0 ? achados[idx - 1].fim : 0;
      let modo = null;
      for (let k = 0; k < 3 && p >= limite; k++, p--) {
        const t = tokens[p];
        if (MODO_ADD.has(t) && !usado[p]) { modo = 'add'; usado[p] = true; break; }
        if (MODO_REMOVE.has(t) && !usado[p]) { modo = 'remove'; usado[p] = true; break; }
        if (MODO_SET.has(t) && !usado[p]) { modo = 'set'; usado[p] = true; break; }
        if (!FILLER.has(t) && !/^\d+$/.test(t)) break;
      }
      const qtd = n == null ? 1 : n;
      if (!dentro(qtd, 1, 9)) return;
      let modoFinal;
      if (modo === 'add' || modo === 'remove') modoFinal = modo;
      else modoFinal = n == null ? 'min' : 'set';
      acoes.push({ tipo: a.g.tipo, id: a.e.id, nome: a.e.nome, modo: modoFinal, n: qtd });
    });

    const sobra = tokens.filter((t, i) => !usado[i] && !FILLER.has(t) && t !== '').join(' ');
    return { acoes, ambiguos, naoEntendi: sobra };
  }

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  function descrever(a) {
    switch (a.tipo) {
      case 'ouro': return `Ouro ${a.valor}`;
      case 'vida': return `Vida ${a.valor}`;
      case 'nivel': return `Nível ${a.valor}`;
      case 'rodada': return `Rodada ${a.valor}`;
      case 'streak': return a.valor === 0 ? 'Streak zerada' : a.valor > 0 ? `Streak: ${plural(a.valor, 'vitória', 'vitórias')}` : `Streak: ${plural(-a.valor, 'derrota', 'derrotas')}`;
      case 'xp': return `XP ${a.atual} / ${a.max}`;
      case 'campeao':
      case 'componente':
        if (a.modo === 'add') return `${a.nome} +${a.n}`;
        if (a.modo === 'remove') return `${a.nome} -${a.n}`;
        if (a.modo === 'min') return `${a.nome} (tenho)`;
        return `${a.nome} = ${plural(a.n, 'cópia', 'cópias')}`;
      case 'comp-favorita': return `Comp favorita: ${a.nome}`;
      case 'contest': return `Contest ${a.nome}: ${a.n}`;
      case 'aprimoramento': return `Aprimoramento: ${a.valor === 'eco' ? 'Economia' : 'Força'}`;
      case 'board': return `Board: ${a.valor === 'forte' ? 'Forte' : a.valor === 'medio' ? 'Médio' : 'Fraco'}`;
      case 'proxima': return 'Próxima rodada';
      default: return '';
    }
  }

  // ------------------------------------------------------------ suporte do navegador
  function suporteVoz(win) {
    const w = win || {};
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    const talvezBrave = Boolean(w.navigator && w.navigator.brave);
    if (!Ctor) {
      return { ok: false, talvezBrave, aviso: 'Este navegador não tem reconhecimento de voz (o Brave, por exemplo, não tem). Use o Chrome ou o Edge para falar, ou digite o comando no campo.' };
    }
    return {
      ok: true,
      talvezBrave,
      aviso: talvezBrave ? 'Brave detectado: a voz costuma falhar aqui porque o serviço de reconhecimento fica bloqueado. Se não funcionar, use o Chrome ou o Edge, ou digite o comando.' : null,
    };
  }

  function mensagemErroVoz(codigo) {
    switch (codigo) {
      case 'network': return 'O serviço de voz do navegador não respondeu (no Brave ele fica bloqueado). Use o Chrome ou o Edge para a voz, ou digite o comando.';
      case 'not-allowed':
      case 'service-not-allowed': return 'O navegador bloqueou o microfone. Libere o microfone para este site e tente de novo.';
      case 'no-speech': return 'Não ouvi nada. Fale perto do microfone e tente de novo.';
      case 'audio-capture': return 'Nenhum microfone encontrado neste computador.';
      case 'aborted': return '';
      default: return `A voz falhou (${String(codigo || 'erro').slice(0, 30)}). Use o Chrome ou o Edge, ou digite o comando.`;
    }
  }

  const api = { interpretar, descrever, numeroPorExtenso, faixaDe, FAIXAS_OURO, FAIXAS_VIDA, suporteVoz, mensagemErroVoz, norm, distancia };
  root.TFTPainelVoz = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
