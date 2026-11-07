const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Reg = require('../js/painel-regras.js');

const ROOT = path.join(__dirname, '..');
// Mesma normalizacao para o .md e para o trecho: sem negrito/italico, celulas de tabela separadas por " | ".
function normMd(md) {
  return md
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => (/^\s*\|/.test(l) ? l.split('|').map((c) => c.trim()).filter(Boolean).join(' | ') : l))
    .join('\n')
    .replace(/\*/g, '')
    .replace(/[ \t]+/g, ' ');
}
const FONTES = {
  estrategia: normMd(fs.readFileSync(path.join(ROOT, 'data/estrategia-padrao.md'), 'utf8')),
  guia: normMd(fs.readFileSync(path.join(ROOT, 'data/guia-do-jogo.md'), 'utf8')),
};
const html = { estrategia: fs.readFileSync(path.join(ROOT, 'estrategia.html'), 'utf8'), guia: fs.readFileSync(path.join(ROOT, 'guia.html'), 'utf8') };

test('toda regra tem id unico, referencia, origem valida e trecho', () => {
  const ids = Object.keys(Reg.REGRAS);
  assert.ok(ids.length >= 90, 'regras: ' + ids.length);
  ids.forEach((id) => {
    const r = Reg.REGRAS[id];
    assert.equal(r.id, id);
    assert.ok(r.ref && r.ref.length > 5, id);
    assert.ok(['guia', 'derivada', 'painel'].includes(r.origem), id);
    assert.equal(r.derivada, r.origem === 'derivada', id);
    assert.ok(r.trecho && r.trecho.length > 5, id);
    assert.ok(['estrategia', 'guia'].includes(r.fonte), id);
  });
});

test('fidelidade: cada trecho citado existe, palavra por palavra, no .md de origem', () => {
  const faltam = [];
  Object.values(Reg.REGRAS).forEach((r) => {
    if (!FONTES[r.fonte].includes(r.trecho)) faltam.push(r.id + ' -> ' + r.trecho);
  });
  assert.deepEqual(faltam, []);
});

const MARCA = /regra derivada do guia/;
// Marca "(regra derivada do guia)": na propria linha/linha da tabela ou numa linha so dela logo abaixo do titulo do bloco.
function marcaDoTrecho(md, trecho) {
  const pos = md.indexOf(trecho);
  const ini = md.lastIndexOf('\n', pos) + 1;
  const fimLinha = md.indexOf('\n', pos + trecho.length);
  const linha = md.slice(ini, fimLinha < 0 ? md.length : fimLinha);
  const titulo = md.lastIndexOf('\n#', pos);
  const bloco = md.slice(titulo < 0 ? 0 : titulo + 1, ini).split('\n').slice(0, 4);
  const blocoMarcado = bloco.slice(1).some((l) => l.trim().startsWith('(regra derivada do guia'));
  let naLinha = MARCA.test(linha);
  if (naLinha && linha.includes(' | ')) {
    // tabela: so conta a marca nas celulas que o trecho cobre
    const a = pos - ini;
    const b = a + trecho.length;
    let off = 0;
    naLinha = linha.split(' | ').some((cel) => {
      const ini2 = off;
      const fim2 = off + cel.length;
      off = fim2 + 3;
      return fim2 > a && ini2 < b && MARCA.test(cel);
    });
  }
  return { naLinha, blocoMarcado };
}

test('regras derivadas: o .md marca o trecho (na linha ou no bloco); regras do guia: nao marca', () => {
  const md = FONTES.estrategia;
  Object.values(Reg.REGRAS).filter((r) => r.fonte === 'estrategia' && r.origem !== 'painel').forEach((r) => {
    const m = marcaDoTrecho(md, r.trecho);
    if (r.derivada) assert.ok(m.naLinha || m.blocoMarcado, r.id + ' (derivada) sem marca no .md');
    else assert.ok(!m.naLinha && !m.blocoMarcado, r.id + ' (guia) esta marcada derivada no .md');
  });
});

test('ancoras dos links existem nas paginas geradas', () => {
  Object.values(Reg.REGRAS).forEach((r) => {
    const [pag, ancora] = r.href.split('#');
    const chave = pag.startsWith('estrategia') ? 'estrategia' : 'guia';
    assert.ok(html[chave].includes(`id="${ancora}"`), r.id + ' ' + r.href);
  });
});

test('regra() devolve copia e falha para id desconhecido', () => {
  const a = Reg.regra('f8-4-2');
  a.ref = 'x';
  assert.notEqual(Reg.regra('f8-4-2').ref, 'x');
  assert.throws(() => Reg.regra('nao-existe'), /desconhecida/);
});

test('numeros-chave do codigo batem com as regras: 32, 40, 20-30, 50, 80, 10, 14, 20', () => {
  const t = (id) => Reg.REGRAS[id].trecho;
  assert.match(t('f8-piso-32'), /32/);
  assert.match(t('f8-piso-40'), /40/);
  assert.match(t('f8-piso-2030'), /20–30/);
  assert.match(t('rr-c1-3-2'), /50/);
  assert.match(t('ec-3b-entrada'), /80\+/);
  assert.match(t('f8-piso-10'), /10/);
  assert.match(t('f8-2-2'), /14 ou 20/);
  assert.match(t('rr-c2-4-1'), /até 20/);
  assert.match(t('rr-c1-3-1'), /até 32/);
});
