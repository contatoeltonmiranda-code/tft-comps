(function (root) {
  // Registro de regras do Painel. Cada regra aponta para o trecho de data/estrategia-padrao.md (ou do guia)
  // de onde sai. tests/painel-regras.test.js confere que cada `trecho` existe no .md, palavra por palavra.
  //   origem 'guia'     = dito no .md (tabela, gatilho, piso)
  //   origem 'derivada' = o proprio .md marca "(regra derivada do guia)"
  //   origem 'painel'   = interpretacao do painel para entrada manual (limiar ou inferencia); nao vem do .md
  const SEC = {
    qual: ['§1 Qual estratégia jogar', 'estrategia.html#qual-estrategia-jogar', 'estrategia'],
    f8q: ['§2 Fast 8 · Quando escolher', 'estrategia.html#estrategia-1-fast-8-padrao-quando-escolher', 'estrategia'],
    f8r: ['§2 Fast 8 · Rodada a rodada', 'estrategia.html#estrategia-1-fast-8-padrao-rodada-a-rodada', 'estrategia'],
    f8g: ['§2 Fast 8 · Gatilhos', 'estrategia.html#estrategia-1-fast-8-padrao-gatilhos', 'estrategia'],
    f8p: ['§2 Fast 8 · Pisos', 'estrategia.html#estrategia-1-fast-8-padrao-pisos', 'estrategia'],
    rrq: ['§3 Reroll · Quando escolher', 'estrategia.html#estrategia-2-reroll-e-slow-roll-quando-escolher', 'estrategia'],
    rrr: ['§3 Reroll · Rodada a rodada', 'estrategia.html#estrategia-2-reroll-e-slow-roll-rodada-a-rodada', 'estrategia'],
    rrg: ['§3 Reroll · Gatilhos', 'estrategia.html#estrategia-2-reroll-e-slow-roll-gatilhos', 'estrategia'],
    rrp: ['§3 Reroll · Pisos', 'estrategia.html#estrategia-2-reroll-e-slow-roll-pisos', 'estrategia'],
    ecq: ['§4 Economia · Quando escolher', 'estrategia.html#estrategia-3-economia-maxima-fast-8-antecipado-ou-fast-9-quando-escolher', 'estrategia'],
    ecr: ['§4 Economia · Rodada a rodada', 'estrategia.html#estrategia-3-economia-maxima-fast-8-antecipado-ou-fast-9-rodada-a-rodada', 'estrategia'],
    ecg: ['§4 Economia · Gatilhos', 'estrategia.html#estrategia-3-economia-maxima-fast-8-antecipado-ou-fast-9-gatilhos', 'estrategia'],
    ecp: ['§4 Economia · Pisos', 'estrategia.html#estrategia-3-economia-maxima-fast-8-antecipado-ou-fast-9-pisos', 'estrategia'],
    ece: ['§4 Economia · Erros comuns', 'estrategia.html#estrategia-3-economia-maxima-fast-8-antecipado-ou-fast-9-erros-comuns', 'estrategia'],
    p1: ['§5 Passo 1 · Faixas de vida', 'estrategia.html#leitura-de-jogo-padronizada-passo-1-faixas-de-vida', 'estrategia'],
    p2: ['§5 Passo 2 · Degraus de ouro', 'estrategia.html#leitura-de-jogo-padronizada-passo-2-degraus-de-ouro', 'estrategia'],
    p3: ['§5 Passo 3 · Streak', 'estrategia.html#leitura-de-jogo-padronizada-passo-3-streak', 'estrategia'],
    p4: ['§5 Passo 4 · Força do board', 'estrategia.html#leitura-de-jogo-padronizada-passo-4-forca-do-board', 'estrategia'],
    p5: ['§5 Passo 5 · Contest', 'estrategia.html#leitura-de-jogo-padronizada-passo-5-contest', 'estrategia'],
    p7: ['§5 Passo 7 · Matriz vida x board', 'estrategia.html#leitura-de-jogo-padronizada-passo-7-matriz-de-decisao-vida-x-board', 'estrategia'],
    pan: ['§5 Pânico x agir', 'estrategia.html#leitura-de-jogo-padronizada-panico-x-agir', 'estrategia'],
    leit: ['§5 Leitura de jogo padronizada', 'estrategia.html#leitura-de-jogo-padronizada', 'estrategia'],
    gpart: ['Guia · Como a partida é dividida', 'guia.html#como-a-partida-e-dividida', 'guia'],
    gjuros: ['Guia · De onde vem o ouro', 'guia.html#de-onde-vem-o-ouro', 'guia'],
    ggloss: ['Guia · Glossário rápido', 'guia.html#glossario-rapido', 'guia'],
    xp: ['Nota do painel · custo do XP', 'estrategia.html#estrategia-2-reroll-e-slow-roll-rodada-a-rodada', 'estrategia'],
  };

  // [id, secao, linha, origem, trecho]
  const T = [
    // ---------- §1
    ['q-2-1-f8', 'qual', '2-1', 'guia', 'Upgrade, itens úteis e aprimoramento de força | Estratégia 1 (Fast 8), com board forte.'],
    ['q-2-1-ec', 'qual', '2-1', 'guia', 'Só pares, sem itens úteis, aprimoramento de economia | Estratégia 3 (Open Fort) até o 3-1.'],
    ['q-reroll', 'qual', '2-1 a fim do 2', 'guia', '4+ cópias de custo 1, ou 2+ de custo 2, com itens BIS e sem contest | Estratégia 2 (Reroll).'],
    ['q-3-2', 'qual', '3-2', 'guia', 'Ainda indeciso | Maior economia possível e Estratégia 1. Indeciso no 3-2 = atrasado.'],
    ['q-4-1', 'qual', '4-1', 'guia', '80+ de vida e aprimoramento de economia | Pode virar Fast 9 (Estratégia 3B).'],
    ['q-default', 'qual', 'regra geral', 'guia', 'Não sabe o que jogar? Fast 8. É o caminho padrão.'],
    ['q-openfort', 'qual', 'nota', 'derivada', 'O Open Fort é a mesma abertura do reroll de custo 1. Decida a saída no fim do estágio 2, com componentes na mão e scout feito.'],

    // ---------- §2 Fast 8
    ['f8-q-comp', 'f8q', 'comp', 'guia', 'Comp final de custo 4, ou nenhuma comp clara.'],
    ['f8-q-eco', 'f8q', 'economia', 'guia', 'Aprimoramento de economia, win streak ou economia bem planejada.'],
    ['f8-q-contest', 'f8q', 'contest', 'guia', 'Até 1 jogador na mesma comp.'],
    ['f8-2-1', 'f8r', '2-1', 'guia', 'SE upgrade + itens úteis + aprimoramento de força → UPAR 4 e buscar win streak. SENÃO → FICAR 3, loss streak (abertura da Estratégia 3).'],
    ['f8-2-2', 'f8r', '2-2 a 2-7', 'guia', 'Não role. Exceção: muitos pares. Pare de gastar em 14 ou 20, nunca em 10.'],
    ['f8-2-2-pares', 'f8r', '2-2 a 2-7 · "muitos pares"', 'painel', 'Exceção: muitos pares.'],
    ['f8-2-3', 'f8r', '2-3', 'guia', 'SE win streak e board forte → UPAR 5. O ouro da streak paga.'],
    ['f8-2-4', 'f8r', '2-4', 'guia', 'Pegue o item que a comp precisa.'],
    ['f8-2-5', 'f8r', '2-5', 'guia', 'SE board forte (ou quer poupar vida) E ouro ≥ 10 (ideal 20) → UPAR 5. SENÃO → FICAR e GUARDAR.'],
    ['f8-fim2', 'f8r', 'Fim do 2', 'guia', 'Componentes na mão. Veja os boards e comece a se comprometer.'],
    ['f8-3-1', 'f8r', '3-1', 'guia', 'Não suba ao 6 por impulso. SE win streak e board forte → UPAR 6 (curva agressiva). Pré-level para o 3-2, SE não custar economia.'],
    ['f8-3-2', 'f8r', '3-2', 'guia', 'SE ouro ≥ 30–32 → UPAR 6. SE ~20 e board bom → pode UPAR (a economia fica ruim). Comp definida aqui.'],
    ['f8-3-roll', 'f8r', '3-2 a 3-5', 'guia', 'SE 3+ pares e quer ganhar → 2–3 rolagens por rodada, parando em 32.'],
    ['f8-3-roll-falta1', 'f8g', 'Rolar', 'derivada', 'SE falta 1 peça para fechar um traço → ENTÃO role até achar, parando em 32.'],
    ['f8-3-3', 'f8r', '3-3', 'guia', 'Level torto. Não compre XP; faça pré-level se for subir no 3-5.'],
    ['f8-3-5', 'f8r', '3-5', 'guia', 'SE muito rico ou para segurar a streak → UPAR 7. SENÃO → FICAR 6 e GUARDAR rumo a 50.'],
    ['f8-3-5-limiar', 'f8r', '3-5 · "muito rico" e "segurar a streak"', 'painel', 'SE muito rico ou para segurar a streak → UPAR 7.'],
    ['f8-3-6', 'f8r', '3-6', 'guia', 'Level torto. Pré-level, se for subir no 3-7.'],
    ['f8-3-7', 'f8r', '3-7 (PvE)', 'guia', 'SE economia alta (aprimoramento de economia) OU 2 jogadores na sua comp → UPAR 8 e ROLAR antes de todos, até 20–30. SENÃO → UPAR 7, se ainda não foi. Revise a curva.'],
    ['f8-4-1', 'f8r', '4-1', 'guia', 'SE ainda no 6 → UPAR 7. Termine 2 XP abaixo do 8, SE não custar economia. Curva agressiva: UPAR 8 aqui.'],
    ['f8-4-1-contest', 'f8g', 'Rolar', 'guia', 'SE 2 jogadores na sua comp → ENTÃO suba ao 8 e role no 3-7 ou 4-1, antes de todos.'],
    ['f8-4-2', 'f8r', '4-2', 'guia', 'SE ouro ≥ ~40 → UPAR 8 e rolar atrás de 1 cópia do carry e do tanque. SENÃO → FICAR 7, GUARDAR e subir no 4-5.'],
    ['f8-4-5', 'f8r', '4-5', 'guia', 'Só SE não subiu no 4-2. Mais ouro, mas o lobby já tirou peças do pool.'],
    ['f8-5-1', 'f8r', '5-1', 'guia', 'SE achou carry e tanque e estabilizou → refaça economia e UPAR 9 (5-1, 5-2 ou 5-5). SENÃO → jogue com custo 4 de 1★, refaça economia e ROLE de novo no 8. O 9 fica para o estágio 6.'],
    ['f8-5-1-estabilizou', 'f8r', '5-1 · "estabilizou"', 'painel', 'SE achou carry e tanque e estabilizou'],
    ['f8-5-5', 'f8r', '5-5 / 6-1', 'guia', 'SE ainda não foi. Cape o board.'],
    ['f8-gat-upar', 'f8g', 'Upar', 'guia', 'SE o nível poupa vida, OU mantém uma streak importante, OU dá chance de custo mais alto'],
    ['f8-gat-parar-carry', 'f8g', 'Parar de rolar', 'guia', 'SE achou 1 cópia do carry e do tanque → pare.'],
    ['f8-gat-parar-20', 'f8g', 'Parar de rolar', 'guia', 'SE o ouro chegou a 20 no roll down → pare.'],
    ['f8-gat-contest3', 'f8g', 'Abandonar ou pivotar', 'guia', 'SE 3+ jogadores na sua comp → troque de comp, mantendo o fast 8.'],
    ['f8-piso-10', 'f8p', 'Ouro 10', 'guia', 'Ouro | 10 | Sempre. Exceção: fim de jogo, morrendo.'],
    ['f8-piso-32', 'f8p', 'Ouro 32', 'guia', 'Ouro | 32 | Ao rolar no estágio 3. Volta perto de 50 em 2 rodadas.'],
    ['f8-piso-40', 'f8p', 'Ouro ~40', 'guia', 'Ouro | ~40 | Para subir ao 8 no 4-2.'],
    ['f8-piso-2030', 'f8p', 'Ouro 20–30', 'guia', 'Ouro | 20–30 | Fim do roll down no 4-2 ou 4-5.'],
    ['f8-piso-vida', 'f8p', 'Vida', 'derivada', 'SE vida em Atenção (30–40) no 4-1 → não adie o roll down para o 4-5.'],

    // ---------- §3 Reroll
    ['rr-q-copias', 'rrq', 'Cópias cedo', 'guia', 'Cópias cedo | 4+ (5 ideal) | 2+ | Cópias cedo'],
    ['rr-q-itens', 'rrq', 'Itens', 'guia', 'Itens | BIS | BIS ou slamáveis que poupem vida | —'],
    ['rr-q-contest', 'rrq', 'Contest', 'guia', 'Contest | Qualquer contest pesa | Qualquer contest pesa | Qualquer contest pesa'],
    ['rr-q-nivel', 'rrq', 'Nível de rolar', 'guia', 'Nível de rolar | 4 no 3-1, depois 5 | 6 | 7'],
    ['rr-slow', 'rrq', 'Slow roll', 'guia', 'Slow roll: fique acima de 50 e role só o excedente. Se precisar, desça um pouco.'],
    ['rr-c1-2-1', 'rrr', '2-1 · custo 1', 'guia', 'FICAR 3. Open Fort. Segure os pares.'],
    ['rr-c2-2-1', 'rrr', '2-1 · custo 2', 'guia', 'SE itens slamáveis → board razoável para poupar vida. SENÃO → Open Fort (cuidado com a vida).'],
    ['rr-c1-2-5', 'rrr', '2-5 · custo 1', 'guia', '2-5 | FICAR e GUARDAR.'],
    ['rr-c2-2-5', 'rrr', '2-5 · custo 2', 'guia', 'GUARDAR. UPAR 5 só SE board forte.'],
    ['rr-c1-3-1', 'rrr', '3-1 · custo 1', 'guia', 'Nível 4. ROLAR até 32. Hyper roll: desce mais, nunca abaixo de 10.'],
    ['rr-c2-3-1', 'rrr', '3-1 · custo 2', 'guia', 'FICAR. Não suba ao 6 por impulso.'],
    ['rr-c1-3-2', 'rrr', '3-2 · custo 1', 'guia', 'Nível 5 (o jogo te leva). GUARDAR até 50; depois slow roll.'],
    ['rr-c2-3-2', 'rrr', '3-2 · custo 2', 'guia', 'SE ouro ≥ 50 → UPAR 6 e slow roll. SENÃO → UPAR 6 no 3-5.'],
    ['rr-c1-3-5', 'rrr', '3-5 · custo 1', 'guia', 'Prazo ideal. SE bateu os 3★ → PARAR e UPAR. SENÃO → slow roll segue.'],
    ['rr-c2-3-5', 'rrr', '3-5 · custo 2', 'guia', 'UPAR 6, se não foi. Slow roll acima de 50.'],
    ['rr-c1-4-1', 'rrr', '4-1 · custo 1', 'guia', 'Última rodada de rolar. SE não bateu → veja "Abandonar".'],
    ['rr-c2-4-1', 'rrr', '4-1 · custo 2', 'guia', 'ROLAR até 20 por upgrades e 3★.'],
    ['rr-gat-3star', 'rrg', 'Upar', 'guia', 'SE bateu os 3★ → ENTÃO pare de rolar e suba de nível.'],
    ['rr-gat-c1-nivel', 'rrg', 'Upar', 'guia', 'SE custo 1: não suba antes de bater. O nível 4 é melhor que o 5 ou o 6 para achar custo 1.'],
    ['rr-gat-excedente', 'rrg', 'Rolar', 'guia', 'SE slow roll e ouro acima de 50 → ENTÃO role só o excedente.'],
    ['rr-aband-contest', 'rrg', 'Abandonar ou pivotar', 'derivada', 'SE 1 jogador na mesma comp → já pesa. Saia, se ainda investiu pouco. SE 2+ → saia.'],
    ['rr-aband-c1', 'rrg', 'Abandonar ou pivotar', 'derivada', 'SE custo 1 não bateu até o 4-1 → pare de rolar e suba de nível com o board que tem.'],
    ['rr-piso-atencao', 'rrp', 'Todas · vida', 'derivada', 'Todas | 10, sempre | SE vida em Atenção (30–40) → saia do slow roll e role para estabilizar.'],

    // ---------- §4 Economia
    ['ec-q-sem-upgrade', 'ecq', '2-1', 'guia', 'No 2-1: sem upgrade, só pares, sem itens úteis.'],
    ['ec-q-eco', 'ecq', 'Aprimoramento', 'guia', 'Aprimoramento de economia. No 2-1, ele compromete com fast 8 ou fast 9.'],
    ['ec-2-1', 'ecr', '2-1', 'guia', 'Não monte board: venda, não compre, às vezes nem slame.'],
    ['ec-2-2', 'ecr', '2-2 a 2-7', 'guia', 'Juros desde cedo. Degraus 14, 20, 32. Não role. Venda pares que não entram.'],
    ['ec-2-4', 'ecr', '2-4', 'guia', 'Você escolhe antes (menos vida). Pegue o item da comp.'],
    ['ec-2-5', 'ecr', '2-5', 'guia', 'SE achou board forte → pode UPAR e quebrar a loss streak. Vá à Estratégia 1.'],
    ['ec-fim2', 'ecr', 'Fim do 2', 'derivada', 'SE 4+ cópias de custo 1 ou 2+ de custo 2, com itens BIS → Estratégia 2.'],
    ['ec-3-1', 'ecr', '3-1', 'guia', 'Comece a montar board com a maior economia possível.'],
    ['ec-3a', 'ecr', '3-7 / 4-1 · 3A', 'guia', 'SE economia alta + aprimoramento de economia → UPAR 8 e ROLAR antes de todos, até 20–30.'],
    ['ec-3b-entrada', 'ecr', '3-7 / 4-1 · 3B', 'guia', 'SE 80+ de vida no 4-1 + aprimoramento de economia → Fast 9.'],
    ['ec-4-x-3b', 'ecr', '4-1 a 4-7 (3B)', 'guia', 'UPAR sem rolar | Aceite perder o estágio 4.'],
    ['ec-5-1-3b', 'ecr', '5-1 (3B)', 'guia', 'Role pelos custo 5. Alvo: 1–2 custo 5 de 2★ (linha de frente, linha de trás, carry).'],
    ['ec-gat-parar-3b', 'ecg', 'Parar de rolar', 'derivada', '3B: achou os custo 5 de 2★ que a comp precisa, ou chegou a 10.'],
    ['ec-aband-80', 'ecg', 'Abandonar ou pivotar', 'guia', 'SE menos de 80 de vida no 4-1 → sem Fast 9. Vá de 3A ou Fast 8 padrão.'],
    ['ec-aband-cinco', 'ecg', 'Abandonar ou pivotar', 'derivada', 'SE outro jogador vai atrás dos mesmos custo 5 → Fast 8.'],
    ['ec-aband-vida', 'ecg', 'Abandonar ou pivotar', 'derivada', 'SE a vida cai rápido no caminho do 9 com board fraco → pare de subir e role no 8.'],
    ['ec-piso-50', 'ecp', 'Ouro', 'derivada', 'Ouro | Alvo: 50 no 3-1 (teto de juros) | Saída do Open Fort.'],
    ['ec-piso-vida80', 'ecp', 'Vida', 'guia', 'Vida | 80+ no 4-1 | Condição para o Fast 9.'],
    ['ec-piso-loss', 'ecp', 'Vida', 'guia', 'Vida | Loss streak só no estágio 2 | No estágio 2 a derrota é barata; depois, não.'],
    ['ec-erro-contest9', 'ece', 'Erro 3', 'guia', 'Ir de Fast 9 contestado.'],

    // ---------- §5 Leitura de jogo
    ['leit-obrigatoria', 'leit', 'Leitura obrigatória', 'guia', 'Leitura obrigatória em: 2-1, fim do estágio 2, 3-2, 3-7, 4-1 e 4-2.'],
    ['p1-valem', 'p1', 'Nota', 'derivada', 'Valem do estágio 3 em diante. No estágio 2, cada derrota tira pouca vida.'],
    ['p1-folga', 'p1', 'Folga', 'derivada', 'Folga | 80+ | Tempo de sobra. Guarde, atrase o spike. Fast 9 possível.'],
    ['p1-segura', 'p1', 'Segura', 'derivada', 'Segura | 41–79 | Ainda dá para trocar vida por ouro.'],
    ['p1-atencao', 'p1', 'Atenção', 'derivada', 'Atenção | 30–40 | Margem curta. Antecipe o spike que já estava planejado.'],
    ['p1-critica', 'p1', 'Crítica', 'derivada', 'Crítica | Abaixo de 30 | Agir já. Gaste para estabilizar.'],
    ['p2-abaixo', 'p2', 'Abaixo de 10', 'guia', 'Abaixo de 10 | Abaixo do piso | Só no fim, morrendo.'],
    ['p2-armadilha', 'p2', '10–13', 'guia', '10–13 | Armadilha | 10 vira 16, que ainda dá só +1. Chegue a 14 antes de parar.'],
    ['p2-lenta', 'p2', '14–19', 'guia', '14–19 | Rota lenta | 14 vira 20; 32 em 3 rodadas.'],
    ['p2-rapida', 'p2', '20–31', 'guia', '20–31 | Rota rápida | 19–20 vira 32 em 2 rodadas.'],
    ['p2-meio', 'p2', '32–49', 'guia', '32–49 | Piso do meio do jogo | 32 vira 40, depois ~50. Pare de rolar aqui.'],
    ['p2-maximo', 'p2', '50+', 'guia', '50+ | Juros no máximo | Só aqui o slow roll gasta o excedente.'],
    ['p3-streak', 'p3', 'Streak', 'guia', 'Streak de 2 a 4: +1. De 5: +2. De 6 ou mais: +3.'],
    ['p4-forte', 'p4', 'Forte', 'derivada', 'Forte | Em win streak ou vencendo a maioria.'],
    ['p4-medio', 'p4', 'Médio', 'derivada', 'Médio | Alterna vitórias e derrotas.'],
    ['p4-fraco', 'p4', 'Fraco', 'derivada', 'Fraco | Perde seguido sem querer.'],
    ['p5-2-f8', 'p5', '2 na comp · Fast 8', 'guia', 'Role antes dos outros (3-7 ou 4-1) ou prepare o plano B.'],
    ['p5-2-rr', 'p5', '2 na comp · Reroll e Fast 9', 'derivada', '2 | Role antes dos outros (3-7 ou 4-1) ou prepare o plano B. | Saia.'],
    ['p5-3-f8', 'p5', '3 ou mais · Fast 8', 'guia', 'Pivote, mantendo o fast 8.'],
    ['p5-1-rr', 'p5', '1 na comp · Reroll e Fast 9', 'guia', '1 | Segue. | Já pesa.'],
    ['p5-1-f8', 'p5', '1 na comp · Fast 8', 'guia', '1 | Segue. | Já pesa.'],
    ['p5-nota', 'p5', 'Nota', 'guia', 'Os vídeos são mais rígidos com reroll e fast 9: qualquer contest "vai ser um problema".'],
    ['m-folga-forte', 'p7', 'Folga x Forte', 'derivada', 'Siga a curva (ou a agressiva). Guarde juros. Fast 9 possível.'],
    ['m-folga-medio', 'p7', 'Folga x Médio', 'derivada', 'GUARDAR. Curva padrão. Aceite 1–2 derrotas por spike maior.'],
    ['m-folga-fraco', 'p7', 'Folga x Fraco', 'derivada', 'GUARDAR. Estágio 2: Open Fort. A vida compra tempo.'],
    ['m-segura-forte', 'p7', 'Segura x Forte', 'derivada', 'Siga a curva e mantenha a streak. Role só no gatilho da estratégia.'],
    ['m-segura-medio', 'p7', 'Segura x Médio', 'derivada', 'Curva padrão. Role só no gatilho.'],
    ['m-segura-fraco', 'p7', 'Segura x Fraco', 'derivada', 'Estágio 2: loss streak. Estágio 3+: board mínimo; role até 32 se falta 1 peça para o spike.'],
    ['m-atencao-forte', 'p7', 'Atenção x Forte', 'derivada', 'Segure o board. Upe para poupar vida se sobra ouro.'],
    ['m-atencao-medio', 'p7', 'Atenção x Médio', 'derivada', 'Antecipe o spike: role no 4-2, não no 4-5. Saia do slow roll.'],
    ['m-atencao-fraco', 'p7', 'Atenção x Fraco', 'derivada', 'ROLAR agora para estabilizar: até 32 no estágio 3, até 20 no 4. Sem Fast 9, sem Open Fort.'],
    ['m-critica-forte', 'p7', 'Crítica x Forte', 'derivada', 'Gaste para manter a streak. Piso 10.'],
    ['m-critica-medio', 'p7', 'Crítica x Médio', 'derivada', 'ROLAR até 10 pelo spike.'],
    ['m-critica-fraco', 'p7', 'Crítica x Fraco', 'derivada', 'ROLAR até 10. Abaixo de 10 só se for cair nesta rodada.'],
    ['pan-agir', 'pan', 'Agir', 'derivada', 'Agir: antecipar o spike que já estava no plano, porque a vida entrou em Atenção ou Crítica.'],
    ['pan-panico', 'pan', 'Pânico', 'derivada', 'Pânico: rolar ou upar fora do gatilho só porque perdeu vida. Proibido.'],

    // ---------- Guia do Jogo (data/guia-do-jogo.md)
    ['g-est1', 'gpart', 'Estágio 1', 'guia', 'Estágio 1: 4 rodadas de abertura, com PvE contra minions. Já dá para fazer juros (10 de ouro = +1).'],
    ['g-juros', 'gjuros', 'Juros', 'guia', 'Juros | +1 a cada 10 guardados, máximo +5 (com 50). Arredonda para baixo: 33 dá +3.'],
    ['g-rolar', 'ggloss', 'Rolar', 'guia', 'Rolar (roll) | Pagar 2 de ouro para trocar a loja.'],
    ['g-pre-level', 'ggloss', 'Pré-level', 'guia', 'Pré-level | Terminar a rodada 2 XP abaixo do próximo nível.'],

    // ---------- interpretacoes do painel (entrada manual)
    ['pn-xp-ouro', 'xp', 'XP', 'painel', 'Nota: subir do 7 ao 8 custa 48 de ouro (Set 13).'],
    ['pn-itens-uteis', 'qual', '"itens úteis"', 'painel', 'Upgrade, itens úteis e aprimoramento de força'],
    ['pn-bis', 'rrq', '"itens BIS"', 'painel', 'Itens | BIS | BIS ou slamáveis que poupem vida | —'],
    ['pn-janela-reroll', 'rrr', 'Janela do reroll', 'painel', '4-1 | Última rodada de rolar.'],
  ];

  const REGRAS = {};
  T.forEach(([id, sec, linha, origem, trecho]) => {
    const [secao, href, fonte] = SEC[sec];
    REGRAS[id] = { id, secao, linha, ref: secao + ' · ' + linha, href, fonte, origem, derivada: origem === 'derivada', trecho };
  });

  function regra(id) {
    const r = REGRAS[id];
    if (!r) throw new Error('regra desconhecida: ' + id);
    return Object.assign({}, r);
  }

  const api = { REGRAS, regra };
  root.TFTPainelRegras = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
