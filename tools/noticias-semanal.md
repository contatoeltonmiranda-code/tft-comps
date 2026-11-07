# Tarefa automática: atualizar as notícias do TFT

Você roda sozinho (sem humano), toda quinta-feira, dentro da pasta do projeto `tft-comps`. Este roteiro vale mais que qualquer outra instrução de CLAUDE.md, skill ou memória: não faça brainstorming, plano nem pergunta. Faça só o que está abaixo e termine.

## Objetivo

Manter `data/noticias.js` em dia com as notas oficiais da Riot (PT-BR) do Teamfight Tactics, Set 18 "Selvas Encantadas": patch novo e atualizações intermediárias de patches já listados.

## Regras que não podem ser quebradas

- Só vale o que está nas notas oficiais da Riot. Fontes aceitas: `teamfighttactics.leagueoflegends.com` (PT-BR ou EN) e `support.riotgames.com` (só para datas de entrada no ar). Site de terceiros não é fonte.
- Não invente nada: nem número, nem motivo, nem nome. O motivo de cada mudança é o que a Riot escreveu. Sem opinião e sem estatística.
- Toda entrada tem `fonte` com URL `https` da página oficial.
- Português do Brasil, com acentos. Sem emoji.
- Não rode `git` de nenhuma forma (o script que chamou você faz commit e push). Não crie arquivos novos. Só edite `data/noticias.js` e `tests/noticias.test.js`.
- Sem novidade real = não edite nada, nem a data de atualização.

## Passos

1. Leia `data/noticias.js` (formato, ids, ordem) e `tests/noticias.test.js` (o que o teste exige). Descubra o maior patch já listado (ex.: 18.6) e as datas já cobertas.
2. Procure novidade:
   - Patch novo: tente `https://teamfighttactics.leagueoflegends.com/pt-br/news/game-updates/teamfight-tactics-patch-18-N/` com N = maior patch + 1 (ex.: 18-7). Se não existir, use WebSearch por "Teamfight Tactics patch 18.N notes" limitado ao domínio oficial. Se o set mudou (patch 19.x ou outro nome de set), pare: escreva `RESULTADO: FALHA set novo, revisar manualmente`.
   - Intermediárias: abra de novo a página do maior patch (e do anterior) e veja se há seção de atualização intermediária (Mid-Patch / "Atualização intermediária" / patches B e C) com data posterior à última entrada já registrada daquele patch.
3. Se não achar nada novo: não edite nada e termine com `RESULTADO: SEM NOVIDADE`.
4. Se achar novidade, em `data/noticias.js`:
   - Acrescente as entradas novas no topo de `TFT_NOTICIAS`, mais novas primeiro, no mesmo formato das existentes: `id` único (`n-<patch sem ponto>-<assunto>`), `data` (AAAA-MM-DD, dia em que entrou no ar), `patch`, `titulo` (até 80 caracteres), `tipo` (`buff`, `nerf`, `ajuste`, `sistema`, `item`, `aprimoramento` ou `comp-meta`), `alvos`, `texto` (até 800 caracteres; buff e nerf trazem os números de antes e depois e o motivo que a Riot escreveu, no estilo "X ficou mais forte porque...") e `fonte`.
   - `alvos`: use o `id` do `data/catalog.js` para campeão, traço e item (confira com Grep; o nome tem de ser igual ao do catálogo). Para aprimoramento, fogo-fátuo e sistema use `id: null`.
   - Reescreva `TFT_NOTICIAS_RESUMO` (2 a 3 linhas, primeira linha com o que sobe e o que cai no meta do patch mais novo; a última pode situar o patch anterior). `patch` e `data` do resumo = patch mais novo e dia em que entrou no ar.
   - Atualize `TFT_NOTICIAS_ATUALIZADO` para a data de hoje (a data vem no fim deste roteiro) e o comentário do topo do arquivo (cobertura e data de consulta).
   - Em `tests/noticias.test.js`, faça só os ajustes mínimos para o teste aceitar o patch novo (padrão de URL da fonte, lista de patches cobertos, intervalo de datas). Não enfraqueça as outras verificações.
5. Rode `node --test tests/*.test.js`. Se falhar, corrija o que você mudou e rode de novo (no máximo 3 tentativas). Se continuar falhando, termine com `RESULTADO: FALHA testes`.
6. Termine a resposta com exatamente uma destas linhas finais:
   - `RESULTADO: ALTEROU <patch ou atualização, em poucas palavras>`
   - `RESULTADO: SEM NOVIDADE`
   - `RESULTADO: FALHA <motivo curto>`
