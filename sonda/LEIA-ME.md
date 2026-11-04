# Sonda: o que o jogo entrega de verdade

Objetivo: descobrir quais dados o TFT entrega pelas vias oficiais, no seu PC. A sonda só lê e grava num arquivo. Ela não mostra nada no jogo, não mexe no jogo e não manda nada para a internet.

Tudo roda local. Os arquivos gerados têm seu nome de invocador. Não publique.

## Parte 1: Riot Live Client Data API (funciona agora, sem conta)

A Riot expõe uma API local em `https://127.0.0.1:2999/liveclientdata/...` durante a partida. Ainda não está confirmado se o TFT responde nela. A sonda descobre.

1. Abra o PowerShell.
2. Entre na pasta do projeto:
   `cd "C:\Users\elton\OneDrive\Documentos\Documentos VS CODE\5. micro-saas-apps\tft-comps"`
3. Rode: `node sonda/liveclient.js`
4. Deixe a janela aberta. Ela vai escrever "Sonda iniciada".
5. Abra o TFT e jogue uma partida normal (vale a partida de treino). Fique pelo menos até a rodada 3-1.
6. Volte ao PowerShell e aperte `Ctrl+C`. Ela mostra o resultado e o caminho do arquivo.
7. O arquivo fica em `sonda/saida/liveclient-AAAA-MM-DD....json`. Guarde esse arquivo.

Como ler o resultado:
- "A API respondeu": o TFT entrega dados por ali. As "chaves" mostram quais campos existem.
- "A API NAO respondeu": o TFT não usa essa API. É um resultado válido. O caminho então é só o Overwolf.

Se o Windows pedir permissão de rede, pode negar. Tudo é local (127.0.0.1).

## Parte 2: Overwolf GEP (precisa do app carregado no Overwolf)

O Overwolf instalado no seu PC é o `0.311.0.6`, em `D:\Jogos online\overwolf`. Para carregar o app `overwolf-app/` ainda sem publicar, a sua conta Overwolf precisa estar liberada como desenvolvedora (a doc chama de "whitelisted"). Veja a seção "O que o Elton precisa fazer" no `README.md`.

Se a conta já estiver liberada:
1. Abra o Overwolf. Clique na chave inglesa (ou clique direito no ícone dele) e vá em `Sobre` > `Opções de desenvolvimento` (`Development options`).
2. Clique em `Load unpacked extension` e escolha a pasta `...\tft-comps\overwolf-app`.
3. Entre na sua conta Overwolf (senão aparece "Unauthorized App").
4. Abra o TFT e jogue até a rodada 3-1. O app abre sozinho. Um painel pequeno no canto mostra "Gravando sonda TFT" e quantos registros já entraram.
5. Feche o jogo. O arquivo fica em `C:\Users\elton\AppData\Local\tft-comps-sonda\gep-AAAA-....json` (fora do OneDrive de propósito, porque tem seu nome de invocador).
6. Para ver o que o app teria sugerido em cada rodada (análise pós-jogo):
   `node tools/analisar-gravacao.js "C:\Users\elton\AppData\Local\tft-comps-sonda\gep-AAAA....json"`
   O comando também lista IDs que o catálogo não conhece. Esses IDs são o que eu preciso para fechar o mapeamento.

O que o app grava (e o que ele nunca grava):
- Grava: ouro, nível, vida, rodada, tabuleiro, banco, loja, itens do SEU banco, fase da partida.
- Nunca grava: aprimoramentos, tabuleiro de outros jogadores, lista de jogadores, credenciais do cliente da Riot.

## Conferir o estado oficial dos eventos (sem instalar nada)

Abra no navegador: https://game-events-status.overwolf.com/21570_prod.json
Cada feature tem `state`: 1 = verde, 2 = amarelo, 3 = vermelho. A página do Overwolf avisa que o status pode atrasar cerca de 10 minutos.

## Me mandar o resultado

Mande os arquivos `.json` (ou só o trecho "RESULTADO DA SONDA" que aparece no PowerShell).
