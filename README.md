# Comps TFT

Mini sistema pessoal de composições de Teamfight Tactics (set atual). HTML/CSS/JS puro, sem build e sem dependências.

## Como abrir

- Servidor local: `python -m http.server 8765` dentro desta pasta e abrir `http://127.0.0.1:8765/index.html`.
- Também funciona com duplo clique em `index.html` (testado via `file://`).

Recursos: lista de comps com traços ativos (calculados dos campeões e emblemas), campeões com custo e estrelas alvo, itens principais e alternativos (borda tracejada), flex, tabuleiro hex 4x7, busca por campeão/traço/item, editar/duplicar/excluir, exportar/importar JSON, atalhos com `?`. Cada comp tem busca própria de campeão e check "já peguei" por campeão, com contador e "Limpar checks desta comp" (direto, ativo só se a comp tem check). O botão "Limpar checks" no topo (tecla `L`) desmarca os checks de todas as comps, com confirmação, e fica desativado sem checks; só mexe nos picks, nunca nas comps. Dados ficam em `localStorage` (`tft-comps:v1`, com `seedVersao` e `excluidos`); os checks ficam em outra chave (`tft-comps:picks:v1`) e não entram no export.

Atalhos do app: `?` ajuda, `/` busca, `N` nova comp, `L` limpar todos os checks (pede confirmação), `Esc` fecha. `/`, `N` e `L` são ignorados enquanto digita ou com janela aberta.

## Dados

- Fonte: CommunityDragon `cdragon/tft/pt_br.json` (campeões, traços, itens e ícones). Ícones baixados para `assets/` (funciona offline).
- O set que o Elton chama de "Set 17" está em `sets["18"]` / mutator `TFTSet18` no CommunityDragon (itens `DA_*`). O "Set17" do CommunityDragon é outro set.
- As comps de exemplo vêm dos prints em `refs/` e ficam em `data/seed.js` (campo `fonte` indica o print). O botão "Restaurar comps originais" (em Atalhos) volta a esse estado.
- Comps novas do seed chegam para quem já tem dados salvos: `data/seed.js` define `TFT_SEED_VERSION` e a comp nova leva `desde: <versão>`. No carregamento, `mergeSeed` (`js/logic.js`) acrescenta só comps com `desde` maior que a `seedVersao` salva, cujo id não exista e não esteja em `excluidos` (ids de comps do seed que o usuário excluiu). Edições nunca são sobrescritas. Para publicar comp nova: adicionar ao seed com `desde: N` e subir `TFT_SEED_VERSION` para N. Para a comp nova aparecer como primeira da lista (inclusive para quem já tem dados salvos), acrescentar `topo: true`: `mergeSeed` coloca as comps novas com `topo` na frente das já salvas (as demais continuam no fim). Também deixar a entrada no começo do array do seed, para quem abre pela primeira vez e para "Restaurar comps originais". Para a comp nova entrar logo abaixo de outra comp do topo (ex.: `seed-18` abaixo de `seed-17`), acrescentar `abaixoDe: '<id>'`: se a comp alvo estiver na primeira posição da lista salva (ou entrar junto, na mesma atualização), a nova vai logo depois dela; se o usuário excluiu ou moveu a alvo, a nova cai para o topo. No array do seed, colocar a entrada logo depois da alvo.
- Posições novas do seed para comps que o usuário já tem: a comp do seed leva `posDesde: N` (e `p: [linha, coluna]` nos campeões de `main`). `mergeSeed` aplica só se `N` for maior que a `seedVersao` salva, a comp existir com o mesmo id, o campeão estiver no `main` dela e a comp não tiver nenhuma posição (se o usuário posicionou qualquer unidade, a comp inteira fica intacta). Comp excluída não volta. Para publicar: `posDesde: N` na comp e `TFT_SEED_VERSION` = N. Testes em `tests/logic.test.js` (`mergeSeed posicao`).

## Testes

- Lógica e seed (traços, busca, importação, merge de seed): `node --test tests/*.test.js`
- QA de navegador (Playwright, desktop 1440 e mobile 390): subir o servidor e rodar `node qa/qa.js`. Screenshots e `resultado.json` em `qa/`.
- QA da prévia do overlay (6 cenários, 1000 e 390 de largura): servidor na raiz e `node qa/overlay.js`. Prints em `qa/overlay-*.png`.

## Overlay Overwolf (experimental, fase 1)

Ideia: acompanhar a partida de TFT e sugerir as melhores comps do seed até a rodada 2-1, por via oficial (Overwolf GEP e/ou Riot Live Client Data API). Estado atual: pesquisa, motor de pontuação, scaffold e sondas. **A recomendação ao vivo NÃO está ligada, de propósito** (ver abaixo).

### Política da Riot: o ponto que decide tudo

A política de desenvolvedores da Riot para TFT ([developer.riotgames.com/docs/tft#game-policy](https://developer.riotgames.com/docs/tft#game-policy)) diz:

- Casos de uso **não aprovados**: "Apps that provide dynamic, real-time information" e "Apps that dictate player decisions".
- "Products may not provide information that was not available prior to the game... An app cannot make suggestions based on the player's current game state as that information is dynamic and not readily available prior to the game start."
- "Issues arise when the recommendations adjust in real time based on the player's actions in game and give direct prescriptions of what to do."
- "Having a static recommendation for a player pre-game is acceptable." Análise pré e pós-jogo é incentivada.
- Overlays em jogo não podem rastrear o tabuleiro do adversário ("Scouting"), nem mostrar win rate de Legends e de aprimoramentos baseados em Legends.

Outras fontes: [Overwolf: Riot Games compliance](https://dev.overwolf.com/ow-native/guides/game-compliance/riot-games) (sem win rate/colocação média de aprimoramento; app precisa de aprovação da Riot para publicar), [Riot: política geral](https://developer.riotgames.com/policies/general) ("Products cannot create an unfair advantage", "should not remove game decisions"), e o aviso do Overwolf sobre o feature `augments` do GEP: "DO NOT include augment data support in your apps ... Displaying this data can result in banning."

Conclusão: "usar a API oficial" é seguro no lado técnico (nada de memória, injeção ou input), mas o **produto** pedido (top 3 de comps recalculado ao vivo a partir do banco, tabuleiro, itens e ouro) cai exatamente no que a Riot lista como não aprovado. Por isso o scaffold só liga duas coisas ao jogo: a gravação filtrada (para análise pós-jogo) e um painel de status. A recomendação roda no navegador (prévia com estado simulado) e na análise pós-jogo (`tools/analisar-gravacao.js`). Ligar ao vivo é decisão do Elton, com o risco dele (ver "Riscos").

### Overwolf: bloqueio de conta

O Overwolf só deixa carregar app não publicado ("Load unpacked extension") em conta liberada como desenvolvedora; a liberação vem do processo de "app proposal" ([Setting up dev environment](https://dev.overwolf.com/ow-native/getting-started/onboarding-resources/setting-up-dev-environment), [Project roadmap, passo 5](https://dev.overwolf.com/ow-native/getting-started/project-roadmap)). A mesma doc diz que o Overwolf não aprova apps privados/de uso pessoal e que, desde 1º/11/2026, só aprova apps com monetização do Overwolf ([Monetization](https://dev.overwolf.com/ow-native/monetization/overview)). Ou seja: um app só para o Elton provavelmente não consegue a liberação. A sonda Live Client (Node) não depende disso.

### Campos do GEP para TFT (fonte: [doc oficial](https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/teamfight-tactics))

Status consultado em 04/11/2026 na API oficial de status (`https://game-events-status.overwolf.com/21570_prod.json`, também `28164` e `28162`): todos os features abaixo estão **verde** (state 1). O status atrasa até ~10 min.

| Feature | Chaves | Para que serve aqui |
|---|---|---|
| `me` | `gold`, `xp` (`{level,current_xp,xp_max}`), `health`, `rank`, `summoner_name` | ouro e nível |
| `match_info` | `round_type` (`{stage:"2-1",name,type}`), `battle_state`, `match_state`, `game_mode`, `item_select`, eventos `round_start/end`, `battle_start/end`, `match_start/end`, `picked_item` | rodada |
| `board` | `board_pieces` (`cell_N: {name, level, item_1..3}`), `opponent_board_pieces` | tabuleiro (a do adversário NÃO é usada) |
| `bench` | `bench_pieces` (mesmo formato), `item_bench` (itens de TODOS os jogadores; só o local é usado) | banco e componentes |
| `store` | `shop_pieces` (`slot_1..5`), evento `shop_visible` | loja |
| `live_client_data` | `active_player`, `all_players`, `events`, `game_data` | exemplos da doc são de LoL; conteúdo no TFT a confirmar |
| `game_flow`, `game_info`, `lobby_info`, `summoner_info`, `lcu_info`, `end_game` | fase, versão, queue, conta, credenciais locais, resumo | listados na doc; sem linha de status na API de status |
| `roster`, `carousel`, `match_stats` | jogadores, carrossel, tabuleiro de todos | não usados (rastrear outros jogadores é "scouting") |
| `augments` | `me`, `picked_augment` | **proibido usar**: o app nunca assina esse feature |

IDs de jogo: a doc manda usar `21570` (TFT) e `28162` (PBE) no status. A lista de jogos do Overwolf neste PC tem o TFT como `28164` (processo `TFTClient-Win64-Shipping.exe`) e `21570` aparece lá como outro jogo. Por isso o `manifest.json` lista os três em `game_events`; a sonda grava o motivo se o Overwolf recusar.

### Riot Live Client Data API

Doc: [developer.riotgames.com/docs/lol](https://developer.riotgames.com/docs/lol). Endpoints em `https://127.0.0.1:2999/liveclientdata/`: `allgamedata`, `activeplayer`, `activeplayername`, `activeplayerabilities`, `activeplayerrunes`, `playerlist`, `playerscores`, `playersummonerspells`, `playermainrunes`, `playeritems`, `eventdata`, `gamestats`. Certificado autoassinado. A página é toda escrita para League of Legends e **não diz se o TFT responde**. Confirmar com `sonda/liveclient.js`.

### O que o Elton precisa fazer

1. Decidir sobre a política da Riot (ver acima): manter pré/pós-jogo, ou assumir o risco de ligar ao vivo.
2. Rodar a sonda Live Client numa partida (`sonda/LEIA-ME.md`, parte 1). Não precisa de conta nem de instalação.
3. Para o GEP: a conta Overwolf precisa estar liberada como desenvolvedora. Testar em `Opções de desenvolvimento > Load unpacked extension`; se der "not whitelisted", o caminho é submeter um app proposal (e o Overwolf pode recusar app pessoal). Nada disso foi criado ou enviado.
4. Se algum dia publicar: aprovação da Riot (processo de app de terceiros) e texto de não afiliação no app.

### Estrutura

```
js/recommend.js        pontuação pura (campeões 60%, itens 25%, ouro/nível 15%); só até 2-1
js/gep-map.js          GEP -> estado, mapa de ids, filtros do que pode ser gravado
data/recipes.js        receitas de itens (CommunityDragon); gerar com tools/gen-recipes.js
overwolf-app/          manifest, background (gravação filtrada), overlay (clickthrough, sem foco), vendor/ (cópias; node overwolf-app/sync.js)
sonda/liveclient.js    sonda da Live Client API (Node, só leitura)
tools/analisar-gravacao.js   análise pós-jogo da gravação do GEP
tools/thumbs.py        miniaturas 40px e ícone do app
```

Pontuação: `recommend(estado, seed, catalog, recipes)`. Estado: `{stage, gold, level, board:[{c,s,i}], bench:[...], itens:[ids]}`. Campeão com 1 estrela vale 0,75; 2 cópias 0,9; 2 estrelas 1. Item pronto 1, montável com os componentes do banco 0,85, um componente 0,35 (cada componente é usado uma vez). Ouro e nível: campeões que faltam e não aparecem na loja do nível atual pesam contra, ouro cobre o custo restante. Em 2-1 (escolha de aprimoramento) devolve vazio e o overlay some; depois de 2-1 encerra. Nunca lê aprimoramentos. O score é um índice de encaixe, não probabilidade de vitória.

Overlay: `overwolf-app/overlay/overlay.html` aberto no navegador (servidor local) mostra a prévia com seletor de cenários simulados. No Overwolf a janela é `clickthrough`, `ignore_keyboard_events`, `grab_keyboard_focus:false`, `show_in_taskbar:false`, `topmost`. O TFT precisa estar em tela cheia sem bordas (o overlay do Overwolf não aparece em tela cheia exclusiva).

### Mapa de ids GEP -> catálogo (e onde não há certeza)

| Dado | Situação |
|---|---|
| Campeões (`DA_18_*`, `DA_Gromp18_AP` etc.) | **Certo**: os 21 ids de exemplo da doc existem no catálogo, idênticos |
| Componentes (`DA_Component_*`) | **Certo** para os 8 do catálogo mais `Spatula` e `FryingPan` (de `recipes.js`); aparecem assim em board, carrossel e `item_bench` |
| Itens completos em `item_1..3` | **Incerto**: a doc não traz exemplo. Assumido igual ao catálogo (`DA_Deathblade`); cai em busca sem caixa alta (marcado "aproximado") |
| `item_select` e `picked_item` | **Incerto**: a doc mostra o prefixo antigo `TFT_Item_*`. Convertido por alias para `DA_Component_*` (marcado "aproximado") |
| Consumíveis (`DA_Consumable_*`, `DA_Reforger`, `*_Selector`) | Ignorados de propósito |
| Radiante e artefato | Sem receita em `recipes.js`; não entram na pontuação de itens |
| Estrelas (`level`: `"1"` a `"3"`) e rodada (`"2-1"`) | Certo (doc) |
| `cell_N` | Número da casa guardado, mas orientação do hex desconhecida; posição não é usada |
| Nome do jogador local | `me.summoner_name`; formato com ou sem `#tag` não confirmado (comparação ignora a tag) |
| Envelopes | A doc mistura `value`, `data` e `info.<categoria>.<chave>` (na categoria `me` do feature `augments`, p.ex.). `acumular` trata os três |

`normalizar` devolve `desconhecidos` e `aproximados` para a sonda mostrar exatamente o que falta confirmar.

### Riscos e limitações

- Política da Riot (acima). Ligar ao vivo é uso fora do que a Riot aprova; pode haver ação sobre a conta. Decisão e risco do Elton.
- Não testado dentro do Overwolf: não foi instalado nem carregado nada. Os testes usam um `overwolf` falso. Pode haver ajustes na primeira carga (ids de jogo, janela do overlay, caminho de gravação).
- Overwolf: liberação de desenvolvedor incerta para app pessoal; publicação exige monetização Overwolf e aprovação da Riot.
- Heurística de pontuação sem validação com partidas reais; as odds de loja por nível (`CUSTO_MAX_POR_NIVEL`) são as padrão e podem mudar por set.
- Seed tem comps de fim de jogo (nível 8); no começo todas pontuam baixo e parecidas.
- Doc do GEP mistura exemplos de LoL e TFT; o conteúdo de `live_client_data` no TFT é desconhecido até a sonda rodar.

## Dúvidas de identificação (conferir)

1. Os prints 5 e 7 parecem a mesma estratégia (Vivaz + Sabugueiro). As comps "Vivaz com Sabugueiro" (print 5) e "Vivaz Sabugueiro Veigar" (print 7) têm as mesmas 8 unidades da descrição do Elton: Veigar, Alistar, Morgana, Hecarim, LeBlanc, Teemo, Kobuko (o ursinho) e Kog'Maw (a "abelha"). A descrição bate com o painel de traços do print 7 (Vivaz 3, Sabugueiro 3, Emanador 3, Enfeitiçador 2, Lutador 2). O overlay do print 7 mostra outra comp (Fera do Rift Rubrivira Dragão Ancião); entrou como comp extra.
2. Print 5 (in-game): só os itens do Morgana foram atribuídos; os demais itens visíveis não têm unidade segura.
3. "Devastador com Fera do Rift" (print 8) e "Eclipse" (print 12) foram deduzidos do painel de traços, não de uma lista de campeões. O 3º Lunar do Eclipse não foi identificado, por isso o app mostra Lunar 2 e não mostra o traço Eclipse nessa comp.
4. O print 12 também tem um overlay "Sabugueiro Draven Taric" (entrou como comp extra, 15 no total).
5. Itens foram identificados comparando pixels com os ícones oficiais. Menor confiança: Alune (Manopla Adornada), Zyra (Cajado do Vazio), Fiddlesticks (Capa de Fogo Solar), Kennen no print 13 (Limiar da Noite), Dragão Ancião (Gume do Infinito), Yunara. Item do Ivern no print 10 não foi identificado.
6. Print 4 chama o traço de "Primitiva"; no CommunityDragon o traço é "Primordial" (o emblema se chama "Emblema de Primitiva").
7. Print 10 (tactics.tools) mostra "9" unidades mas só 8 aparecem no tabuleiro.
8. Print 14 (comp "Defendente Congregação das Bruxas Rengar", seed-16, nível 8 em 5-3): o overlay "Sugerindo comp Sabugueiro Draven" foi ignorado. As 8 unidades foram deduzidas do tabuleiro e conferidas contra o painel de traços (Defendente 6, Rival 1, Enfeitiçador 2, Flora Fatalis 1, Congregação 2/3, Emanador 1, Feérico 1, Inferno 1: bate exato). Rengar leva o Emblema de Defendente. Há um segundo Rammus no fundo do tabuleiro, tratado como unidade adversária (não entra na comp). Sem posicionamento: a câmera inclinada não permite ler as casas do hex. Menor confiança: Morgana (silhueta escura de longe; poderia ser Elise), estrelas (lidas do ícone da barra de vida: losango = 1, 1 divisa dourada = 2, 2 divisas = 3; Rengar e Cassiopeia 3 estrelas é incomum para nível 8), e itens do Fiddlesticks (Efeito Vermelho, Gume do Infinito, Luvas do Ladrão) e da Cassiopeia (Elmo Adaptativo, Lança de Shojin). Itens do Rammus (Capa de Fogo Solar, Proteção Imutável) e do Rengar (Determinação Titânica, Lâmina de Guinsoo) vieram do match de pixels. Ornn, Lillia e Shen sem itens visíveis. Espada flutuante no chão não é item equipado.

9. Print 15 (comp "Enfeitiçador 6", seed-17, nível 8 em 6-2, combate): as 8 unidades foram deduzidas do painel de traços (busca exaustiva no catálogo; só 2 combinações batem, com 1 Emblema de Enfeitiçador: a escolhida tem Alistar, a outra trocaria Alistar por Gnar, cost 5). Overlay de chat/streamer ignorado. O app mostra Enfeitiçador 5 porque o Emblema de Enfeitiçador não está atribuído a ninguém (só poderia estar em Ornn, Rek'Sai ou Alistar/Gnar; o print não mostra). Estrelas: só Rek'Sai 3 (duas divisas na barra, unidade roxa de armadura). Não atribuídos por dúvida: a barra de itens da unidade tanque verde de chifres dourados (3 estrelas) tem Guarda-Real (DA_Crownguard), Placa Gargolítica e um item azul-roxo não identificado, mas essa unidade pode ser Ornn, Alistar ou Gnar. Os 3 ícones no canto direito (lâmpada, água, círculo) são efeitos, não itens. Cassiopeia (centro, 1 estrela) está no meio da arena; há 2 Cassiopeias do adversário no topo, então a identificação pelo modelo é só indício. Sem posicionamento (combate, sem grade).

10. Print 16 (comp "Lutador Florescer Adaptador", seed-18, nível 8, combate): as 8 unidades foram deduzidas do painel de traços (Cáustico 1, Lutador 4, Adaptador 3, Florescer 3, Colosso 2, Primitiva 2, Emanador 1, Invocador 1, Fera do Rift 1, "2+" ocultos) por busca exaustiva no catálogo: com 1 Emblema de Lutador há 4 combinações, que só diferem na 8ª unidade (Gnar, Rek'Sai, Kobuko ou Alistar). Escolhido o Gnar: é o único que deixa exatamente 2 traços inativos ocultos (Sabugueiro 1 e Vivaz 1, o "2+" do painel) e a coruja de folhas está no mesmo grupo das outras unidades. O Rek'Sai (roxo, borda inferior do print) foi tratado como unidade adversária, assim como um segundo lanceiro (outro Nidalee) no canto inferior esquerdo. Todas as barras de vida estão verdes, então o print não separa os times. Emblema de Lutador visto equipado na Master Yi (comparação de pixels, 0,86). Estrelas pelo ícone da barra: Yorick, Vi e Sett 1; Gnar e Nidalee 2; Kog'Maw, Master Yi e Krugue 3 (3 estrelas de custo 3 é incomum para nível 8). Itens por match de pixels: Krugue (Placa Gargolítica, Armadura de Warmog, Garra do Dragão), Sett (Bastão Desnecessariamente Grande, Semblante Espiritual, mas a versão Radiante empata), Nidalee (Mangual do Guerreiro, Manopla Adornada, Lâmina da Fúria de Guinsoo), Kog'Maw (Lâmina Mortal, Mercúrio, Efeito Vermelho), Master Yi (Canhão Fumegante, Emblema de Lutador; o 1º item é pequeno demais e ficou de fora). Sem posicionamento (combate, sem grade).

## Posicionamento no tabuleiro (avaliação dos prints, 02/11/2026)

Já tinham posição: Vivaz (print 1), Solar Lunar Lillia (9), Fera do Rift Dragão Ancião Draven (10), Florescer Invocador (11). Nenhuma comp ganhou posição nova: os prints in-game não permitem ler casas com confiança.

| Print | Comp | Motivo |
|---|---|---|
| 5 | Vivaz com Sabugueiro | Combate em andamento, unidades fora do centro das casas, sem grade visível e dois ursos (um deles é adversário). Só um hex colorido fica visível. |
| 7 | Vivaz Sabugueiro Veigar, Rubrivira | Poucas unidades próprias visíveis, em movimento. |
| 8 | Devastador com Fera do Rift | Unidades aglomeradas, câmera corta o tabuleiro, hexes azuis são efeito de traço. |
| 12 | Eclipse, Sabugueiro Draven Taric | Tabuleiro próprio vazio; unidades visíveis são do adversário. |
| 13 | Sabugueiro Draven | Combate no centro da arena, sem grade. |
| 14 | Defendente Rengar | Câmera inclinada (ver dúvida 8). |
| 15 | Enfeitiçador 6 | Combate, câmera inclinada, unidades fora das casas (ver dúvida 9). |
| 16 | Lutador Florescer Adaptador | Combate, sem grade (ver dúvida 10). |
| 2, 3, 4, 6 | Prints de lista (6 não gerou comp) | Sem posição no print. |

Quando houver print de board com grade legível (como tactics.tools), usar `posDesde` (ver Dados).

## Segurança (checklist de 20 itens, app estático local)

Sem backend, sem login, sem banco. n.a. com justificativa: 1-8, 10-12, 14 (server-side), 16, 17, 19, 20 (sem servidor, segredos, auth ou dependências). Aplicados: 13/14 (todo texto vai por `textContent`; importação passa por `sanitizeImport`, que valida ids, limites e tamanho), 15 (erros genéricos ao usuário), 18 (CSP e headers só se publicar com servidor; a meta CSP foi retirada porque o antivírus injeta script e quebra a política).

`overwolf-app/` e `sonda/` (sem backend, sem secrets, sem rede externa): a sonda Live Client só fala com `127.0.0.1` (recusa outros hosts; ignora o certificado autoassinado só em loopback); a gravação do GEP usa allowlist de chaves, remove qualquer chave com "augment" e nunca grava tokens (`lcu_info`), jogadores nem tabuleiro de adversários; HTML sem script inline nem CDN; texto do overlay por `textContent`; permissões mínimas (`GameInfo`, `FileSystem`); `npm audit` n.a. (zero dependências).
