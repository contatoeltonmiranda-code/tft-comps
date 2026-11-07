(function (root) {
  // De onde vem o historico de partidas: servidor local so-leitura (127.0.0.1), copia no navegador, arquivo importado ou exemplo.
  // Nunca fala com a Riot e nunca recebe chave: a chave fica so no helper local (tools/riot-fetch.js).
  const PJ = typeof require === 'function' && typeof module !== 'undefined' ? require('./posjogo-logic.js') : root.TFTPosjogo;

  const PORTA_PADRAO = 17870;
  const CHAVE_CACHE = 'tft-comps:partidas:v1';
  const MAX_ARQUIVO = 8 * 1024 * 1024;
  const TIMEOUT_MS = 2500;

  function portaDe(search) {
    const m = /[?&]porta=(\d{1,5})(?:&|$)/.exec(search || '');
    const n = m ? Number(m[1]) : NaN;
    return Number.isInteger(n) && n >= 1024 && n <= 65535 ? n : PORTA_PADRAO;
  }

  function lerCache(storage) {
    try {
      const raw = storage && storage.getItem(CHAVE_CACHE);
      if (!raw) return null;
      const o = JSON.parse(raw);
      const partidas = PJ.sanitizarPartidas(o).partidas;
      return partidas.length ? { partidas, salvoEm: typeof o.salvoEm === 'string' ? o.salvoEm.slice(0, 40) : null, origem: o.origem === 'arquivo' ? 'arquivo' : 'cache' } : null;
    } catch (e) {
      return null;
    }
  }

  function guardar(storage, partidas, origem) {
    try {
      storage.setItem(CHAVE_CACHE, JSON.stringify({ salvoEm: new Date().toISOString(), origem, partidas }));
    } catch (e) { /* sem armazenamento: segue sem copia */ }
  }

  function esquecer(storage) {
    try { storage.removeItem(CHAVE_CACHE); } catch (e) { /* nada a apagar */ }
  }

  const lerReais = (storage) => {
    const c = lerCache(storage);
    return c ? c.partidas : [];
  };

  function importarTexto(texto, storage) {
    if (typeof texto !== 'string' || texto.length > MAX_ARQUIVO) return { ok: false, erro: 'Arquivo grande demais ou inválido.' };
    let obj;
    try { obj = JSON.parse(texto); } catch (e) { return { ok: false, erro: 'O arquivo não é um JSON válido.' }; }
    const { partidas, descartadas } = PJ.sanitizarPartidas(obj);
    if (!partidas.length) return { ok: false, erro: 'Nenhuma partida válida no arquivo (use o partidas.json do helper local).' };
    guardar(storage, partidas, 'arquivo');
    return { ok: true, partidas, descartadas };
  }

  async function pedir(fetchFn, url) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null;
    try {
      const r = await fetchFn(url, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', signal: ctl ? ctl.signal : undefined });
      if (!r.ok) throw new Error('http');
      return await r.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function motivoDe(st) {
    if (!st || typeof st !== 'object') return 'vazio';
    if (!st.configurado) return 'sem-config';
    if (st.chave === 'ausente') return 'sem-chave';
    if (st.resultado === 'chave-invalida') return 'chave-invalida';
    return 'vazio';
  }

  async function carregar({ fetchFn, storage, exemplo, search }) {
    const base = `http://127.0.0.1:${portaDe(search)}`;
    const comoExemplo = (motivo, status) => ({ origem: 'exemplo', motivo, status: status || null, partidas: PJ.sanitizarPartidas(exemplo).partidas });
    let status = null;
    let dados;
    try {
      dados = await pedir(fetchFn, base + '/api/partidas');
      status = await pedir(fetchFn, base + '/api/status').catch(() => null);
    } catch (e) {
      const c = lerCache(storage);
      return c ? { origem: c.origem, motivo: 'offline', partidas: c.partidas, salvoEm: c.salvoEm, status: null } : comoExemplo('offline');
    }
    const { partidas } = PJ.sanitizarPartidas(dados);
    if (partidas.length) {
      guardar(storage, partidas, 'local');
      return { origem: 'local', motivo: 'ok', partidas, status, atualizadoEm: dados && typeof dados.atualizadoEm === 'string' ? dados.atualizadoEm.slice(0, 40) : null };
    }
    const c = lerCache(storage);
    if (c) return { origem: c.origem, motivo: motivoDe(status), partidas: c.partidas, salvoEm: c.salvoEm, status };
    return comoExemplo(motivoDe(status), status);
  }

  const api = { PORTA_PADRAO, CHAVE_CACHE, portaDe, carregar, importarTexto, esquecer, lerReais, lerCache };
  root.TFTFonte = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
