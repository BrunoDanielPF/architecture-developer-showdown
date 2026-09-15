# Auditoria de conclusão — Architecture Showdown

Data: 2026-09-08. Motor 0.3.0; conteúdo 0.1.0. Escopo: objetivo de 14 critérios para o jogo local, preservando GDD v0.3, TDD v0.1 e a instrução de sigilo do usuário.

A análise anterior das bibliotecas confirmou que Three.js, R3F e Drei já são usados. Nesta conclusão, a evidência foi ampliada com transporte HTTP real, persistência após reinício, teste de produção e revisão do cálculo de custo. Nenhuma migração de engine gráfico foi necessária para os critérios solicitados.

## Matriz de requisitos

| # | Critério | Evidência atual | Resultado |
|---|---|---|---|
| 1 | Partida do setup ao Showdown | `tests/http.test.ts`: dois clientes autenticados, ações legais, cinco rodadas, seis categorias e replay; jogo manual e importação registrados em `design-qa.md` | Comprovado |
| 2 | Mesa 3D com click/drag-and-drop | `src/Table.tsx`, `src/App.tsx`; Queue arrastada para API → Pagamentos e implantada; captura `table-card-selected-766.png` | Comprovado |
| 3 | Grafo realmente construído | Testes de implantação, conexão, configuração e invariantes; HTTP termina com grafos distintos; Queue/Worker observados na UI | Comprovado |
| 4 | Três decks funcionando | 24 cartas pessoais únicas (16+8), mão inicial cinco, mercado 30/5, Scenario Run de cinco cartas; testes de sorteio, compra e progressão | Comprovado |
| 5 | Sigilo adversário | `project` remove grafo/mão/deck/runtime adversário; HTTP verifica token, UID privado e tentativa de impersonar jogador; cortina e troca observadas no navegador | Comprovado |
| 6 | EC, ações e budget | Testes de gasto, renovação, teto, undo, disputa e ajuste; UI mostra recursos; penalidade de budget usada no Showdown | Comprovado |
| 7 | Motor determinístico e explicável | 100 cargas com números finitos, seed repetida idêntica, nome/posição sem bônus; traços por demanda/capacidade/caminho; unidade de custo testada | Comprovado |
| 8 | Incidentes endógenos | Testes dirigidos de backlog e retry storm; 24 partidas produziram seis tipos de incidente por condições do grafo/carga | Comprovado |
| 9 | Telemetria sem certo/errado | Projeção durante rodadas limita métricas; security/consistency e placar não são enviados; detalhes dependem de instrumentação | Comprovado |
| 10 | Comparar ambas as arquiteturas | Showdown congela dois grafos, aplica mesmas suítes e seeds, permite alternar visualização e abrir causas; UI final verificada | Comprovado |
| 11 | Três estratégias viáveis no mesmo cenário | `three-strategies.json`: carga FlashCart comum e limites explícitos; custo menor, maior vazão ou menor latência em arquiteturas distintas | Comprovado no modelo do jogo |
| 12 | Nenhuma carta como resposta automática | Motor não compara carta com ID de cenário. Testes: réplica sem leituras/cache desconectado não melhoram vazão; fila sem Worker não conclui; TTL e WAF têm custos adversos; ameaças diferentes atravessam defesas de modo diferente | Comprovado |
| 13 | Replay por seed | Seed + comandos + versões + hash; 24 partidas reproduzidas integralmente; importação pela API e UI; adulteração rejeitada | Comprovado |
| 14 | Sem erros bloqueantes | 25 testes aprovados, build aprovado, servidor de produção serviu HTML/JS/CSS/API, console sem erros nos fluxos visuais testados | Comprovado nos fluxos/ambientes declarados |

## Resultados verificáveis

`npm test`: 25 testes, três arquivos. `npm run test:e2e`: suíte HTTP real, dois testes. `npm run test:production`: compilação TypeScript/Vite e smoke test de produção aprovados.

`docs/evidence/automated-playtests.json`: 24 partidas, 366 comandos de estratégia, 109 compras, 48 grafos distintos. Incidentes observados: exaustão de conexões, cascata, backlog, disputa de estoque, cache stampede e dados desatualizados. Retry storm também é coberto por teste dirigido.

Três estratégias na carga comum (1.400 leituras/s, 140 escritas/s, provedor de 1.200 ms, erro 8%, 250 tentativas hostis/s, orçamento $1.500):

| Estratégia | p95 ms | Erros % | Conclusão % | Custo mensal | Consistência % |
|---|---:|---:|---:|---:|---:|
| Enxuta | 1.280,53 | 3,61 | 92,00 | 668,84 | 99,96 |
| Replicada | 1.292,63 | 2,10 | 90,90 | 1.308,88 | 99,26 |
| Assíncrona | 203,83 | 8,78 | 85,11 | 1.108,82 | 99,69 |

Limites: p95 <1.500 ms, erros <10%, conclusão >80%, custo <1.500 e consistência >99%. As arquiteturas foram montadas com operações reais do rules engine em fixtures controladas. Isso prova alternativas sob a mesma carga, não garante as mesmas cartas em toda mão sorteada nem substitui balanceamento humano.

## Correções nesta auditoria

- `test:e2e` apontava para testes inexistentes. Agora executa clientes HTTP independentes contra um servidor em porta efêmera.
- Servidor foi separado em fábrica testável (`server/app.ts`) e entrada local (`server/index.ts`). Persistência usa fila por partida e rename atômico, com verificação de recuperação após reinício.
- A categoria de custo anteriormente dividia custo mensal por req/s e rotulava o resultado como custo por operação. Motor 0.3 converte a vazão para 30 dias, preserva precisão e normaliza corretamente o desempate. A UI exibe as casas decimais necessárias. Teste econômico, replay HTTP e captura `showdown-cost-engine-0.3.png` confirmam o resultado.
- Partidas 0.2 ainda em andamento podem continuar porque as rodadas não mudaram. Replays finais anteriores continuam versionados e não são reinterpretados como 0.3.

## Limites da conclusão

Conclusão do jogo local solicitado, com dois jogadores no mesmo computador ou em navegadores locais separados. Não se declara multiplayer publicado na internet, física real, precisão de benchmark cloud, equilíbrio competitivo comprovado por humanos ou suporte validado a celulares estreitos. O modelo de simulação e os parâmetros econômicos continuam sujeitos a calibração de conteúdo. O aviso de tamanho de bundle é não bloqueante.

Resultado da auditoria: critérios do objetivo atendidos pelas evidências acima.


## Atualização de experiência — 2026-09-09

Fluxo contínuo de rodadas implementado após a auditoria inicial: trilha lateral 1–5 + Showdown, prontidão paralela, prazo autoritativo de 45s e telemetria de 8s com avanço automático. Pesquisa pendente escolhe a primeira carta revelada no timeout; disputa de mercado abre 45s de ajuste. Os comandos resultantes integram o replay determinístico.

`tests/round-clock.test.ts` adiciona quatro verificações: confirmação automática com preservação de EC; escolha de pesquisa; ajuste e replay completo; deadline persistido, rejeição de ação tardia e avanço sem cliente conectado. Total atualizado: 29 testes. Duas abas reais confirmaram estados privados paralelos, espera sem troca de página e chegada automática ao Showdown. O modo de mesmo computador usa cortina na mesma mesa e alternância manual. Evidências e limites da apresentação atual estão na revisão de 2026-09-09 de `design-qa.md`.
