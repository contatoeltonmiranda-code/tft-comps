# Comps TFT

Mini sistema pessoal de composições de Teamfight Tactics (Set 18, "Selvas Encantadas"). HTML/CSS/JS puro, sem build e sem dependências.

## Páginas

Navegação no topo, igual nas sete páginas (mesmo `css/style.css`; no mobile os links quebram em 2 linhas, nenhum fica escondido): **Comps** (`index.html`) | **Plano** (`plano.html`) | **Painel** (`painel.html`) | **Pós-jogo** (`posjogo.html`) | **Guia do Jogo** (`guia.html`) | **Estratégia padrão** (`estrategia.html`) | **Notícias** (`noticias.html`). Nas páginas geradas o menu vem de `nav()` em `tools/gen-guia.js`; em `index.html`, `plano.html`, `painel.html`, `posjogo.html` e `noticias.html` é HTML à mão (o teste compara as sete). No mobile (até 420 px) os 5 links cabem sem rolar (fonte 13,5 px; 13 px até 370 px).

- Lista de comps em 2 colunas a partir de 1100 px de largura (2 comps lado a lado); abaixo disso, 1 coluna. Cada comp mostra Início / Meio / Fim (ver Fases em Dados), as dicas (quando houver) e o tabuleiro.
- `guia.html`: Guia do Jogo (TFT Set 18, 15 seções: glossário, economia, nível, rolagem, estilos, scout, checklist, perda de vida, posicionamento e notas sobre as fontes). O texto é o oficial da Clara (`3. copywriter/Projetos/tft-guia-do-jogo/GUIA-DO-JOGO.md`), copiado sem alteração para `data/guia-do-jogo.md`. **A página é gerada, não editada à mão**: `node tools/gen-guia.js` lê cada `.md` de `data/` + `tools/pagina-template.html` e escreve `guia.html` e `estrategia.html` (uma entrada em `PAGES` por página: meta tags, rótulos de busca e opções de renderização; página nova de texto = entrada nova + `.md`) (HTML estático, sem CDN nem parser de Markdown no navegador). Para atualizar o guia: copiar o `.md` novo para `data/` e rodar o gerador (o teste falha se `guia.html` ficar fora de sincronia). Recursos: índice lateral fixo no desktop (a partir de 1000 px) com scrollspy e índice recolhível no topo no mobile; tabelas com rolagem horizontal só dentro da tabela; notas de divergência em blocos discretos e marcações "(Google, não confirmado)" e "(Set 18)" destacadas; busca no guia (`js/guia.js`, ignora acento e caixa, destaca com `<mark>`, esconde seções sem resultado, Enter/Shift+Enter navegam, Esc limpa). Página `noindex` como as demais (ferramenta pessoal): sitemap, `llms.txt` e Search Console n.a.
- `estrategia.html`: Estratégia padrão (TFT Set 18, patch 18.6, 6 seções: qual estratégia jogar, Fast 8, Reroll e slow roll, Fast 9, leitura de jogo padronizada com matriz vida x board, resumo de bolso). Texto oficial da Clara (`3. copywriter/Projetos/tft-guia-do-jogo/ESTRATEGIA-PADRAO.md`) copiado sem alteração para `data/estrategia-padrao.md` e gerado pelo mesmo `tools/gen-guia.js`, com o mesmo layout e a mesma busca do guia (`js/guia.js`). Extras só desta página, todos em estilo (o texto não muda): botões "Checklist rápido" e "Resumo de bolso" no topo (se a busca escondeu o alvo, ela é limpa antes de ir); checklist de 30 segundos e resumo de bolso em caixa dourada com itens numerados; ações UPAR / FICAR / ROLAR / GUARDAR / PARAR como badges coloridos nas tabelas (`.act-*`; cor + palavra, nunca só cor); `*(regra derivada do guia)*` em itálico apagado (`.rd`), `(divergência)` laranja (`.dv`), `(Set 18)` e `(Google, não confirmado)` como no guia; subtítulos repetidos (Gatilhos, Pisos...) com id prefixado pela estratégia; no mobile (até 640 px) as 13 tabelas viram cartões com o rótulo da coluna em cada linha (`.tbl.stack` + `data-label`), sem rolagem lateral. Página `noindex`: sitemap, `llms.txt` e Search Console n.a.
- `painel.html`: **Painel de decisão manual** para usar durante a partida (ver "Painel de decisão" abaixo). Você digita o estado; o app não lê o jogo.
- `plano.html` e `posjogo.html`: plano pré-jogo estático e análise pós-jogo automática (ver "Antes e depois da partida" abaixo).
- `noticias.html`: resumo do meta no topo, filtros por tipo e por patch, cards curtos com ícone do campeão/traço/item (quando há id no catálogo), link da fonte e data da última atualização. Dados em `data/noticias.js`, lógica de filtro em `TFTLogic` (`newsTypes`, `newsPatches`, `filterNews`, `newsIcon`), página em `js/noticias.js`.

## Como abrir

- Servidor local: `python -m http.server 8765` dentro desta pasta e abrir `http://127.0.0.1:8765/index.html`.
- Também funciona com duplo clique em `index.html` (testado via `file://`).

Recursos: lista de comps com traços ativos (calculados dos campeões e emblemas), campeões com custo e estrelas alvo, itens principais e alternativos (borda tracejada), flex, tabuleiro hex 4x7, busca por campeão/traço/item, editar/duplicar/excluir, exportar/importar JSON, atalhos com `?`. Cada comp tem busca própria de campeão e check "já peguei" por campeão, com contador e "Limpar checks desta comp" (direto, ativo só se a comp tem check). O botão "Limpar checks" no topo (tecla `L`) desmarca os checks de todas as comps, com confirmação, e fica desativado sem checks; só mexe nos picks, nunca nas comps. Dados ficam em `localStorage` (`tft-comps:v1`, com `seedVersao` e `excluidos`); os checks ficam em outra chave (`tft-comps:picks:v1`) e não entram no export.

Atalhos do app: `?` ajuda, `/` busca, `N` nova comp, `L` limpar todos os checks (pede confirmação), `Esc` fecha. `/`, `N` e `L` são ignorados enquanto digita ou com janela aberta.

## Dados

- Fonte: CommunityDragon `cdragon/tft/pt_br.json` (campeões, traços, itens e ícones). Ícones baixados para `assets/` (funciona offline).
- O set é o **Set 18 "Selvas Encantadas"** (nome oficial da Riot), que está em `sets["18"]` / mutator `TFTSet18` no CommunityDragon (itens `DA_*`). O Elton às vezes o chamava de "Set 17" (o tactics.tools mostra "SET 18" e "SET17" lado a lado); o app e o catálogo agora dizem Set 18. O "Set17" do CommunityDragon é outro set.
- As comps de exemplo vêm dos prints em `refs/` e ficam em `data/seed.js` (campo `fonte` indica o print). O botão "Restaurar comps originais" (em Atalhos) volta a esse estado.
- Comps novas do seed chegam para quem já tem dados salvos: `data/seed.js` define `TFT_SEED_VERSION` e a comp nova leva `desde: <versão>`. No carregamento, `mergeSeed` (`js/logic.js`) acrescenta só comps com `desde` maior que a `seedVersao` salva, cujo id não exista e não esteja em `excluidos` (ids de comps do seed que o usuário excluiu). Edições nunca são sobrescritas. Para publicar comp nova: adicionar ao seed com `desde: N` e subir `TFT_SEED_VERSION` para N. Para a comp nova aparecer como primeira da lista (inclusive para quem já tem dados salvos), acrescentar `topo: true`: `mergeSeed` coloca as comps novas com `topo` na frente das já salvas (as demais continuam no fim). Também deixar a entrada no começo do array do seed, para quem abre pela primeira vez e para "Restaurar comps originais". Para a comp nova entrar logo abaixo de outra comp do topo (ex.: `seed-18` abaixo de `seed-17`), acrescentar `abaixoDe: '<id>'`: se a comp alvo estiver dentro do bloco do topo da lista salva (as primeiras posições ocupadas só por comps do seed com `topo`, ou entrar junto, na mesma atualização), a nova vai logo depois dela; se o usuário excluiu a alvo ou a moveu para fora desse bloco, a nova cai para o topo. Exemplo: `seed-19` abaixo de `seed-18`, que está em 2º. No array do seed, colocar a entrada logo depois da alvo.
- Posições novas do seed para comps que o usuário já tem: a comp do seed leva `posDesde: N` (e `p: [linha, coluna]` nos campeões de `main`). `mergeSeed` aplica só se `N` for maior que a `seedVersao` salva, a comp existir com o mesmo id, o campeão estiver no `main` dela e a comp não tiver nenhuma posição (se o usuário posicionou qualquer unidade, a comp inteira fica intacta). Comp excluída não volta. Para publicar: `posDesde: N` na comp e `TFT_SEED_VERSION` = N. Testes em `tests/logic.test.js` (`mergeSeed posicao`).
- Fases da comp (início e meio): cada comp pode ter `fases: { inicio: [ids], meio: [ids], origem: 'fonte'|'derivado'|'manual', ref, url? }`; o `main` continua sendo o board final. Início = estágio 2, nível 3-5 (3-5 campeões); meio = estágio 3-4, nível 6-7 (6-7 campeões). `origem: 'fonte'` veio de guia publicado (Mobalytics, patch 18.6); `derivado` foi calculado do catálogo. Fontes e critérios por comp em `data/fases-fontes.md`. Para publicar: `fases` + `fasesDesde: N` na comp do seed e `TFT_SEED_VERSION` = N. `mergeSeed` copia as fases só para comp salva sem `fases` (id existente, `fasesDesde` maior que a `seedVersao` salva) e devolve `fasesAplicadas`; edição nunca é sobrescrita. `sanitizeImport` mantém `fases` (ids do catálogo, sem repetidos, URL só https), então export/import e duplicar preservam. `TFTLogic.phaseBoards(comp, catalog)` devolve início, meio e fim prontos para renderizar: a lista mostra 3 linhas com rótulo (Início e Meio como miniaturas de 36 px com custo; Fim = o board final detalhado, com busca e checks "já peguei") e uma linha discreta com a origem (`fonte` com link, `derivado` ou `manual`). Marcar um campeão no Fim acende o mesmo campeão nas miniaturas das fases. Testes em `tests/fases.test.js`.
- Dicas da comp: `comp.dicas = { linhas: [até 8 textos de até 240 caracteres], ref?, url? }` (`url` só https). A lista mostra "Dicas" num bloco recolhível (o estado aberto sobrevive a buscas) com link da fonte. No seed: `dicas` + `dicasDesde: N` e `TFT_SEED_VERSION` = N; `mergeSeed` copia só para comp salva sem `dicas` (devolve `dicasAplicadas`); edição nunca é sobrescrita. `sanitizeImport` mantém `dicas`, então export/import e duplicar preservam. Testes em `tests/v7.test.js`.
- Notícias: `data/noticias.js` define `window.TFT_NOTICIAS_RESUMO` (resumo do impacto no meta, 2-3 linhas) e `window.TFT_NOTICIAS` (lista do mais novo ao mais antigo: `id, data, patch, titulo, tipo, alvos[{tipo,id,nome}], texto, fonte{nome,url}`). Só o que está nas notas oficiais da Riot (PT-BR): patches 18.6 (04/11/2026) e 18.5 (21/10/2026, com as intermediárias de 22/10 e 27/10). `window.TFT_NOTICIAS_ATUALIZADO` guarda a data da última conferência (aparece no topo da página). Para atualizar: acrescentar entradas no topo com a fonte do patch novo (e liberar o novo padrão de URL em `tests/noticias.test.js`); isso agora roda sozinho toda quinta (ver "Atualização semanal automática das notícias"). Testes em `tests/noticias.test.js`.

## Comps do vídeo do Vladimin (patch 18.5C)

Fonte: vídeo "TFT - MELHORES COMPS DO PATCH 18.5C!" (https://youtu.be/shtFyRruAHM, 21:09, 28/10/2026), análise em `9. editor-de-video/Projetos/analise-tft-guia-videos-2026-11/COMPS-VIDEO.md` e frames do tactics.tools em `frames-comps/` (1440x900). `TFT_SEED_VERSION` = 7. As 10 comps do vídeo foram comparadas com as 19 que já existiam (Jaccard do board):

| # no vídeo | Comp | Resultado |
|---|---|---|
| 1 (0:39) | Karma + Yunara, Solar reroll | **Nova** `seed-20` "Solar Yunara Karma" (Slowroll Nvl 6). Fases: Mobalytics "Solar Yunara" (board idêntico) |
| 2 (4:10) | Azir + Rammus/Teemo, slow roll 7 | Já existia: `seed-01` Vivaz. Só `dicas` |
| 3 (5:28) | Master Yi + Rengar/Kog'Maw | Já existia: `seed-18` Lutador Florescer Adaptador. `dicas` + 7 posições (Gnar não aparece no frame; Rengar não é do board dela) |
| 4 (9:06) | Rubrivira, Fera do Rift fast 8 | Já existia: `seed-14`. `dicas` + 6 posições |
| 5 (11:35) | Ahri, Emanador | **Nova** `seed-21` "Emanador Ahri" (Fast 9). Fases derivadas (sem guia equivalente: "Weave Got This" e "Mana Go Brrr" têm Jaccard < 0,4) |
| 6 (13:28) | Soraka, Sabugueiro (exige emblema) | **Nova** `seed-22` "Sabugueiro Soraka". Fases derivadas (a "Wrath of the Woods" tem Jaccard 0,5) |
| 7 (15:09) | Aphelios, Sabugueiro (exige emblema) | **Nova** `seed-23` "Sabugueiro Aphelios". Fases: Mobalytics "Wrath of the Woods" (board idêntico) |
| 8 (17:05) | Draven + Dragão Ancião, fast 9 | Já existia: `seed-10`. Só `dicas` (já tinha posições de outro print) |
| 9 (18:26) | Draven + Ezreal, fast 9 | Já existiam: `seed-13` e `seed-15`. `dicas` + posições (8 e 9) |
| 10 (19:15) | Alune, fast 9 AP | **Nova** `seed-24` "Alune AP Fast 9". Fases: Mobalytics "AP Exodia" (variante, Jaccard 0,58) |

As 5 novas ficam logo depois das 3 fixadas (`topo` + `abaixoDe` encadeado: 20 abaixo de 19, 21 abaixo de 20 etc.), com `desde: 7`. Quem já tinha dados as recebe no próximo carregamento, sem perder edição, exclusão nem checks. `posDesde: 7` nas 4 comps existentes que não tinham posição; `dicasDesde: 7` nas 6 que ganharam dicas. Fonte de cada comp = vídeo + minuto (`fonte` e link `youtu.be/shtFyRruAHM?t=<segundos>` nas dicas). Posições (fileira 1 = frente, como no tactics.tools) lidas dos frames; a geometria foi conferida contra a `seed-01`, que já tinha posições do print 1 (bate casa a casa). Itens vêm do áudio; nomes que o reconhecimento automático não confirmou (Manopla Adornada na Karma/Alune, Mangual na Ahri) estão marcados "ouvido" nas dicas.

Limites conhecidos: as plantas do Sabugueiro (Árvores de Casca Petrificada, Protetor da Mata Profunda, Flor-da-Vida) não existem no catálogo, então ficam de fora do tabuleiro (a nota da comp diz onde estão) e o app calcula Sabugueiro 8 onde o painel mostra 9. Em `seed-24` o painel mostra Lunar 4 e o app calcula Lunar 3 (a 4ª fonte de Lunar não aparece no frame). Os vídeos são do 18.5C; o 18.6 já reduziu o pico de Sabugueiro (9), avisado nas dicas das comps 22 e 23.

## Atualização semanal automática das notícias

Toda **quinta-feira 10:00** o Agendador de Tarefas do Windows roda, **oculto** (sem janela), `wscript.exe //B //Nologo tools\noticias-semanal.vbs` (o VBS chama `WshShell.Run ..., 0`), que lança `tools/noticias-semanal.ps1`:

1. confere que o repo está na `main` e limpo (uma ferramenta por vez no projeto) e faz `git pull --ff-only`;
2. roda `claude -p` (Claude Code headless) com o roteiro versionado `tools/noticias-semanal.md`, com permissões mínimas: `--permission-mode dontAsk`, `--tools Read,Grep,Glob,Edit,WebFetch,WebSearch,Bash`, `--allowedTools` só `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch`, `Edit(data/noticias.js)`, `Edit(tests/noticias.test.js)` e `Bash(node --test:*)`; sem skills, sem slash commands, só configurações de projeto, teto de 40 turnos e US$ 3, 25 min de limite (o PID é encerrado se estourar);
3. o roteiro manda pesquisar só as notas oficiais da Riot (PT-BR), sem inventar, com link; atualiza `data/noticias.js` no mesmo formato (entradas, resumo, `TFT_NOTICIAS_ATUALIZADO`) e responde com `RESULTADO: ALTEROU | SEM NOVIDADE | FALHA`;
4. o script **não confia** no `claude`: só aceita mudança nos 2 arquivos permitidos, exige a linha `ALTEROU` e roda `node --test` por conta própria; só se tudo passar faz `git commit` (`[cc] Update TFT news (weekly auto job, AAAA-MM-DD)`) e `git push` (o Pages publica). Qualquer falha desfaz a edição. Sem novidade, não commita.

Log (fora do OneDrive): `%LOCALAPPDATA%\tft-comps-noticias\log\noticias-<data>.log` (últimos 30). Teste sem publicar: `powershell -ExecutionPolicy Bypass -File tools\noticias-semanal.ps1 -DryRun` (roda tudo, mas desfaz a edição e não faz commit nem push).

**Autenticação:** o `claude -p` usa o login normal do Claude Code do usuário. Testado em 07/11/2026 pelo próprio Agendador (`schtasks /Run`): autenticou, pesquisou as notas oficiais, respondeu `SEM NOVIDADE` e terminou sem commit (exit 0, ~25 s). Observação: dentro do shell de um agente do Claude Code o mesmo comando falha com "OAuth session expired" (credencial herdada do agente), por isso o teste de ponta a ponta foi feito pelo Agendador. Se o login expirar, rode `claude login` num terminal, ou gere um token de longa duração com `claude setup-token` e salve em `%LOCALAPPDATA%\tft-comps-noticias\token.txt` (o script o passa só ao processo do claude). Sem login o job registra "FALHA DE AUTENTICACAO" no log e não altera nada.

Gerenciar a tarefa (nome `TFT-Comps-Noticias-Semanal`):

- Registrar/atualizar: `powershell -ExecutionPolicy Bypass -File tools\noticias-agendar.ps1`
- Listar: `schtasks /Query /TN "TFT-Comps-Noticias-Semanal" /V /FO LIST` (ou `Get-ScheduledTask -TaskName TFT-Comps-Noticias-Semanal | Get-ScheduledTaskInfo`)
- Rodar agora (oculto): `schtasks /Run /TN "TFT-Comps-Noticias-Semanal"`
- Remover: `powershell -ExecutionPolicy Bypass -File tools\noticias-agendar.ps1 -Remove` (ou `schtasks /Delete /TN "TFT-Comps-Noticias-Semanal" /F`)

## Testes

- Lógica e seed (traços, busca, importação, merge de seed, fases, dicas, filtros de notícias, fidelidade do guia e da estratégia ao `.md`, palavra a palavra): `node --test tests/*.test.js`
- QA de navegador (Playwright, desktop 1440 e mobile 390): subir o servidor e rodar `node qa/qa.js`. Screenshots e `resultado.json` em `qa/`.
- QA v7 (2 colunas, fases, navegação, notícias, filtros, comps do vídeo; 1440, 1100, 1099 e 390): `node qa/qa-v7.js`. Prints `qa/v7-*.png` e `qa/resultado-v7.json`.
- QA do Guia do Jogo (índice fixo/recolhível, âncoras, scrollspy, tabelas, notas, busca, sem scroll horizontal e sem erro de console; 1440 e 390, um Chromium só): `node qa/qa-guia.js`. Prints `qa/guia-*.png` e `qa/resultado-guia.json`.
- QA da Estratégia padrão (nav de 4 links, atalhos, caixas, badges, tabelas em cartões no mobile, índice, âncoras, busca, sem scroll horizontal e sem erro de console; 1440, 1100 e 390, um Chromium só): `node qa/qa-estrategia.js`. Prints `qa/estrategia-*.png` e `qa/resultado-estrategia.json`.
- QA da prévia do overlay (6 cenários, 1000 e 390 de largura): servidor na raiz e `node qa/overlay.js`. Prints em `qa/overlay-*.png`.
- Pós-jogo, Plano, voz e helper local (`tests/posjogo-logic`, `partidas-fonte`, `plano-logic`, `painel-voz`, `riot-lib`, `riot-server`, `riot-fetch-setup`, `novas-paginas`): `node --test tests/*.test.js`. QA de navegador (servidor do helper numa pasta temporária com partidas fictícias na porta 17871, encerrado pelo PID; reconhecedor de voz simulado, Brave simulado, navegador sem voz; 1440 e 390): `node qa/qa-pos-plano-voz.js`. Prints `qa/pos-*.png`, `qa/resultado-pos-plano-voz.json`. As páginas que chamam o helper registram `ERR_CONNECTION_REFUSED` no console do navegador quando ele está desligado (é o aviso do próprio Chrome para um `fetch` recusado, esperado; o QA só tolera esse).
- Testes do Painel (`tests/painel-*.test.js`: base, comps, decisão, regras, página) e QA do Painel (partida simulada do 2-1 ao 4-3, critérios do "Melhor momento", reroll de custo 3 e comps salvas editadas, novas e excluídas, 1440, 1100 e 390, um Chromium só): `node qa/qa-painel.js`. Prints `qa/painel-*.png` e `qa/resultado-painel.json`.

## Painel de decisão (`painel.html`)

Ferramenta para usar **durante a partida**, em segundo monitor ou celular, entre rodadas. **100% manual: você digita o estado e o painel decide.** Não há API, Overwolf, captura de tela nem nada que toque o cliente (decisão consciente do Elton, ver `_brain/DECISOES.md`; `tests/painel-page.test.js` falha se aparecer `fetch`, `overwolf`, `WebSocket`, captura de tela etc. no painel). O estado fica só no `localStorage` (`tft-comps:painel:v1`); "Nova partida" zera (com confirmação).

> Desde 07/11/2026 o Painel ganhou voz, faixas rápidas e grade recolhida (ver "Voz e entrada rápida no Painel"). Decisão do Elton: durante a partida o uso é o Blitz; o Painel fica para quem quiser.

**Entrada** (coluna da esquerda no desktop; no mobile fica abaixo da saída, com uma barra fixa no topo que resume a ação):

- Rodada (estágio + rodada, e botão "Próxima rodada" que avança e mantém o resto), vida (passos -10/-1/+1, campo e slider), ouro (-5/-1/+1/+5 e campo), nível, streak (+ vitórias / - derrotas), XP opcional ("12 / 36", como o jogo mostra).
- Campeões que tenho (banco + tabuleiro): grade por custo com busca. Clique soma uma cópia; botão direito, segurar (450 ms no toque), Delete ou o × do chip remove. 2 cópias = **par**, 3 a 8 = **2★**, 9+ = **3★** (automático).
- Componentes: os 10 de `data/recipes.js` com contador (clique soma; botão -, botão direito ou segurar remove).
- Contest por comp (quantos outros jogadores você viu) e comp favorita (estrela) para forçar.
- Extras opcionais (não estavam na lista original, mas as regras do guia dependem deles): **aprimoramento** (Não sei / Economia / Força: o guia usa "aprimoramento de economia" e "de força" nas regras de 2-1, 3-7 e 4-1; é um clique que você digita, nada é lido) e **board** (Auto / Forte / Médio / Fraco; Auto deriva da streak: 2+ vitórias = forte, 2+ derrotas = fraco, senão médio, como no Passo 4 do guia).

**Saída** (coluna da direita; badges `UPAR / FICAR / ROLAR / GUARDAR` iguais aos da Estratégia padrão):

1. **Estratégia recomendada** entre as 3 do `.md` (Fast 8 padrão, Reroll custo 1, 2 ou 3, Economia máxima: Open Fort, Fast 8 antecipado 3A ou Fast 9 3B). Os critérios são os dos blocos **"Melhor momento para seguir"** do `.md`, com a mesma letra: Fast 8 (a) a (f), Reroll (a) a (g), Open Fort (a) a (g), Fast 9 (a) a (f) e o 3A (economia e ouro, contest, vida). Cada um aparece como sim / não / sem informação, com link para a linha do bloco, e acima da lista vai a contagem ("que bateram: 5 de 6 (a, b, c, d, e)"). Abaixo, "o que faria mudar".
2. **Ação agora**: título (ex.: "UPAR para 8 e ROLAR até 20–30"), texto, pré-level (com XP: "termine em 46, faltam 16"), juros atuais, próximo degrau (10/20/30/40/50 e quanto falta), ouro que sobra após a ação (faixa quando é "até 20–30"; o custo do XP só é descontado se você informar o XP), piso de ouro, faixa de vida e alerta (Atenção/Crítica), e a regra usada com link para a seção e o trecho do guia.
3. **Comps**: ranking das **comps atuais do Elton**, a lista salva pela página Comps (`tft-comps:v1`: editadas, novas, sem as excluídas; comp nova do seed entra pelo mesmo `mergeSeed` do app; sem lista salva, o seed). O painel só lê essa lista, nunca grava, e acompanha mudanças feitas na página Comps em outra aba (evento `storage`). Contest, estrela e "Forçar comp" usam a mesma lista. Fase pela rodada: estágios 1 e 2 usam `fases.inicio`, 3 e 4 usam `fases.meio`, 5+ o board final (`comp.main`); comp sem `fases` usa o board final. Top 3 em destaque, com miniaturas (você tem / falta), pares, "board final x/y", unidades que faltam (com custo e se a loja do seu nível alcança) e itens (pronto, dá para montar, falta 1 componente, faltam 2, com os nomes dos componentes pela receita). O índice é o de `js/recommend.js` (campeões 60%, itens 25%, ouro e nível 15%; não é chance de vitória).
4. **Forçar comp**: para a comp favorita (ou a escolhida no seletor): **OK / ARRISCADO / NÃO FORCE**, com os motivos e "o que buscar" (unidades e componentes).

**Arquivos**

```
js/painel-regras.js   registro de regras: id, seção, linha, origem, trecho do .md (dados)
js/painel-comps.js    ranking por fase, BIS, forçar comp (puro; usa js/recommend.js)
js/painel-logic.js    estado, economia, estratégia, ação, vida (puro)
js/painel.js          interface (textContent, sem innerHTML)
css/painel.css        todas as classes com prefixo pn-
```

`js/recommend.js` ganhou `pontuarComp` exportado, `opcoes.unidades` (campeões da fase no lugar do board final) e `faltaItens` (componentes que faltam). O overlay não muda (testes iguais) e `overwolf-app/vendor/recommend.js` foi sincronizado.

**Regras: origem de cada uma.** Cada regra em `painel-regras.js` tem `trecho` copiado do `.md`. `tests/painel-regras.test.js` confere, palavra por palavra, que o trecho existe em `data/estrategia-padrao.md` (ou `data/guia-do-jogo.md`), que as marcadas `derivada` estão marcadas "(regra derivada do guia)" no `.md` e que as do guia não estão. Três origens, sempre visíveis na interface:

| Origem | Marca na tela | O que é |
|---|---|---|
| `guia` | só o link da seção | tabela, gatilho ou piso dito no `.md` (ex.: 4-2 "SE ouro ≥ ~40 → UPAR 8 e rolar"; pisos 32, ~40, 20–30, 10, 50) |
| `derivada` | "derivada do guia" | o próprio `.md` marca como regra derivada (matriz vida x board do Passo 7, faixas de vida, "falta 1 peça", saída do Open Fort, Abandonar do reroll) |
| `painel` | "critério do painel" | interpretação do painel para entrada manual que o `.md` não define (lista abaixo) |

Interpretações do painel (origem `painel`, para o Elton revisar):

- "Muitos pares" no estágio 2 = 3+ pares (o `.md` dá "3+ pares" só para 3-2 e 3-5; parar em 14 ou 20 vem do `.md`).
- "Muito rico" no 3-5 = 50+ de ouro (juros no máximo); "segurar a streak" = 2+ vitórias seguidas com board forte (a streak passa a pagar ouro em 2).
- "Estabilizou" no 5-1 = board não fraco e vida Folga ou Segura. O painel não sabe se você achou carry e tanque: avisa para confirmar.
- Itens úteis (2-1) = dá para montar, com seus componentes, algum item que alguma comp salva usa. BIS do reroll = itens da comp em que o campeão aparece no `main`. Campeão sem item BIS conhecido = "não dá para confirmar": no custo 1 o painel não recomenda reroll (mais seguro).
- **"Slamáveis que poupem vida"** (reroll custo 2, desde o `.md` de 07/11) = os componentes na mão montam algum item completo de `data/recipes.js` (qualquer receita, não só os BIS das comps). Com isso um par de custo 2 sem contest vira reroll mesmo sem BIS no seed (regra `pn-slamavel`).
- "Cópias" do reroll = cópias do **mesmo** campeão (4+ de custo 1, 2+ de custo 2, um par de custo 3). Contest do reroll = o maior contest entre as comps que têm o carry; reroll pede 0.
- **Reroll de custo 3** (novo): par de custo 3 ("cópias cedo", sem número nas fontes: o par é o mínimo razoável, regra derivada), board forte, win streak (2+ vitórias seguidas) e board Forte juntos, sem contest e vida 41+ no estágio 3 em diante. Vale do 2-1 ao 4-2 ("a win streak precisa durar até o 4-2"). Passos: 2-1 UPAR 4; 2-5 UPAR 5 com board forte e 10+ de ouro; 3-1 FICAR e GUARDAR; 3-2 UPAR 6 com 30+; 3-5 FICAR 6; 4-1 UPAR 7 com slow roll acima de 50; 4-2 slow roll. Depois do 4-2 o painel não guarda a linha e volta ao Fast 8.
- Reroll custo 1 e 2 só são recomendados até o 4-1 (as linhas 4-2 e estágio 5 do reroll de custo 1 e 2 não são usadas; depois vale o Fast 8). As linhas 3-2 e 3-5 da Estratégia 3 coincidem com as do Fast 8 e não têm código próprio.
- "Degraus de ouro em dia" (Fast 8, critério (c)) = 14 até o 2-4, 20 até o 2-7, 32 daí em diante (regra `pn-degraus`; o `.md` só dá a sequência 14 → 20 → 32).
- 3-7 (3A): "~40+ sobrando depois de subir ao 8" = ouro menos o XP que falta para o 8 (precisa do XP informado; sem XP o painel assume o pré-level feito e avisa). No 4-2, o "ouro ≥ ~40" pressupõe o pré-level do 4-1; se o XP mostra que ele não foi feito, o painel avisa que o XP sai do ouro, mas não muda a decisão.
- "Falta 1 peça para fechar um traço" = a comp **favorita** precisa de só mais 1 campeão no board final (o traço não é calculado).
- Custo do XP = 1 de ouro por XP (o `.md` só cita 48 de ouro para o 7→8, Set 13). Sem XP informado, "sobra" mostra "ouro menos o XP". Cada rolagem custa 2 de ouro (glossário do guia).
- Fast 9 (3B) entra no 4-1 com aprimoramento de economia marcado, vida 80+, **50+ de ouro (critério (c), derivado)** e ninguém na comp; depois do 4-1 o plano segue (4-1 a 5-1) sem exigir os 50 de novo. Fast 8 antecipado (3A), no 3-7 ou 4-1: aprimoramento de economia **e** ~40+ de ouro sobrando depois de subir ao 8, contest no máximo 2 (vida 41+; com 30–40 ainda vale, abaixo de 30 o critério de vida reprova mas o painel não troca de linha por isso).
- Open Fort (2-1 a 3-1): nenhum upgrade, nenhum item útil e **sem aprimoramento de combate** (marcado "Força" em Extras tira o painel do Open Fort e manda Fast 8). Aprimoramento de economia **não é requisito**: só reforça (critério (c), "o sinal mais forte").
- Fast 8: contest ideal até 1; **máximo 2**, e aí UPAR 8 e ROLAR no 3-7 ou 4-1 (a escolha cai no Fast 8 e o critério (e) fica verde com aviso); com 3+ o critério reprova e o painel manda trocar de comp.
- Forçar comp: contest 3+ = NÃO FORCE; 2 = arriscado no fast 8 e NÃO FORCE em reroll e Fast 9 (o estilo da comp define o tipo: "Slowroll" = reroll; "Fast 9/10" e "Nível 9/10" = Fast 9); 1 pesa só em reroll e Fast 9; vida Crítica ou Atenção rebaixa. A cobertura da fase (depois do 3-2: < 25% = não force, < 50% = arriscado; estágio 5+: < 50% e < 70%) é limiar do painel.
- Estágio 1 não tem tabela no `.md`: o painel só lembra dos juros (do guia). As faixas de vida só valem do estágio 3 em diante (como o `.md` diz).

Limites: o ranking depende da lista salva no mesmo navegador (outro navegador ou aba anônima começa no seed); não há dado de loja, banco nem posicionamento; scout e força do board dependem do que você digita. A regra do overlay de nunca mostrar dado de aprimoramento continua: aqui só existe o clique "Economia/Força" digitado por você, que não vem do jogo.

## Antes e depois da partida (Plano, Pós-jogo e voz)

Decisão do Elton (07/11/2026): o Painel manual atrapalha o jogo (digitar dados no meio da partida). **Durante a partida ele usa o Blitz** (app aprovado pela Riot). Este projeto cobre **antes** (Plano) e **depois** (Pós-jogo), automático, dentro da política da Riot para TFT: recomendação estática pré-jogo e análise pós-jogo são permitidas; nada aqui lê o jogo em tempo real (sem Overwolf, captura de tela, memória nem Live Client). O Painel continua existindo, agora com entrada por voz e por faixas.

### Arquitetura escolhida

```
Riot API (account-v1, tft-match-v1)         PC do Elton                                     Navegador
  americas.api.riotgames.com  <--HTTPS--  tools/riot-fetch.js  --grava-->  %LOCALAPPDATA%\tft-comps\       (Pages ou localhost)
  chave so no cabecalho X-Riot-Token       (tarefa oculta, 15 min)          riot-key.txt  config.json         posjogo.html / plano.html
                                                                            partidas.json status.json  <--GET--  http://127.0.0.1:17870
                                           tools/riot-server.js  --le-->    (fora do repo e do OneDrive)        (so leitura, CORS restrito)
                                           (tarefa oculta, no logon)
```

- **Helper local em Node, sem dependências** (`tools/`): `riot-fetch.js` baixa só as partidas novas; `riot-server.js` entrega o histórico por HTTP local; `riot-setup.js` pergunta o Riot ID; `riot-instalar.ps1` / `riot-remover.ps1` registram e removem as tarefas; `riot-oculto.vbs` roda tudo sem janela (`WshShell.Run ..., 0`, o Elton joga LoL e janela rouba foco); `riot-lib.js` é a biblioteca (cliente com limite de chamadas, retry, trava, escrita atômica).
- **Pasta de dados** `%LOCALAPPDATA%\tft-comps\` (ou `TFT_COMPS_DIR`): `riot-key.txt`, `config.json` (Riot ID, puuid, região), `partidas.json`, `status.json`, `fetch.log`. `dirDados()` **recusa** pasta dentro do OneDrive ou do repositório. O `.gitignore` também cobre esses nomes. Nada disso vai para o repo público.
- **Chave**: lida de `riot-key.txt` ou da variável `RIOT_API_KEY` (a variável vence). Só vai no cabeçalho `X-Riot-Token`, só para `https://americas.api.riotgames.com`; nunca na URL, no log, na tela, no navegador nem no servidor local (o servidor só sabe se o arquivo existe).
- **Como a página estática lê o histórico: servidor local só-leitura** (escolhido). Alternativas descartadas: (a) gerar um `.js` com os dados dentro do repo: o repo é público e teria dado pessoal; (b) só importar arquivo à mão: não é automático. Mantido como **plano B**: o botão "Importar partidas.json" da página Pós-jogo (cobre navegador que bloqueia `localhost`, como o Brave pode fazer). A página também guarda uma cópia no `localStorage` (só neste navegador) para abrir com o servidor desligado; "Esquecer dados deste navegador" apaga.
- **Servidor**: `bind` só em `127.0.0.1` (porta 17870; `TFT_COMPS_PORTA` ou `porta` no `config.json`; a página aceita `?porta=`); só `GET` e `OPTIONS` (outros métodos = 405); rotas fixas `/api/partidas`, `/api/status`, `/api/ping` (o caminho da URL nunca vira caminho de arquivo); checagem do cabeçalho `Host` (anti DNS rebinding: só `127.0.0.1:PORTA` ou `localhost:PORTA`); CORS só para `https://contatoeltonmiranda-code.github.io` e `http://localhost|127.0.0.1[:porta]` (qualquer outra origem = 403 sem dados; `file://` e `null` também); responde ao preflight com `Access-Control-Allow-Private-Network: true`; `Cache-Control: no-store`, `nosniff`, `Cross-Origin-Resource-Policy: same-site`; timeouts de 5 s; o JSON é revalidado por `sanitizarPartidas` antes de sair; se a porta já estiver ocupada (outra cópia) sai em silêncio.
- **Limites da Riot respeitados**: chave pessoal = 20 chamadas/s e 100/2 min ([doc do portal](https://developer.riotgames.com/docs/portal)). O cliente segura em 18/s e 95/2 min (janela deslizante), honra `Retry-After` do 429 (teto de 2 min, até 3 tentativas), repete 5xx e erro de rede com espera crescente e **para** em 401/403 (chave expirada) sem insistir. Em regime normal a execução gasta **1 chamada** (lista de ids); só baixa as partidas que ainda não conhece (até 30 por execução; primeira vez olha as 30 últimas). O `puuid` é resolvido uma vez e guardado.
- **Gatilho automático** (nada registrado ainda; scripts prontos): `TFT-Comps-Riot-Fetch` (logon +1 min e a cada 15 min, 10 min de limite, uma instância só) e `TFT-Comps-Riot-Servidor` (logon, sem limite, reinicia se cair). Ambas via `wscript.exe //B //Nologo riot-oculto.vbs "<node.exe>" "<script>"`, usuário atual, sem privilégio elevado, **nunca abrem janela**.

Rotas e regiões (conferido no mirror da doc oficial): Brasil = plataforma `br1`, roteamento regional **`americas`** (AMERICAS atende NA, BR, LAN, LAS). `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` (puuid), `GET /tft/match/v1/matches/by-puuid/{puuid}/ids?start&count`, `GET /tft/match/v1/matches/{matchId}`. A página `developer.riotgames.com/apis` carrega por JavaScript e não deu para ler pelo fetch; os campos vieram do mirror (`chirpon9/riot-docs-mcp`) e do que a Riot descreve; `augments` não estava nesse mirror, então o código trata tudo como opcional.

### Passo a passo para o Elton (chave e setup)

1. Entrar em [developer.riotgames.com](https://developer.riotgames.com) com a conta da Riot.
2. **Chave de teste (Development API Key)**: o portal já mostra uma chave `RGAPI-...` ao entrar. Vale **24 horas**; amanhã é preciso "Regenerate API Key" e colar de novo. Serve para testar hoje; não pode ser usada em produto público.
3. **Chave pessoal (Personal API Key)**: registrar o produto no portal escolhendo projeto pessoal e preencher o formulário. A Riot exige **descrição detalhada**; o texto pronto em inglês está na página Pós-jogo (bloco "Chave pessoal"): ferramenta pessoal, não pública, baixa só o histórico do próprio jogador por `tft-match-v1`/`account-v1` algumas vezes por hora, grava só no PC, sem overlay, sem captura de tela, sem memória, sem dados em tempo real, sem win rate de aprimoramento. Tipo: projeto pessoal. Limites: 20/s e 100/2 min; **não pode** rodar para uso público; não dá aumento de limite. A aprovação pode demorar, por isso começar pela chave de teste.
4. No PC, dentro da pasta do projeto: `node tools/riot-setup.js`. Pergunta o Riot ID (`nome#tag`), pede a chave (digitação invisível, ou só Enter e colar depois em `%LOCALAPPDATA%\tft-comps\riot-key.txt`, uma linha `RGAPI-...`), confirma o Riot ID na Riot e grava `config.json` (com `puuid`).
5. Instalar as tarefas ocultas: `powershell -ExecutionPolicy Bypass -File tools\riot-instalar.ps1 -Iniciar` (antes, `-DryRun` mostra o que seria feito sem registrar nada).
6. Abrir **Pós-jogo**. Se o navegador perguntar sobre acesso à rede local/"localhost", Permitir. Se bloquear, usar "Importar partidas.json" (arquivo em `%LOCALAPPDATA%\tft-comps\partidas.json`).
7. Chave de teste expirou? Gerar outra e colar em `riot-key.txt` (ou `node tools/riot-setup.js` de novo). O Pós-jogo avisa "A Riot recusou a chave".
8. Desinstalar: `powershell -ExecutionPolicy Bypass -File tools\riot-remover.ps1` (`-ApagarDados` também apaga a pasta local).

### Pós-jogo (`posjogo.html`)

Lista as partidas (mais nova primeiro): colocação, data, fila, patch, duração, **nível, rodada de eliminação estimada (≈), ouro restante**, board final com estrelas e itens (ícones do catálogo), traços ativos, e uma análise por partida:

- **Comp salva mais parecida**: `TFTRecommend.pontuarComp` sobre o board final (campeões 60% + itens 25%, renormalizado sem o eixo de ouro). "Reconhecida" = tem pelo menos 60% dos campeões da comp (mínimo 2).
- **Estratégia que parece ter sido seguida** (`estiloDe`): Reroll (2+ unidades 3★ de custo até 3, ou 1 com nível ≤ 7), Fast 9 (nível 9+), Fast 8 (nível 8), Nível baixo no fim, Caiu cedo (antes do 4-1). É leitura do board final, não do que foi decidido.
- **Onde pode ter errado**: só o que os dados provam, cada achado com o trecho do `data/estrategia-padrao.md` (teste confere palavra por palavra): morreu com 20+ de ouro fora do top 4; eliminado antes do 4-1; nível ≤ 7 depois do 4-5 fora do top 4; sem comp reconhecida; poucos itens equipados no nível 8+ (observação, o banco não aparece).
- **O que a API não mostra** (sempre listado, nunca inventado): ouro e rolagens por rodada, quando subiu de nível e XP, vida por rodada, scout/contest, itens no banco e loja, posicionamento.
- **Estatísticas**: média de colocação, top 4%, vitórias, últimas 5/10/20, por comp sua e por estilo; filtro por fila. Aviso de amostra pequena.
- **Sem helper**: mostra 10 partidas **fictícias** marcadas "EXEMPLO" (`data/posjogo-exemplo.js`, gerado por `tools/gen-exemplo.js`) e as instruções passo a passo.

Pontos a confirmar na primeira partida real (não havia chave para testar a API de verdade): (1) os nomes dos campeões/itens/traços da API para o Set 18 contra o catálogo (o mapeamento normaliza prefixos `TFT18_`/`DA_`/`TFT_Item_` e aceita prefixo único; o que não casar aparece pelo nome da API e o aviso conta quantos); (2) a contagem de `last_round` (a página assume 4 rodadas no estágio 1 e 7 nos demais e marca "≈"); (3) `level` (a doc da Riot o descreve como nível da Little Legend; o código só o aceita entre 1 e 10 e trata como nível do jogador, ou `null`); (4) campos `augments` (opcionais).

### Plano pré-jogo (`plano.html`)

Página própria (dá para deixar aberta no segundo monitor ou no celular; `Modo compacto` esconde os porquês). **Estático**: montado ao abrir ou em "Remontar plano", sem timers e sem ler a partida (`tests/novas-paginas.test.js` e `plano-logic.test.js` garantem). Entradas: comps salvas (`localStorage`, mesma lista da página Comps), buff/nerf do `data/noticias.js` e histórico do Pós-jogo (só dados reais, nunca o exemplo).

- **3 comps**, ordenadas por `patch + histórico + lista`: patch = buff +1 / nerf −1 por campeão do board final ou traço com 3+ campeões da comp, peso 1 no patch mais novo e 0,5 no anterior (outros ignorados), limitado a ±3; histórico = (4,5 − média encolhida) × 1,5 com 3 partidas de prior em 4,5 (uma partida pesa pouco); lista = 1,5 menos 0,1 por posição (a ordem que o Elton deu). Cada comp mostra o porquê: histórico ("Você jogou N partidas… média, top 4"), o que o patch mudou, posição na lista e a linha do estilo.
- **Estratégia**: sempre **Fast 8 padrão** (o guia: "Não sabe o que jogar? Fast 8"), com notas quando a comp 1 é reroll ou Fast 9 e, com 3+ partidas de cada linha, quando o histórico mostra uma linha com 20+ pontos a mais de top 4.
- **Linha do tempo** 2-1, fim do 2, 3-2, 4-1, 4-2: ação, regra e "Atenção" com texto copiado do guia (teste confere); "derivada do guia" onde o próprio `.md` marca. Mais os pisos de ouro e as outras linhas (Open Fort, Reroll, Fast 9).
- No celular o histórico pessoal não existe (o helper é do PC): o plano sai só com comps salvas e patch.

### Voz e entrada rápida no Painel

- Cartão "Falar ou digitar": botão **Falar** (Web Speech API, `pt-BR`) e campo de texto com o mesmo parser (`js/painel-voz.js`, puro, testado): "ouro 32 vida 70 rodada 3-2 nível 6", "tenho dois Veigar", "peguei três Ornn", "vendi Sett", "mais um cinto do gigante", "comp Enfeitiçador" (pergunta quando há mais de uma), "contest Solar 2", "aprimoramento de economia", "board forte", "3 vitórias seguidas", "xp 12 de 36", "próxima rodada". Números por extenso (até 999) e dígitos; nomes com tolerância (apelido de 1ª palavra única, junção "vei gar", erro de 1–2 letras; nome curto só exato). "tenho Veigar" sem número só garante pelo menos 1. Mostra o que ouviu, o que aplicou e **Desfazer**.
- **Brave**: o Brave costuma não ter o serviço de reconhecimento de voz. A página detecta (sem suporte: botão desabilitado + aviso; Brave detectado ou erro `network`: aviso para usar Chrome ou Edge) e **nada quebra**; o comando digitado continua. Privacidade: o navegador envia o áudio ao serviço de voz dele (no Chrome, ao Google) só enquanto o microfone está ligado; o aviso do Painel diz isso.
- **Faixas rápidas**: ouro `< 20 / 20–30 / 30–40 / 40–50 / 50+` (valor usado 15 / 20 / 32 / 40 / 50, a borda de baixo, porque as regras são "ouro ≥ X"; incluí 40–50 que faltava na lista) e vida `Crítica < 30 / Atenção 30–40 / Segura 41–79 / Folga 80+` (20 / 35 / 60 / 90, alinhadas ao `faixaVida`). O número exato continua valendo e acende a faixa.
- **Grade de campeões recolhida** por padrão ("Escolher campeões na grade"); os chips "tenho" ficam visíveis.

### Arquivos novos

```
js/posjogo-logic.js    normalizar partida da API, mapear ids, comp parecida, estilo, achados, estatisticas (puro)
js/partidas-fonte.js   servidor local / copia do navegador / arquivo / exemplo (so fala com 127.0.0.1)
js/plano-logic.js      plano pre-jogo (puro, estatico)
js/painel-voz.js       parser de voz/texto, faixas, suporte do navegador (puro)
js/dom.js              helpers de DOM (textContent) das paginas novas
posjogo.html plano.html css/posjogo.css css/plano.css js/posjogo.js js/plano.js
data/posjogo-exemplo.js  10 partidas ficticias (gerado por tools/gen-exemplo.js)
tools/riot-lib.js riot-fetch.js riot-server.js riot-setup.js riot-instalar.ps1 riot-remover.ps1 riot-oculto.vbs
```

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

11. Placar de fim de partida (comp "Vanguarda Congregação das Bruxas Devastador", seed-19, nível 10, 1º lugar de k1ozera): `refs/17.png` traz as 8 primeiras unidades e `refs/18.png` as 2 últimas (10 no total). Campeões por match de pixels com o catálogo (0,65 a 0,87; Cassiopeia 0,65 é a mais baixa, conferida visualmente). Estrelas pelo ícone acima do retrato: só Cassiopeia tem 3 (douradas); as demais 2 (prata). Itens por match de pixels (0,68 a 0,93); item com moldura dourada = Radiante (Mão da Justiça Radiante na Morgana). Menor confiança: Elise, cortada pelo botão +2 (campeão 0,83 por 25 px visíveis; estrelas 2 inferidas pela única estrela visível, à esquerda do centro). Elise leva o Emblema de Devastador (0,68); o 2º item aparece só em ~8 px (vermelho/laranja) e o 3º está oculto: ficaram vazios. Sem posições (placar não mostra tabuleiro). Traços calculados: Vanguarda 6, Congregação das Bruxas 5, Devastador 3 (com o emblema; sem ele 2), Emanador 2, Aspecto Esmeralda 1.

12. Guia Fast 10 (comp "Fera do Rift Rubrivira Fast 10", seed-25, seed v8, no topo): `refs/21.png` mostra 7 unidades com estrelas, itens e casas (Taric 2★, Krugue 3★, Azuporã 2★, Dragão Ancião 1★, Lobo Trevoguari 2★, Rubrivira 2★, Cascalho 2★). Itens por match de pixels com o catálogo (0,53 a 0,86; o 1º da Rubrivira, Limiar da Noite, é o menos seguro). Casas lidas da grade do print (linha 1 = frente). Os 5 `flex` (Rubrivirim, Grompe, Mamãe Bicuda, Ivern, Ashe) e as dicas de itens vêm de uma partida real do Elton em 2º lugar com a mesma linha. Fases `derivado`. É variante do board da seed-14 (mesmo guia de Fera do Rift, outro nível: Fast 10 em vez de Fast 8/9).
13. Prints pedidos e não adicionados como comp nova (já estavam no seed): `refs/20.png` (Blitz "Sabugueiro Draven Taric") = seed-15, mesmas 9 unidades; `refs/23.png` e `refs/24.png` são idênticos byte a byte a `refs/17.png` e `refs/18.png` (seed-19). `refs/19.png` (tabuleiro final de 2º lugar) mostra Vi, LeBlanc e Xayah 3★ e Amumu, Sivir, Zyra, Ornn, Soraka: não é o board da sugestão do Blitz, então não serve para estrelas dela.
14. Lista do Elton sem print (comp "Feérico Vivaz Tristana", seed-26, seed v9, logo abaixo da seed-25): Tristana, Xayah, Rakan, Rammus, Vi, Lillia, Sivir, Kobuko e Taric; Gnar como `flex` (substituto do Kobuko). Sem estrelas, itens ou posições (a lista não trazia). Traços do catálogo: Feérico 4, Vivaz 3, Caçador 2, Colosso 2, Defendente 2, Primordial 2, Vanguarda 2, Aspecto Esmeralda 1. O nome usa a Tristana como carry por inferência (única com Feérico, Vivaz e Caçador). Fases `derivado` (início = custo 1; meio = custo até 3). Sem comp parecida no seed (maior Jaccard 0,14).
15. Sugestão do Blitz "Colosso Reroll" (seed-27, seed v9, abaixo da seed-26): `refs/25.png` e `refs/26.png` (barra "Sugerindo comp", Início → Final). Final com 7 unidades: Rakan, Caitlyn, Sejuani, Aronguejo, Vi, Tristana e Sivir. Match de pixels do ícone com o catálogo no `refs/26.png`: Rakan 0,90, Sejuani 0,82, Vi 0,82, Aronguejo 0,80, Sivir 0,67, Caitlyn 0,65. A Tristana (pixel 0,49 a 0,61, abaixo do limiar) foi fechada pelo rótulo legível no `refs/25.png`; o rótulo da Aronguejo aparece cortado ("Arong..."). Início (refs/26.png): Rakan, Caitlyn, Sejuani, Aronguejo, Vi (match 0,78 a 0,91); o refs/25.png mostra outro início (Rakan, Yorick, Caitlyn, Sejuani). Estrelas do refs/26.png: Caitlyn, Sejuani e Aronguejo 2★; o refs/25.png mostra a Aronguejo 3★. Itens em ícones de ~10 px: só entraram os de match de 0,80 ou mais (Caitlyn: Guinsoo; Aronguejo: Placa Gargolítica e Mão da Justiça; Sivir: Efeito Vermelho). Os outros 5 itens não foram identificados e ficaram vazios. Sem posições e sem `flex` (o Final tem só 7). Maior Jaccard com o seed: 0,13 (seed-19).
16. Pedido "Solar Reroll 3 estrelas" (LeBlanc, Sejuani, Leona, Yorick, Jarvan, Yunara, Karma) não adicionado: as 6 unidades existentes já formam a seed-20 "Solar Yunara Karma" (Jaccard 0,75), que também traz Kayle e Azir. Jarvan não existe no Set 18 do catálogo (nem no CommunityDragon pt_br do set 18). Condição do Solar (CommunityDragon pt_br, o `catalog.js` só guarda o degrau 3): com 8 campeões únicos de 3★ um deles ascende a 4★ a cada alguns segundos de combate (limiares 3, 5 e 8). `refs/26.png` é o print de contexto (Solar 3/3 no board dele). Depois o Elton aprovou uma comp separada (item 17); a seed-20 não mudou.
17. "Solar 8x 3★" (seed-28, seed v10, logo abaixo da seed-27): comp separada da seed-20, pedida pelo Elton. 7 unidades, todas 3★: LeBlanc, Sejuani, Leona, Yorick, Azir (o Elton disse Jarvan por engano), Yunara e Karma. O 8º slot é flex e não foi fixado. Condição (CommunityDragon pt_br, `DA_18_Solar`): o traço precisa estar ativo (mínimo 3 Solares) e conta Campeões de 3★ únicos; limiares 3, 5 e 8, e no 8 um Campeão de 3★ ascende a 4★ durante o combate. A base tem só 2 Solares (Sejuani e Leona) e o catálogo não tem Emblema de Solar, então o Solar só ativa com um 3º Solar: Kayle (custo 2) é o único barato; Lux (Solar, custo 5) também serve. Rakan e Aronguejo (Colosso 3) e Veigar (Enfeitiçador 3) são baratos mas não ativam o Solar. Itens de referência da seed-20 (Sejuani tanque, Yunara AD, Karma AP). Fases `derivado` (custo até 2). Sem print de board nem posições. Teste: `tests/v10.test.js`.
18. Vídeo Vladimin TFT patch 18.6 (https://youtu.be/cnOw7GHt7D4, 08/11/2026; análise em `9. editor-de-video/Projetos/analise-tft-comps-videos-2026-11-10/COMPS-VIDEOS.md`), 4 comps novas na seed v11, em ordem logo abaixo da seed-28, todas Fast 8 com tabuleiro do tactics.tools (frames em `refs/27.png` a `refs/31.png`, posições lidas dos frames): seed-29 "Primitiva Sivir Nidalee Amumu" (0:50, refs/27): Lillia, Rakan, Shen, Azuporã, Amumu, Nidalee, Kog'Maw, Sivir; seed-30 "Primitiva Sivir Nidalee Malphite" (1:52, refs/28): Malphite, Azuporã, Rek'Sai, Krugue, Rubrivirim, Nidalee, Kog'Maw, Sivir; seed-31 "Florescer Ahri Zyra" (8:40, refs/29 e 30): nível 8 Lillia, Krugue, Yorick, Fiddlesticks, Rakan, Sett, Ahri, Zyra + Taric do nível 9 (posição dele do frame 10:40), flex Amumu, Shen, Gnar e Alune 2★ (as duas versões Fada/Inferno do vídeo viraram uma comp com as trocas no flex); seed-32 "Invocador Soraka Zyra Malphite" (12:10, refs/31): Malphite, Amumu, Fiddlesticks, Yorick, Zyra, Soraka, Kennen, Azir, flex Shen e Lillia. Os traços calculados pelo app batem com o painel de cada frame. Itens: só os que existem no catálogo; Nidalee Sedenta + Limiar + Sterak, Sivir Gume + Lâmina Mortal + Azul (versão Amumu) ou Efeito Vermelho + Gume + Mangual (versão Malphite), Ahri Shojin + Manopla + Mangual, Zyra Morellonomicon + Vazio + Shojin (seed-31) ou Shojin + Arcanjo + Vazio (seed-32); alternativas do vídeo em `a`. Divergência do MD: o Emblema de Carrasco "insano" aparece na transcrição logo depois da build da Zyra (a Soraka já é Carrasco), então ficou como alternativa da Zyra. Ouvidos e não confirmados (dicas dizem): Bronze é Vida "melhor nesta versão", buff "amarelinho" de Primitivo, Fiddlesticks 2★ como sacrifício. Estrelas: só a Alune 2★ do refs/30 é visível. Aphelios + Nidalee do mesmo vídeo não entrou (é a seed-04, 8/8). Fases `derivado` (início = custo até 3; meio = início + carries/tanques de custo 4). Maior Jaccard com o seed: 0,33 (seed-29 x seed-30 entre si). Teste: `tests/v11.test.js`.

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


### Checklist de segurança dos 20 itens: helper local e páginas novas (Pós-jogo, Plano, voz)

Escopo: `tools/riot-*.js` (cliente da Riot + servidor local só-leitura), páginas estáticas novas. Sem banco, sem login, sem usuários.

| # | Item | Status | Como |
|---|---|---|---|
| 1 | API keys fora do código | ok | `riot-key.txt` em `%LOCALAPPDATA%\tft-comps\` ou `RIOT_API_KEY`; formato validado (`RGAPI-...`); `dirDados()` recusa OneDrive e repositório; teste varre o repo atrás de `RGAPI-` |
| 2 | Git limpo de secrets | ok | `.gitignore` com `riot-key.txt`, `partidas.json`, `config.json`, `status.json`, `fetch.log`; `git grep` de chave e Riot ID vazio antes do commit |
| 3 | Chave de DB nunca exposta | n.a. | sem banco; a chave da Riot nunca chega ao navegador nem ao servidor local (só sabe se o arquivo existe) |
| 4 | RLS ativo | n.a. | sem banco |
| 5 | Criptografia | ok | tráfego com a Riot só em HTTPS (`redirect: 'error'`); dados em disco ficam na pasta do usuário do Windows; arquivo da chave com permissão restrita (`icacls`/`chmod 600`); localhost em HTTP é loopback |
| 6 | Auth server-side | n.a. | sem login; o servidor local só aceita Host `127.0.0.1`/`localhost` e origens permitidas |
| 7 | Restringir acessos | ok | bind `127.0.0.1`; tarefas com o usuário atual, sem elevação; Origin fora da lista = 403 |
| 8 | Mass assignment | n.a. | servidor só lê (GET); nenhum campo de entrada é gravado |
| 9 | Cookies protegidos | n.a. | nenhum cookie |
| 10 | Hash de senhas | n.a. | sem senhas |
| 11 | Rate limit | ok | limite de saída para a Riot (18/s, 95/2 min, `Retry-After`); entrada: servidor local só em loopback, `requestTimeout` 5 s |
| 12 | Bot protection | n.a. | sem formulário público |
| 13 | Queries parametrizadas | n.a. | sem SQL; URLs da Riot montadas com `encodeURIComponent` e ids validados por regex |
| 14 | Validar inputs | ok | Riot ID (`parseRiotId`), chave, ids de partida; tudo que vem de fora (servidor, arquivo, `localStorage`) passa por `sanitizarPartidas` (tipos, faixas, tamanhos, dedupe, limite de 300); parser de voz limita o texto a 400 caracteres e valida faixas |
| 15 | Não vazar conteúdo | ok | erros da Riot viram mensagens genéricas (`ErroRiot`), sem chave nem corpo; log sem Riot ID/puuid; servidor devolve `{erro: ...}` curto |
| 16 | Restringir uploads | ok | "Importar partidas.json": só leitura local no navegador, máximo 8 MB, `JSON.parse` + sanitização, nunca executa nada |
| 17 | Trim de respostas | ok | a partida é reduzida ao jogador antes de gravar (sem Riot ID, puuid nem os outros 7 jogadores); `/api/status` devolve só estado resumido |
| 18 | Security headers | ok | no servidor local: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy: same-site`; páginas estáticas sem CSP (a meta CSP foi retirada por causa do antivírus, ver acima); sem script inline, sem CDN |
| 19 | Forçar HTTPS | ok/n.a. | chamadas à Riot só HTTPS; o Pages já serve HTTPS; o servidor local é loopback HTTP (não há como ter certificado confiável em 127.0.0.1) |
| 20 | Auditar dependências | ok | **zero dependências** (só módulos do Node); `npm audit` n.a. |

Riscos aceitos, documentados: (a) qualquer página em `http://localhost:*` pode ler o histórico local (é o seu PC, e o histórico não tem dado de terceiros); (b) a chave de teste e a pessoal ficam em texto puro em `riot-key.txt`, protegido só pela permissão do arquivo (sem cofre); (c) o áudio da voz vai para o serviço do navegador (Chrome: Google) enquanto o microfone está ligado.
