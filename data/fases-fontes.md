# Fases das comps: fontes (início e meio)

Consulta feita em 06/11/2026, patch 18.6 (Set 18 oficial "Selvas Encantadas / Enchanted Wilds"; o app e o catálogo dizem Set 18 desde a v7). Comps do vídeo (seed v7) consultadas em 07/11/2026.

## Modelo de dados

`comp.fases = { inicio: [ids], meio: [ids], origem, ref, url? }`. O `main` continua sendo o board final (fim).

| Campo | Regra |
|---|---|
| `inicio` | 3-5 campeões de custo até 3. Estágio 2, nível 3-5 (as fontes usam 4 unidades, "nível 4 em 2-1") |
| `meio` | 6-7 campeões de custo até 4. Estágio 3-4, nível 6-7 (as fontes usam 6 unidades, "nível 6 em 3-2") |
| `origem` | `fonte` (veio de guia publicado), `derivado` (calculado do catálogo), `manual` (reservado para edição futura) |
| `ref` | Texto curto da origem. Termina com "(variante)" quando o board do Elton difere da comp da fonte (Jaccard abaixo de 0,70) |
| `url` | Só quando `origem = fonte`. Só https |
| `fasesDesde` (na comp do seed) | Versão do seed que entrega as fases. `mergeSeed` aplica em comp já salva só se ela não tiver `fases`, o id existir e `fasesDesde` for maior que a `seedVersao` salva. Edição do usuário nunca é sobrescrita. `TFT_SEED_VERSION = 6` |

Função pura para a UI: `TFTLogic.phaseBoards(comp, catalog)` devolve `{ origem, ref, url?, fases: [{ key: 'inicio'|'meio'|'fim', label, hint, units: [{ c, n, cost, img }] }] }` ou `null` sem fases.

## Fonte usada

**Mobalytics, guias de comps do Set 18** (`mobalytics.gg/tft/comps-guide/<slug>`): cada guia tem board final, `early` (4 unidades), `mid` (6 unidades) e dicas de jogo, feito por jogadores Challenger. As 42 comps listadas estavam no patch 18.6 (41 atualizadas em 04/11/2026, 1 em 06/11/2026). Os ids dos campeões foram convertidos para o catálogo (`DA_*`) pelo nome. Lux (Lunar) não aparece em início/meio.

Casamento com as comps do app: coeficiente de Jaccard entre o `main` do app e o board final do guia. Aceito quando a comp é da mesma família (mesmo traço principal) e Jaccard >= 0,55. Abaixo de 0,70 vira "(variante)". Sem família igual, vira `derivado`.

## Fontes tentadas sem dado de início/meio

| Site | Resultado |
|---|---|
| MetaTFT | Página sem conteúdo no HTML (app JS); API pública sem resposta |
| tactics.tools | HTML traz só os 5 clusters de board final do patch 18.6 (sem início/meio). Serviu para confirmar que as famílias Riftbeast (Rubrivira/Krugue) e Elderwood (Ezreal/Draven) existem no patch |
| blitz.gg/tft | Rota de comps 404; tier list só de campeões |
| TFTAcademy, Seemeta | Página sem conteúdo (JS) / 403 |
| MetaBot | Só board final e estatísticas (atualizado em 27/10) |
| Lolchess | 404 |

Ou seja, início/meio têm uma única fonte (Mobalytics). Não há segunda fonte independente.

## Resultado por comp

| Seed | Comp do app | Origem | Comp da fonte | Jaccard | Início | Meio |
|---|---|---|---|---|---|---|
| seed-17 | Enfeitiçador 6 | fonte | [Kill, Stack, Repeat](https://mobalytics.gg/tft/comps-guide/veigar-reroll-3GRav9EJC9f18s1Fsh4A1709SmK) | 0.88 | Alistar, LeBlanc, Veigar, Ornn | Ornn, Fiddlesticks, Alistar, Cassiopeia, LeBlanc, Veigar |
| seed-18 | Lutador Florescer Adaptador | fonte | [Adapt or Die](https://mobalytics.gg/tft/comps-guide/adaptor-reroll-3HRVQSudB7SJTckVeLxU4ICvPDg) | 0.78 | Rakan, Yorick, Master Yi, Karma | Krugue, Rengar, Master Yi, Karma, Yorick, Vi |
| seed-19 | Vanguarda Congregação das Bruxas Devastador | fonte | [Dark Ritual](https://mobalytics.gg/tft/comps-guide/dark-ritual-3KZ1gNvZRg3iV7qqfua7YzBR5IM) (variante) | 0.55 | Elise, Rakan, Camille, Caitlyn | Hecarim, Diana, Camille, Caitlyn, Cassiopeia, Elise |
| seed-01 | Vivaz | fonte | [Spikes and Soldiers](https://mobalytics.gg/tft/comps-guide/spikes-and-soldiers-3Jpro0TlxLOqmqzej8jZ7IEBApI) | 0.88 | Rakan, Yunara, Karma, Yorick | Fiddlesticks, Teemo, Azir, Yunara, Veigar, Rammus |
| seed-02 | Vanguarda Congregação das Bruxas Morgana | fonte | [Dark Ritual](https://mobalytics.gg/tft/comps-guide/dark-ritual-3KZ1gNvZRg3iV7qqfua7YzBR5IM) | 0.75 | Elise, Rakan, Camille, Caitlyn | Hecarim, Diana, Camille, Caitlyn, Cassiopeia, Elise |
| seed-03 | Solar Fumegante Reroll | fonte | [The Eclipse](https://mobalytics.gg/tft/comps-guide/the-eclipse-3KMQCX7doCgzY4en0qzPAG3j2pp) (variante) | 0.67 | Leona, Shen, Varus, Kayle | Shen, Varus, Kayle, Aronguejo, Leona, Sejuani |
| seed-04 | Lunar Primitiva Aphelios | fonte | [Moonlit Hunt](https://mobalytics.gg/tft/comps-guide/moonlit-hunt-3JBJHbLQQVkdfm6vFl6EPiJcEKw) | 0.89 | Xayah, Rakan, Yorick, Varus | Varus, Xayah, Ornn, Rakan, Hecarim, Shen |
| seed-05 | Sabugueiro Carrasco Reroll | fonte | [Moonlight Mantis](https://mobalytics.gg/tft/comps-guide/moonlight-mantis-3J97BdQFVwSHCHZqKyqpNU6Jr19) | 0.78 | Kha'Zix, Ornn, LeBlanc, Alistar | Hecarim, Diana, Fiddlesticks, Ornn, Kha'Zix, LeBlanc |
| seed-06 | Vivaz com Sabugueiro | derivado | - | - | Veigar, Kobuko, Teemo, Alistar | Veigar, Kobuko, Teemo, Alistar, LeBlanc, Hecarim |
| seed-07 | Vivaz Sabugueiro Veigar | derivado | - | - | Veigar, Kobuko, Teemo, Alistar | Veigar, Kobuko, Teemo, Alistar, LeBlanc, Hecarim |
| seed-08 | Devastador com Fera do Rift | derivado | - | - | Akali, Camille, Lobo Trevoguari, Warwick | Akali, Camille, Lobo Trevoguari, Warwick, Diana, Rubrivira |
| seed-09 | Solar Lunar Lillia | fonte | [The Eclipse](https://mobalytics.gg/tft/comps-guide/the-eclipse-3KMQCX7doCgzY4en0qzPAG3j2pp) (variante) | 0.55 | Leona, Shen, Varus, Kayle | Shen, Varus, Kayle, Aronguejo, Leona, Sejuani |
| seed-10 | Fera do Rift Dragão Ancião Draven | fonte | [AD Exodia](https://mobalytics.gg/tft/comps-guide/ad-fast-9-3HIz3Cx7oNI4RGtlcnOVu0H4xFh) | 1.00 | Leona, Shen, Xayah, Varus | Xayah, Varus, Alistar, Ornn, Shen, Akali |
| seed-11 | Florescer Invocador | fonte | [Three Star Emperor](https://mobalytics.gg/tft/comps-guide/three-star-emperor-3JleFSihZmRJFqsONvCdwERjiax) | 1.00 | Kobuko, Azir, Yunara, Rek'Sai | Kha'Zix, Yorick, Rek'Sai, Azir, Yunara, Vi |
| seed-12 | Eclipse | fonte | [The Eclipse](https://mobalytics.gg/tft/comps-guide/the-eclipse-3KMQCX7doCgzY4en0qzPAG3j2pp) | 0.89 | Leona, Shen, Varus, Kayle | Shen, Varus, Kayle, Aronguejo, Leona, Sejuani |
| seed-13 | Sabugueiro Draven | fonte | [The Final Forest](https://mobalytics.gg/tft/comps-guide/elderwood-cap-3HBMcPmR81fWMyuppwi8smQJ37O) | 0.89 | Alistar, Ornn, Varus, Xayah | Varus, Xayah, Alistar, Ornn, Shen, Akali |
| seed-14 | Fera do Rift Rubrivira Dragão Ancião | fonte | [Riftbeast Ascension](https://mobalytics.gg/tft/comps-guide/riftbeasts-3GPdjNA6ylpo7iCTllcNRj1b8fs) | 0.75 | Rakan, Lobo Trevoguari, Cascalho, Aronguejo | Diana, Aronguejo, Lobo Trevoguari, Rubrivirim, Cascalho, Krugue |
| seed-15 | Sabugueiro Draven Taric | fonte | [The Final Forest](https://mobalytics.gg/tft/comps-guide/elderwood-cap-3HBMcPmR81fWMyuppwi8smQJ37O) | 1.00 | Alistar, Ornn, Varus, Xayah | Varus, Xayah, Alistar, Ornn, Shen, Akali |
| seed-16 | Defendente Congregação das Bruxas Rengar | fonte | [Defenders of the DoT](https://mobalytics.gg/tft/comps-guide/defenders-of-the-dot-3IQjiZdfHWypkfHdKpdhuYQindM) (variante) | 0.60 | Ornn, Xayah, LeBlanc, Leona | Cassiopeia, Shen, Ornn, Fiddlesticks, Rammus, Leona |

Total: 16 por fonte (4 como variante: seed-03, 09, 16, 19) e 3 derivadas (seed-06, 07, 08).

## Derivadas (sem comp equivalente na fonte)

Regra: início = campeões de custo até 2 do board final que mais compartilham os traços ativos; meio = início + os de custo até 3 que completam o breakpoint dos traços ativos, e o de custo 4 só quando é necessário para o traço principal. Conferido à mão pelos breakpoints do catálogo:

- seed-06 e seed-07 (Vivaz + Sabugueiro, mesmo board): início Veigar, Kobuko, Teemo = Vivaz 3 com unidades de custo 1-2; o meio acrescenta Alistar, LeBlanc, Hecarim = Sabugueiro 3. Emanador 3 (Morgana, Kog'Maw) fica para depois por custo.
- seed-08 (Devastador 6): início Akali, Camille, Lobo Trevoguari, Warwick = Devastador 4; o meio acrescenta Diana e Rubrivira (único custo 4) = Devastador 6. A comp "Elise Unleashed" da Mobalytics é parecida (Jaccard 0,55), mas usa Elise e Congregação; não foi usada como fonte.

## Dicas da fonte (resumo em PT-BR)

Tradução livre dos textos de cada guia. Todos dizem "nível 4 em 2-1" e "nível 6 em 3-2", salvo onde indicado.

| Comp (Mobalytics) | Início | Meio |
|---|---|---|
| Kill, Stack, Repeat | Jogar de Veigar e Ornn para acumular pilhas. Não subir de nível, para ter odds melhores de custo 1 ao rolar em 3-1. Priorizar itens de Veigar/Ornn no carrossel | A partir de 3-1, rolar por Veigar, Alistar, LeBlanc, Rek'Sai e Ornn (Veigar e Ornn são os mais importantes). Pode rolar até 30 de ouro perto de 3 estrelas. Depois de pegar Veigar e Ornn, continuar rolando no nível 6 |
| Adapt or Die | Qualquer abertura forte, de preferência Rengar ou Master Yi. Nível 4 em 2-1 e tentar sequência de vitórias | No nível 7, rolar por Master Yi, Rengar, Vi e Krugue 3 estrelas. Kog'Maw serve até achar a Nidalee ou se precisar de Sunder e Shred |
| Dark Ritual | Jogar de Congregação das Bruxas. Com abertura forte, buscar vitórias. Montar itens da Elise primeiro | Adicionar mais Congregação e Vanguarda. Rolar por Elise e Cassiopeia 3 estrelas. Fechar o estágio com 250+ de ouro. Depois subir de nível e jogar Morgana dupla ou Vanguarda 6 |
| Spikes and Soldiers | Jogar de Florescer (fogos-fátuos) ou Espinhos Negros com Azir cedo. Sem unidades/itens prontos, perder de propósito e focar nos itens do Azir | Adicionar as unidades do board final. Colocar o "Rider" no Rammus (termo original). No nível 7, rolar por Rammus, Teemo, Azir e Fiddlesticks 3 estrelas |
| The Eclipse | Jogar com as unidades principais no estágio 2. Pode subir em 2-1 com unidades e itens prontos. Priorizar itens da Kayle no carrossel | Rolar por Kayle, Sejuani, Leona, Shen e Varus. Com pares no banco, cavar até 30. Depois das 3 estrelas, subir de nível para Lunar 3 e ativar o Eclipse |
| Moonlit Hunt | Qualquer abertura que segure componentes de DdA. Sem unidades melhoradas nem itens montáveis, perder sequência de propósito | Jogar o board mais forte (Sabugueiro serve para o meio). Quem não joga as unidades baratas do final deve guardá-las no banco acima de 50 de ouro |
| Moonlight Mantis | Kha'Zix cedo para ganhar pilhas. Evoluir o Devastador primeiro | Adicionar unidades do board final. Chegar ao nível 7 até o fim do estágio 3 e rolar por Kha'Zix, Diana e Hecarim |
| AD Exodia | Abertura forte. Fumegante, Florescer ou Caçador usam bem os itens de DdA | Jogar o board mais forte. Inferno ajuda a chegar nas unidades caras. Olhar a loja por upgrades para manter sequência e salvar vida |
| Three Star Emperor | Florescer/Kha'Zix ou Azir cedo. Abertura fraca: perder sequência e focar em itens do Azir | Adicionar unidades do final. Não colocar o Kha'Zix no hex de Espinhos Negros até ter abates para virar Carrasco. No nível 7, rolar por Azir, Vi, Yunara e Kha'Zix |
| The Final Forest | Sabugueiro, Caçador ou Florescer com itens de DdA. Pode subir para o nível 5 antes ou depois do carrossel para manter a sequência | Jogar o board mais forte e acrescentar Inferno. Com pares no banco, rolar um pouco. Se perder muita vida, rolar no nível 8 para estabilizar |
| Riftbeast Ascension | Fera do Rift, de preferência Lobo Trevoguari para usar itens de DdA. Dar a Marca de Alfa ao Lobo | Ativar Fera do Rift 5 e depois 7. Guardar cópias de Krugue (o 3 estrelas mais importante). Com o Rubrivira, itemizar e dar a Marca de Alfa a ele |
| Defenders of the DoT | Abertura forte de PdH com Defendente. Itemizar Ornn (está no final; dá para mirar cashout de artefato). Com abertura de Congregação, pode jogar | Ter frente de 4 Defendentes já no estágio 3. No nível 7, rolar por Cassiopeia, Rammus e Fiddlesticks 3 estrelas. Defendente 6 o quanto antes |

## Comps do vídeo do Vladimin (seed v7, consulta em 07/11/2026)

Mesma regra de casamento (Jaccard do board e mesma família; abaixo de 0,70 vira "variante"; sem guia equivalente vira `derivado`). Lista de guias lida da página `mobalytics.gg/tft/team-comps` (42 comps, patch 18.6) com Chromium headless (curl e WebFetch levam 403).

| Seed | Comp do app | Origem | Comp da fonte | Jaccard | Início | Meio |
|---|---|---|---|---|---|---|
| seed-20 | Solar Yunara Karma | fonte | [Solar Yunara](https://mobalytics.gg/tft/comps-guide/solar-yunara-3JKiktTzy9h1I1MpQ5rqtmtdv9l) | 1.00 | Yunara, Yorick, Karma, Rakan | Sejuani, Yunara, Azir, LeBlanc, Karma, Yorick |
| seed-21 | Emanador Ahri | derivado | - (Weave Got This, Wispful Thinking e Mana Go Brrr são outras comps) | - | Cascalho, Karma, Krugue | Cascalho, Karma, Krugue, Azuporã, Morgana, Sett |
| seed-22 | Sabugueiro Soraka | derivado | - (Wrath of the Woods tem Jaccard 0,50) | - | Ornn, Alistar, LeBlanc, Xayah | Ornn, Alistar, LeBlanc, Xayah, Hecarim, Fiddlesticks |
| seed-23 | Sabugueiro Aphelios | fonte | [Wrath of the Woods](https://mobalytics.gg/tft/comps-guide/elderwood-3GPSrl1mdvWbwjkesuBNjDFFKvx) | 1.00 | Xayah, Alistar, LeBlanc, Ornn | Xayah, Hecarim, Alistar, LeBlanc, Ornn, Rakan |
| seed-24 | Alune AP Fast 9 | fonte | [AP Exodia](https://mobalytics.gg/tft/comps-guide/fast-9-3GPZwhL0OfLE8Wv4bDvZMi1lUUR) (variante) | 0.58 | LeBlanc, Fiddlesticks, Alistar, Ornn | LeBlanc, Cassiopeia, Diana, Fiddlesticks, Hecarim, Ornn |

Derivadas: seed-21 usa os custos baixos do board que compartilham traços (Karma de Florescer/Enfeitiçador, Cascalho de Fera do Rift/Emanador, Krugue de Fera do Rift/Lutador); o meio acrescenta Azuporã e Morgana (Emanador 3, Fera do Rift 3) e Sett (Florescer 2, Lutador 2), os 4 custos do traço principal. seed-22 usa os Sabugueiros de custo até 2 mais Xayah; o meio acrescenta Hecarim (Sabugueiro 5) e Fiddlesticks (Defendente 2 com Ornn).

Dicas do vídeo (traduzidas e resumidas) ficam em `comp.dicas` no seed, com link do vídeo no minuto (`https://youtu.be/shtFyRruAHM?t=<s>`).
