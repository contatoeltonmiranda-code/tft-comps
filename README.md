# Comps TFT

Mini sistema pessoal de composições de Teamfight Tactics (set atual). HTML/CSS/JS puro, sem build e sem dependências.

## Como abrir

- Servidor local: `python -m http.server 8765` dentro desta pasta e abrir `http://127.0.0.1:8765/index.html`.
- Também funciona com duplo clique em `index.html` (testado via `file://`).

Recursos: lista de comps com traços ativos (calculados dos campeões e emblemas), campeões com custo e estrelas alvo, itens principais e alternativos (borda tracejada), flex, tabuleiro hex 4x7, busca por campeão/traço/item, editar/duplicar/excluir, exportar/importar JSON, atalhos com `?`. Dados ficam em `localStorage` (`tft-comps:v1`).

Atalhos do app: `?` ajuda, `/` busca, `N` nova comp, `Esc` fecha.

## Dados

- Fonte: CommunityDragon `cdragon/tft/pt_br.json` (campeões, traços, itens e ícones). Ícones baixados para `assets/` (funciona offline).
- O set que o Elton chama de "Set 17" está em `sets["18"]` / mutator `TFTSet18` no CommunityDragon (itens `DA_*`). O "Set17" do CommunityDragon é outro set.
- As comps de exemplo vêm dos prints em `refs/` e ficam em `data/seed.js` (campo `fonte` indica o print). O botão "Restaurar comps originais" (em Atalhos) volta a esse estado.

## Testes

- Lógica (traços, busca, importação): `node --test tests/logic.test.js`
- QA de navegador (Playwright, desktop 1440 e mobile 390): subir o servidor e rodar `node qa/qa.js`. Screenshots e `resultado.json` em `qa/`.

## Dúvidas de identificação (conferir)

1. Os prints 5 e 7 parecem a mesma estratégia (Vivaz + Sabugueiro). As comps "Vivaz com Sabugueiro" (print 5) e "Vivaz Sabugueiro Veigar" (print 7) têm as mesmas 8 unidades da descrição do Elton: Veigar, Alistar, Morgana, Hecarim, LeBlanc, Teemo, Kobuko (o ursinho) e Kog'Maw (a "abelha"). A descrição bate com o painel de traços do print 7 (Vivaz 3, Sabugueiro 3, Emanador 3, Enfeitiçador 2, Lutador 2). O overlay do print 7 mostra outra comp (Fera do Rift Rubrivira Dragão Ancião); entrou como comp extra.
2. Print 5 (in-game): só os itens do Morgana foram atribuídos; os demais itens visíveis não têm unidade segura.
3. "Devastador com Fera do Rift" (print 8) e "Eclipse" (print 12) foram deduzidos do painel de traços, não de uma lista de campeões. O 3º Lunar do Eclipse não foi identificado, por isso o app mostra Lunar 2 e não mostra o traço Eclipse nessa comp.
4. O print 12 também tem um overlay "Sabugueiro Draven Taric" (entrou como comp extra, 15 no total).
5. Itens foram identificados comparando pixels com os ícones oficiais. Menor confiança: Alune (Manopla Adornada), Zyra (Cajado do Vazio), Fiddlesticks (Capa de Fogo Solar), Kennen no print 13 (Limiar da Noite), Dragão Ancião (Gume do Infinito), Yunara. Item do Ivern no print 10 não foi identificado.
6. Print 4 chama o traço de "Primitiva"; no CommunityDragon o traço é "Primordial" (o emblema se chama "Emblema de Primitiva").
7. Print 10 (tactics.tools) mostra "9" unidades mas só 8 aparecem no tabuleiro.

## Segurança (checklist de 20 itens, app estático local)

Sem backend, sem login, sem banco. n.a. com justificativa: 1-8, 10-12, 14 (server-side), 16, 17, 19, 20 (sem servidor, segredos, auth ou dependências). Aplicados: 13/14 (todo texto vai por `textContent`; importação passa por `sanitizeImport`, que valida ids, limites e tamanho), 15 (erros genéricos ao usuário), 18 (CSP e headers só se publicar com servidor; a meta CSP foi retirada porque o antivírus injeta script e quebra a política).
