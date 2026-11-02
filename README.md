# Comps TFT

Mini sistema pessoal de composições de Teamfight Tactics (set atual). HTML/CSS/JS puro, sem build e sem dependências.

## Como abrir

- Servidor local: `python -m http.server 8765` dentro desta pasta e abrir `http://127.0.0.1:8765/index.html`.
- Também funciona com duplo clique em `index.html` (testado via `file://`).

Recursos: lista de comps com traços ativos (calculados dos campeões e emblemas), campeões com custo e estrelas alvo, itens principais e alternativos (borda tracejada), flex, tabuleiro hex 4x7, busca por campeão/traço/item, editar/duplicar/excluir, exportar/importar JSON, atalhos com `?`. Cada comp tem busca própria de campeão e check "já peguei" por campeão, com contador e "Limpar checks". Dados ficam em `localStorage` (`tft-comps:v1`, com `seedVersao` e `excluidos`); os checks ficam em outra chave (`tft-comps:picks:v1`) e não entram no export.

Atalhos do app: `?` ajuda, `/` busca, `N` nova comp, `Esc` fecha.

## Dados

- Fonte: CommunityDragon `cdragon/tft/pt_br.json` (campeões, traços, itens e ícones). Ícones baixados para `assets/` (funciona offline).
- O set que o Elton chama de "Set 17" está em `sets["18"]` / mutator `TFTSet18` no CommunityDragon (itens `DA_*`). O "Set17" do CommunityDragon é outro set.
- As comps de exemplo vêm dos prints em `refs/` e ficam em `data/seed.js` (campo `fonte` indica o print). O botão "Restaurar comps originais" (em Atalhos) volta a esse estado.
- Comps novas do seed chegam para quem já tem dados salvos: `data/seed.js` define `TFT_SEED_VERSION` e a comp nova leva `desde: <versão>`. No carregamento, `mergeSeed` (`js/logic.js`) acrescenta só comps com `desde` maior que a `seedVersao` salva, cujo id não exista e não esteja em `excluidos` (ids de comps do seed que o usuário excluiu). Edições nunca são sobrescritas. Para publicar comp nova: adicionar ao seed com `desde: N` e subir `TFT_SEED_VERSION` para N.

## Testes

- Lógica e seed (traços, busca, importação, merge de seed): `node --test tests/*.test.js`
- QA de navegador (Playwright, desktop 1440 e mobile 390): subir o servidor e rodar `node qa/qa.js`. Screenshots e `resultado.json` em `qa/`.

## Dúvidas de identificação (conferir)

1. Os prints 5 e 7 parecem a mesma estratégia (Vivaz + Sabugueiro). As comps "Vivaz com Sabugueiro" (print 5) e "Vivaz Sabugueiro Veigar" (print 7) têm as mesmas 8 unidades da descrição do Elton: Veigar, Alistar, Morgana, Hecarim, LeBlanc, Teemo, Kobuko (o ursinho) e Kog'Maw (a "abelha"). A descrição bate com o painel de traços do print 7 (Vivaz 3, Sabugueiro 3, Emanador 3, Enfeitiçador 2, Lutador 2). O overlay do print 7 mostra outra comp (Fera do Rift Rubrivira Dragão Ancião); entrou como comp extra.
2. Print 5 (in-game): só os itens do Morgana foram atribuídos; os demais itens visíveis não têm unidade segura.
3. "Devastador com Fera do Rift" (print 8) e "Eclipse" (print 12) foram deduzidos do painel de traços, não de uma lista de campeões. O 3º Lunar do Eclipse não foi identificado, por isso o app mostra Lunar 2 e não mostra o traço Eclipse nessa comp.
4. O print 12 também tem um overlay "Sabugueiro Draven Taric" (entrou como comp extra, 15 no total).
5. Itens foram identificados comparando pixels com os ícones oficiais. Menor confiança: Alune (Manopla Adornada), Zyra (Cajado do Vazio), Fiddlesticks (Capa de Fogo Solar), Kennen no print 13 (Limiar da Noite), Dragão Ancião (Gume do Infinito), Yunara. Item do Ivern no print 10 não foi identificado.
6. Print 4 chama o traço de "Primitiva"; no CommunityDragon o traço é "Primordial" (o emblema se chama "Emblema de Primitiva").
7. Print 10 (tactics.tools) mostra "9" unidades mas só 8 aparecem no tabuleiro.
8. Print 14 (comp "Defendente Congregação das Bruxas Rengar", seed-16, nível 8 em 5-3): o overlay "Sugerindo comp Sabugueiro Draven" foi ignorado. As 8 unidades foram deduzidas do tabuleiro e conferidas contra o painel de traços (Defendente 6, Rival 1, Enfeitiçador 2, Flora Fatalis 1, Congregação 2/3, Emanador 1, Feérico 1, Inferno 1: bate exato). Rengar leva o Emblema de Defendente. Há um segundo Rammus no fundo do tabuleiro, tratado como unidade adversária (não entra na comp). Sem posicionamento: a câmera inclinada não permite ler as casas do hex. Menor confiança: Morgana (silhueta escura de longe; poderia ser Elise), estrelas (lidas do ícone da barra de vida: losango = 1, 1 divisa dourada = 2, 2 divisas = 3; Rengar e Cassiopeia 3 estrelas é incomum para nível 8), e itens do Fiddlesticks (Efeito Vermelho, Gume do Infinito, Luvas do Ladrão) e da Cassiopeia (Elmo Adaptativo, Lança de Shojin). Itens do Rammus (Capa de Fogo Solar, Proteção Imutável) e do Rengar (Determinação Titânica, Lâmina de Guinsoo) vieram do match de pixels. Ornn, Lillia e Shen sem itens visíveis. Espada flutuante no chão não é item equipado.

## Segurança (checklist de 20 itens, app estático local)

Sem backend, sem login, sem banco. n.a. com justificativa: 1-8, 10-12, 14 (server-side), 16, 17, 19, 20 (sem servidor, segredos, auth ou dependências). Aplicados: 13/14 (todo texto vai por `textContent`; importação passa por `sanitizeImport`, que valida ids, limites e tamanho), 15 (erros genéricos ao usuário), 18 (CSP e headers só se publicar com servidor; a meta CSP foi retirada porque o antivírus injeta script e quebra a política).
