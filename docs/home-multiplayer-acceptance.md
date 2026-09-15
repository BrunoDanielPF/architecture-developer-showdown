# Home, tutorial e salas multiplayer

Verificação: 10/09/2026. Implementação validada no workspace e posteriormente publicada por solicitação do usuário. A validação externa está no [registro de publicação](deployment-2026-09-10.md).

## Análise e decisões

O projeto já tinha Fastify autoritativo, projeções privadas, controle de versão, snapshots, replay e prazos independentes do navegador. O fluxo anterior criava dois tokens de uma vez e entregava ambos ao criador. Faltavam admissão por código, lobby e um menu dedicado.

As regras do GDD v0.3 e a separação técnica do TDD v0.1 foram preservadas. Mão, arquitetura e decisões adversárias continuam privadas até o Showdown, conforme a instrução do usuário já aplicada ao projeto. O multiplayer usa o mesmo motor de comandos, sem duplicar a simulação no frontend.

O transporte continua HTTP: uma consulta por vez, intervalo de 1,2 segundo e timeout de 10 segundos. A mesa 3D passa a carregar sob demanda. Não foram adicionadas dependências.

## Critérios de aceitação

| Critério | Implementação e verificação |
|---|---|
| Home dedicada | Iniciar jogo local, criar sala, entrar com código, tutorial, replay e retomar sessão. Navegação verificada no navegador. |
| Jogo local preservado | Dois perfis e seed; abertura e troca de sessão com cortina verificadas no build final. |
| Código compartilhável | Oito caracteres sem I/O/0/1; copiar código/link com alternativa de seleção manual. URL contém somente o código. |
| Credenciais individuais | Criação retorna apenas token do anfitrião; entrada retorna apenas token do convidado. Projeções não contêm tokens, seed, chaves de repetição ou estado privado de jogo. |
| Duas vagas | Entradas concorrentes resultam em uma admissão e uma rejeição; código não recupera vaga ocupada. Teste automatizado. |
| Lobby sincronizado | Nomes, especializações, presença e prontidão visíveis nas duas sessões. Não há acesso à mão ou aos comandos de jogo antes do início. |
| Início autorizado | Apenas anfitrião, com dois participantes conectados e prontos. Cancelar prontidão bloqueia o início; desconectar também. Teste automatizado e duas abas reais. |
| Saída e expiração | Convidado libera vaga e perde token; anfitrião encerra lobby; salas esperando expiram em 24 horas. Testes automatizados. |
| Resposta de admissão perdida | Repetir o identificador secreto retorna a mesma sala/token, inclusive após reinício. Sair revoga essa recuperação da vaga. Teste automatizado. |
| Reconexão | Recarregar conserva o jogador; reiniciar servidor recupera snapshot. Presença é inferida por requisições nos últimos 10 segundos. Rodadas continuam quando alguém desconecta. |
| Partida e replay | Cinco rodadas online até seis categorias e replay verificado; suíte HTTP existente testa jogadas com dois clientes reais. |
| Tutorial | Nove etapas. EC é explicado como pontos de esforço; ações como número de jogadas. Exemplos interativos mostram limites independentes, reposição entre rodadas, compra versus implantação e encaixe no grafo. Custo mensal tem uma etapa própria. |
| Acessibilidade do tutorial | Diálogo identificado, foco no título, navegação por teclado, Escape, retorno do foco ao botão de origem e rolagem interna. Conclusão e retorno de foco observados. |
| Responsividade das novas telas | Home e tutorial inspecionados em desktop e 390 × 844; documento com 390 px de largura, sem transbordamento horizontal. Menu aparece antes da apresentação em tela estreita. |
| Produção local | TypeScript/Vite aprovados; smoke de HTML, assets e API aprovado. |

## Resultados

- `npm test`: **37 testes aprovados**, em cinco arquivos, incluindo oito testes de salas em `tests/lobby.test.ts`.
- `npm run build`: aprovado. Entrada JavaScript de aproximadamente **289 kB**, mesa sob demanda de **920 kB**, antes de gzip. O aviso de chunk grande permanece na mesa.
- `npx tsx tests/production-smoke.ts`: HTML, bundles e API responderam corretamente.
- Navegador: criação pela interface, entrada pelo convite em outra aba, perfis diferentes, duas confirmações, início pelo anfitrião, setup privado, recarga do convidado e primeira rodada com relógio de 45 segundos.
- Navegador: retornar à home preservou a opção de retomada; a outra sessão detectou a ausência. Recarregar após reinício do servidor recuperou a partida.
- Navegador: tutorial no jogo e na home; exercício de implantar Cache e configurar conexão chegou a 4 EC/0 ações; a próxima rodada demonstrativa repôs o saldo para 9 EC/2 ações; conclusão restaurou foco. Partida local abriu com cortina e alternou para o segundo nome. Nenhum erro de console registrado na verificação final do fluxo local.

Os testes de salas usam Fastify inject. A suíte HTTP existente usa conexões reais, e a validação visual utilizou duas abas independentes contra o servidor de produção local.

## Limites operacionais

Os dois computadores precisam alcançar o mesmo servidor. O endereço de loopback não funciona como convite para outro computador. O README explica execução em rede local e acesso ao servidor público por HTTPS. A atualização de produção preservou as configurações existentes de firewall, DNS e proxy.

A persistência suporta um processo Node. Há limite de 30 admissões por minuto por IP observado; atrás de um proxy, esse IP pode ser compartilhado. Snapshots incluem credenciais e devem permanecer privados. Salas antigas não são apagadas automaticamente.

As credenciais ficam em sessionStorage; fechar a aba pode perdê-las. Não existem contas, recuperação de identidade, espectadores, matchmaking, ranking, vitória por abandono ou pausa por desconexão. Abrir uma nova partida substitui a sessão salva na aba, com aviso na interface. A prontidão de lobby é distinta da preparação da mão.

A validação estreita cobre as novas telas de navegação e tutorial, não certifica a mesa 3D para telefones. Balanceamento e diversão continuam dependentes de playtests humanos.


## Revisão didática de EC e ações — 10/09/2026

A explicação agora começa com o significado em linguagem simples: EC são pontos de esforço da equipe; ações são a quantidade de jogadas disponíveis. A sigla Engineering Capacity é traduzida. Custo mensal e orçamento ficam em outra etapa, com comparação de 3 EC, 1 ação e +$140/mês de custo base do Cache.

Exemplos interativos verificados no navegador:

- Implantar Cache e ajustar conexão: 8 EC/2 ações → 5 EC/1 ação → 4 EC/0 ações. A reposição demonstrativa leva a 9 EC/2 ações.
- Com 2 EC/2 ações, o Cache de 3 EC fica indisponível, mas dois ajustes de 1 EC são possíveis: 1 EC/1 ação e depois 0 EC/0 ações.
- Compra e implantação movem uma carta entre mercado, mão e arquitetura, com custos separados de 1 EC/1 ação e 3 EC/1 ação.
- O diagrama troca o encaixe vazio por um Cache no caminho API → Cache → Banco, sem inventar ganhos de desempenho.
- O indicador de EC da mesa abriu diretamente a etapa 3 do tutorial. Os exercícios não enviam comandos à partida.
- Diagrama e diálogo inspecionados em 390 × 844: largura interna e conteúdo de 350 px, documento de 390 px, sem transbordamento horizontal. Rolagem vertical do tutorial permanece disponível.

Build TypeScript/Vite e smoke de produção aprovados nesta revisão. Nenhum erro de console registrado no fluxo dos novos exercícios. Não houve alteração no motor, nas regras de gasto ou no servidor multiplayer.
