const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../js/painel-voz.js');

const champs = [
  { id: 'DA_18_Veigar', n: 'Veigar', c: 1 },
  { id: 'DA_18_Morgana', n: 'Morgana', c: 2 },
  { id: 'DA_18_RekSai', n: "Rek'Sai", c: 1 },
  { id: 'DA_18_KogMaw', n: "Kog'Maw", c: 3 },
  { id: 'DA_18_Sett', n: 'Sett', c: 4 },
  { id: 'DA_Murkwolf18', n: 'Lobo Trevoguari', c: 2 },
  { id: 'DA_Krug18', n: 'Krugue', c: 3 },
  { id: 'DA_18_Ornn', n: 'Ornn', c: 1 },
  { id: 'DA_18_LeBlanc', n: 'LeBlanc', c: 3 },
  { id: 'DA_18_Alune', n: 'Alune', c: 5 },
  { id: 'DA_18_Aphelios', n: 'Aphelios', c: 4 },
];
const comps = [
  { id: 's1', nome: 'Enfeitiçador 6', estilo: 'Nível 8' },
  { id: 's2', nome: 'Vivaz Sabugueiro Veigar', estilo: 'Slowroll Nvl 6' },
  { id: 's3', nome: 'Vivaz Azir', estilo: 'Fast 8' },
  { id: 's4', nome: 'Solar Yunara Karma', estilo: 'Slowroll Nvl 6' },
];
const componentes = [
  { id: 'DA_Component_Spatula', n: 'Espátula' },
  { id: 'DA_Component_GiantsBelt', n: 'Cinto do Gigante' },
  { id: 'DA_Component_RecurveBow', n: 'Arco Recurvo' },
  { id: 'DA_Component_BFSword', n: 'Espada G.p.C.' },
  { id: 'DA_Component_NegatronCloak', n: 'Capa Negatron' },
];
const ctx = { champs, comps, componentes };
const ir = (t) => V.interpretar(t, ctx);
const um = (r, tipo) => r.acoes.filter((a) => a.tipo === tipo);

test('numeros por extenso viram digitos (ate 999), com e sem "e"', () => {
  const cases = [
    ['zero', 0], ['um', 1], ['dois', 2], ['duas', 2], ['três', 3], ['sete', 7], ['dez', 10], ['onze', 11], ['quinze', 15], ['dezesseis', 16], ['dezenove', 19],
    ['vinte', 20], ['vinte e cinco', 25], ['trinta e dois', 32], ['quarenta', 40], ['cinquenta', 50], ['sessenta e nove', 69], ['oitenta', 80], ['noventa e nove', 99],
    ['cem', 100], ['cento e vinte e cinco', 125],
  ];
  cases.forEach(([t, n]) => assert.equal(V.numeroPorExtenso(t), n, t));
  assert.equal(V.numeroPorExtenso('banana'), null);
});

test('exemplo do Elton: "ouro 32 vida 70 rodada 3-2 nivel 6"', () => {
  const r = ir('ouro 32 vida 70 rodada 3-2 nivel 6');
  assert.equal(um(r, 'ouro')[0].valor, 32);
  assert.equal(um(r, 'vida')[0].valor, 70);
  assert.equal(um(r, 'rodada')[0].valor, '3-2');
  assert.equal(um(r, 'nivel')[0].valor, 6);
  assert.equal(r.acoes.length, 4);
});

test('mesma frase falada por extenso e em ordem diferente', () => {
  const r = ir('nível seis, vida setenta, ouro trinta e dois, rodada três dois');
  assert.equal(um(r, 'ouro')[0].valor, 32);
  assert.equal(um(r, 'vida')[0].valor, 70);
  assert.equal(um(r, 'nivel')[0].valor, 6);
  assert.equal(um(r, 'rodada')[0].valor, '3-2');
});

test('numero antes da palavra: "32 de ouro, 70 de vida" nao troca os valores', () => {
  const r = ir('tenho 32 de ouro e 70 de vida');
  assert.equal(um(r, 'ouro')[0].valor, 32);
  assert.equal(um(r, 'vida')[0].valor, 70);
});

test('rodada: "3-2", "3 2", "32" (o reconhecedor junta), "estagio 4 rodada 1", "3 traço 2"', () => {
  assert.equal(um(ir('rodada 3-2'), 'rodada')[0].valor, '3-2');
  assert.equal(um(ir('rodada 3 2'), 'rodada')[0].valor, '3-2');
  assert.equal(um(ir('rodada 32'), 'rodada')[0].valor, '3-2');
  assert.equal(um(ir('estágio quatro rodada um'), 'rodada')[0].valor, '4-1');
  assert.equal(um(ir('rodada 3/2'), 'rodada')[0].valor, '3-2');
  assert.equal(um(ir('rodada 9-9'), 'rodada').length, 0, 'fora da faixa 1-7');
  assert.equal(um(ir('rodada 1-5'), 'rodada').length, 0, 'estagio 1 so tem 4 rodadas');
});

test('valores fora da faixa sao ignorados e avisados, nao aplicados', () => {
  const r = ir('vida 300 nivel 15 ouro 5000');
  assert.equal(r.acoes.length, 0);
  assert.ok(r.naoEntendi.length > 0);
});

test('streak: vitorias positivas, derrotas negativas, zerar', () => {
  assert.equal(um(ir('3 vitórias seguidas'), 'streak')[0].valor, 3);
  assert.equal(um(ir('duas derrotas seguidas'), 'streak')[0].valor, -2);
  assert.equal(um(ir('streak de vitória 4'), 'streak')[0].valor, 4);
  assert.equal(um(ir('sequência de 5 derrotas'), 'streak')[0].valor, -5);
  assert.equal(um(ir('zerar streak'), 'streak')[0].valor, 0);
  assert.equal(um(ir('sem streak'), 'streak')[0].valor, 0);
});

test('xp: "xp 12 de 36" e "xp 12/36"', () => {
  assert.deepEqual([um(ir('xp 12 de 36'), 'xp')[0].atual, um(ir('xp 12 de 36'), 'xp')[0].max], [12, 36]);
  const b = um(ir('xp 12/36'), 'xp')[0];
  assert.deepEqual([b.atual, b.max], [12, 36]);
});

test('campeao: "tenho dois Veigar" define 2 copias; "mais um Morgana" soma; "vendi Sett" remove', () => {
  const a = um(ir('tenho dois Veigar'), 'campeao')[0];
  assert.deepEqual([a.id, a.modo, a.n], ['DA_18_Veigar', 'set', 2]);
  const b = um(ir('mais um Morgana'), 'campeao')[0];
  assert.deepEqual([b.id, b.modo, b.n], ['DA_18_Morgana', 'add', 1]);
  const c = um(ir('vendi Sett'), 'campeao')[0];
  assert.deepEqual([c.id, c.modo, c.n], ['DA_18_Sett', 'remove', 1]);
  const d = um(ir('peguei três Ornn'), 'campeao')[0];
  assert.deepEqual([d.id, d.modo, d.n], ['DA_18_Ornn', 'add', 3]);
});

test('campeao sem numero = "pelo menos 1" (nao reduz o que ja tem)', () => {
  const a = um(ir('tenho Veigar'), 'campeao')[0];
  assert.deepEqual([a.modo, a.n], ['min', 1]);
});

test('varios campeoes numa frase', () => {
  const r = um(ir('tenho dois Veigar, uma Morgana e três Ornn'), 'campeao');
  assert.deepEqual(r.map((x) => [x.id, x.n, x.modo]), [['DA_18_Veigar', 2, 'set'], ['DA_18_Morgana', 1, 'set'], ['DA_18_Ornn', 3, 'set']]);
});

test('nomes com apostrofo, espaco e erro de reconhecimento: Rek Sai, Kogmaw, Veigarr, vei gar, Lobo', () => {
  assert.equal(um(ir('tenho reksai'), 'campeao')[0].id, 'DA_18_RekSai');
  assert.equal(um(ir('tenho rek sai'), 'campeao')[0].id, 'DA_18_RekSai');
  assert.equal(um(ir('tenho kog maw'), 'campeao')[0].id, 'DA_18_KogMaw');
  assert.equal(um(ir('tenho vei gar'), 'campeao')[0].id, 'DA_18_Veigar');
  assert.equal(um(ir('tenho vigar'), 'campeao')[0].id, 'DA_18_Veigar', 'distancia 1');
  assert.equal(um(ir('tenho lobo trevoguari'), 'campeao')[0].id, 'DA_Murkwolf18');
  assert.equal(um(ir('tenho o lobo'), 'campeao')[0].id, 'DA_Murkwolf18', 'primeira palavra unica serve de apelido');
  assert.equal(um(ir('tenho leblanc'), 'campeao')[0].id, 'DA_18_LeBlanc');
  assert.equal(um(ir('tenho le blanc'), 'campeao')[0].id, 'DA_18_LeBlanc');
});

test('nome curto nao aceita aproximacao (sete/sett, ornn/orm)', () => {
  assert.equal(um(ir('tenho sete'), 'campeao').length, 0, '"sete" e numero, nao o campeao Sett');
  assert.equal(um(ir('tenho orm'), 'campeao').length, 0);
});

test('palavras comuns nao viram campeao', () => {
  const r = ir('vida setenta e ouro cinquenta tenho que subir de nivel');
  assert.equal(um(r, 'campeao').length, 0);
});

test('componentes: "tenho duas espatulas" e "cinto do gigante"', () => {
  const a = um(ir('tenho duas espátulas'), 'componente')[0];
  assert.deepEqual([a.id, a.n, a.modo], ['DA_Component_Spatula', 2, 'set']);
  const b = um(ir('mais um cinto do gigante'), 'componente')[0];
  assert.deepEqual([b.id, b.n, b.modo], ['DA_Component_GiantsBelt', 1, 'add']);
  assert.equal(um(ir('tenho um arco'), 'componente')[0].id, 'DA_Component_RecurveBow');
});

test('comp favorita: unica acha direto; ambigua devolve opcoes', () => {
  const a = um(ir('comp Enfeitiçador'), 'comp-favorita')[0];
  assert.equal(a.id, 's1');
  const amb = ir('comp vivaz');
  assert.equal(um(amb, 'comp-favorita').length, 0);
  assert.equal(amb.ambiguos[0].tipo, 'comp-favorita');
  assert.deepEqual(amb.ambiguos[0].opcoes.map((o) => o.id).sort(), ['s2', 's3']);
  const c = um(ir('comp vivaz azir'), 'comp-favorita')[0];
  assert.equal(c.id, 's3');
  assert.equal(um(ir('forçar comp solar'), 'comp-favorita')[0].id, 's4');
  assert.equal(um(ir('comp inexistente'), 'comp-favorita').length, 0);
});

test('contest: "contest enfeitiçador 2"', () => {
  const a = um(ir('contest enfeitiçador 2'), 'contest')[0];
  assert.deepEqual([a.id, a.n], ['s1', 2]);
  const b = um(ir('contest solar dois'), 'contest')[0];
  assert.deepEqual([b.id, b.n], ['s4', 2]);
});

test('aprimoramento, board e proxima rodada', () => {
  assert.equal(um(ir('aprimoramento de economia'), 'aprimoramento')[0].valor, 'eco');
  assert.equal(um(ir('aprimoramento de força'), 'aprimoramento')[0].valor, 'forca');
  assert.equal(um(ir('aprimoramento de combate'), 'aprimoramento')[0].valor, 'forca');
  assert.equal(um(ir('board forte'), 'board')[0].valor, 'forte');
  assert.equal(um(ir('meu board está fraco'), 'board')[0].valor, 'fraco');
  assert.equal(um(ir('próxima rodada'), 'proxima').length, 1);
  assert.equal(um(ir('próxima rodada'), 'rodada').length, 0, 'nao confunde com "rodada N"');
});

test('frase completa de uma vez', () => {
  const r = ir('ouro 32 vida 70 rodada 3-2 nivel 6 tenho dois Veigar comp Enfeitiçador aprimoramento de economia');
  assert.deepEqual(r.acoes.map((a) => a.tipo).sort(), ['aprimoramento', 'campeao', 'comp-favorita', 'nivel', 'ouro', 'rodada', 'vida']);
  assert.equal(r.naoEntendi, '');
});

test('entrada vazia, lixo e tentativas de injecao nao quebram nem aplicam nada', () => {
  assert.deepEqual(ir('').acoes, []);
  assert.deepEqual(ir(null).acoes, []);
  assert.deepEqual(ir(undefined).acoes, []);
  assert.equal(ir('<script>alert(1)</script> ouro 5').acoes.length, 1);
  assert.deepEqual(ir('blá blá blá').acoes, []);
  assert.ok(ir('blá blá blá').naoEntendi.length > 0);
  assert.equal(ir('x'.repeat(100000)).acoes.length, 0, 'texto gigante e cortado');
  assert.equal(um(ir('ouro __proto__ constructor'), 'ouro').length, 0);
});

test('sem contexto (sem lista de campeoes) ainda entende os numeros', () => {
  const r = V.interpretar('ouro 20', {});
  assert.equal(r.acoes[0].valor, 20);
});

test('descrever gera texto curto e seguro para a tela', () => {
  assert.equal(V.descrever({ tipo: 'ouro', valor: 32 }), 'Ouro 32');
  assert.equal(V.descrever({ tipo: 'rodada', valor: '3-2' }), 'Rodada 3-2');
  assert.equal(V.descrever({ tipo: 'streak', valor: -2 }), 'Streak: 2 derrotas');
  assert.equal(V.descrever({ tipo: 'campeao', nome: 'Veigar', modo: 'set', n: 2 }), 'Veigar = 2 cópias');
  assert.equal(V.descrever({ tipo: 'campeao', nome: 'Veigar', modo: 'add', n: 1 }), 'Veigar +1');
  assert.equal(V.descrever({ tipo: 'campeao', nome: 'Veigar', modo: 'remove', n: 1 }), 'Veigar -1');
  assert.equal(V.descrever({ tipo: 'campeao', nome: 'Veigar', modo: 'min', n: 1 }), 'Veigar (tenho)');
  assert.equal(V.descrever({ tipo: 'comp-favorita', nome: 'Enfeitiçador 6' }), 'Comp favorita: Enfeitiçador 6');
});

test('faixas rapidas: ouro e vida mapeiam para um valor conservador e acham a faixa de volta', () => {
  assert.deepEqual(V.FAIXAS_OURO.map((f) => f.id), ['<20', '20-30', '30-40', '40-50', '50+']);
  assert.deepEqual(V.FAIXAS_OURO.map((f) => f.valor), [15, 20, 32, 40, 50]);
  assert.deepEqual(V.FAIXAS_VIDA.map((f) => f.id), ['<30', '30-40', '41-79', '80+']);
  assert.deepEqual(V.FAIXAS_VIDA.map((f) => f.valor), [20, 35, 60, 90]);
  assert.equal(V.faixaDe(V.FAIXAS_OURO, 19), '<20');
  assert.equal(V.faixaDe(V.FAIXAS_OURO, 20), '20-30');
  assert.equal(V.faixaDe(V.FAIXAS_OURO, 29), '20-30');
  assert.equal(V.faixaDe(V.FAIXAS_OURO, 32), '30-40');
  assert.equal(V.faixaDe(V.FAIXAS_OURO, 50), '50+');
  assert.equal(V.faixaDe(V.FAIXAS_OURO, 120), '50+');
  assert.equal(V.faixaDe(V.FAIXAS_VIDA, 29), '<30');
  assert.equal(V.faixaDe(V.FAIXAS_VIDA, 30), '30-40');
  assert.equal(V.faixaDe(V.FAIXAS_VIDA, 41), '41-79');
  assert.equal(V.faixaDe(V.FAIXAS_VIDA, 80), '80+');
  assert.equal(V.faixaDe(V.FAIXAS_VIDA, null), null);
  V.FAIXAS_OURO.forEach((f) => assert.equal(V.faixaDe(V.FAIXAS_OURO, f.valor), f.id, 'o valor da faixa cai na propria faixa'));
  V.FAIXAS_VIDA.forEach((f) => assert.equal(V.faixaDe(V.FAIXAS_VIDA, f.valor), f.id));
});

test('faixas de vida batem com as do Painel (Folga 80+, Segura 41-79, Atencao 30-40, Critica <30)', () => {
  const P = require('../js/painel-logic.js');
  const nomes = { '<30': 'critica', '30-40': 'atencao', '41-79': 'segura', '80+': 'folga' };
  V.FAIXAS_VIDA.forEach((f) => assert.equal(P.faixaVida(f.valor), nomes[f.id], f.id));
});

test('suporte a voz: detecta SpeechRecognition, Brave e navegador sem suporte', () => {
  assert.equal(V.suporteVoz({}).ok, false);
  assert.match(V.suporteVoz({}).aviso, /Chrome|Edge/);
  assert.equal(V.suporteVoz({ webkitSpeechRecognition: function () {} }).ok, true);
  assert.equal(V.suporteVoz({ SpeechRecognition: function () {} }).ok, true);
  const brave = V.suporteVoz({ webkitSpeechRecognition: function () {}, navigator: { brave: { isBrave: () => Promise.resolve(true) } } });
  assert.equal(brave.ok, true);
  assert.equal(brave.talvezBrave, true);
  assert.match(V.mensagemErroVoz('network'), /Chrome|Edge/);
  assert.match(V.mensagemErroVoz('not-allowed'), /microfone/i);
  assert.match(V.mensagemErroVoz('no-speech'), /n[aã]o ouvi/i);
  assert.ok(V.mensagemErroVoz('qualquer-coisa').length > 5);
});
