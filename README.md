# Architecture Developer Showdown

Jogo contra IA ou multiplayer por sala: construa uma arquitetura como grafo, planeje ações simultaneamente, enfrente cinco contextos progressivos da FlashCart e revele os sistemas no Showdown.

## Executar

Requer Node.js compatível com Vite 6 e Fastify 5 (Node 20.19+ ou 22.12+), npm e navegador com WebGL.

```powershell
npm ci
npm run dev
```

Abra http://127.0.0.1:5173/. O comando inicia Vite (5173) e servidor de partidas (3001). Ambos escutam apenas no computador local.

Para executar o build de produção, encerre o processo de desenvolvimento antes de usar a mesma porta 3001:

```powershell
npm run build
npm start
```

Abra http://127.0.0.1:3001/.

## Jogar

1. Na home, escolha o **Desafio diário**, **Jogar contra IA**, **Criar sala** para convidar alguém ou **Entrar com código**. Contra IA, informe apenas seu nome e especialização: o Arquiteto IA ocupa o outro lado e decide sozinho. No multiplayer, cada pessoa escolhe seu próprio perfil e joga na própria sessão. O **Tutorial** tem nove etapas, com exemplos interativos de esforço (EC), ações, reposição entre rodadas, compra e implantação. Clicar nos indicadores de EC ou ações da mesa abre a explicação correspondente.
2. No setup, cada jogador recebe cinco cartas e pode trocar até duas, uma única vez. Confirme sua preparação; o adversário confirma a dele. No modo solo, a IA faz isso automaticamente.
3. Cada rodada revela um Scenario Card e abre **45 segundos de planejamento simultâneo**. A trilha à direita mostra rodadas 1–5 e Showdown, com cronômetro. O contexto acumula mudanças persistentes e expira alterações temporárias.
4. Clique em uma carta ou arraste até um encaixe destacado. Configure os parâmetros e prepare a implantação. Destaques indicam apenas compatibilidade estrutural.
5. Comprar no mercado custa 1 EC e uma ação. Implantar usa o custo EC da carta e uma ação. Reservar no backlog custa 1 EC e uma ação; recuperar custa uma ação. Conectar/configurar custa 1 EC e uma ação; reposicionar é gratuito.
6. **EC são pontos de esforço da equipe; ações são quantas jogadas você pode fazer.** Há duas ações por rodada. Implantar Cache, por exemplo, gasta 3 EC e 1 ação. Ajustar uma conexão gasta 1 EC e 1 ação. Ao fazer as duas, você sai de 8 EC/2 ações para 4 EC/0 ações: ainda tem esforço, mas nenhuma jogada disponível. EC começa em oito, recebe cinco a partir da segunda rodada e acumula até doze; as ações voltam a duas e não acumulam. Mão: sete cartas. Backlog: três. Cartas compradas automaticamente com a mão cheia vão ao descarte.
7. **Desfazer última** altera apenas decisões ainda não travadas. Pesquisa revela informação privada e confirma seu custo imediatamente; a revelação não pode ser desfeita.
8. Ao confirmar, você aguarda na sua mesa enquanto o outro planeja. Quando os dois confirmam, ou o prazo termina, o servidor resolve as decisões. No timeout, confirma o que já foi preparado e preserva o EC restante. Se uma pesquisa estiver pendente, escolhe a primeira carta revelada e descarta as demais. Compra disputada usa prioridade determinística; o perdedor recupera EC/ação e recebe uma janela de ajuste de 45 segundos.
9. A telemetria aparece na mesma mesa por **8 segundos**, depois o próximo contexto abre automaticamente. Ambos podem continuar antes. Observe latência, erros, vazão e custo. Instrumentação adiciona detalhes de componentes/incidentes; tracing adiciona causas. Não há pontuação de jogadas durante a partida.
10. Após cinco rodadas, o Showdown congela e revela ambos os grafos. Execute as seis categorias, alterne a arquitetura visualizada e abra as explicações do resultado.

Incidentes observados também aparecem diretamente sobre o grafo: fila acumulada, estouro de conexões, tempestade de cache e pacotes de retry têm efeitos próprios. A camada visual prioriza até quatro ocorrências, destaca criticidade e acompanha o ciclo disparado → em andamento → recuperado. Sem instrumentação ou tracing, detalhes privados continuam ocultos; um resumo textual acessível acompanha os efeitos.

Budget é o limite de custo mensal, separado de EC. Excedê-lo é permitido, mas reduz a eficiência de custo. Pesos de leitura que somam mais de 100 são normalizados entre as saídas do nó; ramificar não duplica leituras atendidas. Escritas representam ramificações de trabalho, como persistir um pedido e chamar o pagamento.

## Jogar contra IA

O modo solo usa o mesmo motor autoritativo e os mesmos custos, limites, cinco rodadas, relógio e Showdown do multiplayer. A IA faz mulligan, implanta e configura componentes, compra no mercado e usa pesquisa quando apropriado. Pode preservar recursos quando não encontra uma melhoria. Não precisa de chave de API nem de um serviço de IA externo; precisa de conexão ao servidor do jogo.

Há um nível de dificuldade: um planejador por heurísticas avalia a própria arquitetura sob a carga já revelada, com busca limitada a duas jogadas. Recebe somente fase, rodada, seu próprio estado privado projetado, mercado e mundo atual. Não recebe a mão, grafo ou decisões do adversário, a seed, ordem dos decks ou cenários futuros. As estimativas locais não são pontuação final nem garantem a melhor estratégia; não há treinamento ou adaptação entre partidas.

`POST /api/solo` recebe `name`, `specialty` e um `requestId` secreto opcional para repetição segura. Retorna somente `id` e a credencial humana `token`. A vaga da IA não tem credencial acessível. A política roda no servidor a intervalos de aproximadamente 1,2 segundo, inclusive sem clientes consultando. Comandos passam pelo mesmo `dispatch` e entram no replay. Snapshots preservam a política ativa e o agendamento; reiniciar o servidor ou recarregar a aba recupera a partida sem reiniciar o prazo corrente.

**Home → Retomar sessão** retorna à partida. Os prazos continuam fora da mesa e durante desconexões. `sessionStorage` mantém a credencial ao recarregar a mesma aba; fechar a aba pode perdê-la. A API e as sessões locais antigas continuam compatíveis, mas novas partidas pela home usam IA ou sala multiplayer. Não há alternância para controlar a IA.

Critérios, evidências e limites desta implementação: [aceitação do modo IA](docs/ai-acceptance.md).

## Desafio diário

O desafio muda à meia-noite no fuso `America/Sao_Paulo`. Todas as pessoas recebem no mesmo dia o mesmo perfil, ordem de contextos e baralhos, sem exposição da seed ao navegador. A home apresenta três objetivos de resultado — desempenho no Showdown, orçamento e estabilidade — e a medalha bronze, prata ou ouro só é calculada após a partida.

`GET /api/challenges/daily` retorna o briefing público. `POST /api/challenges/daily/start` recebe `name` e `requestId`, cria uma partida contra a IA e pode ser repetido com o mesmo identificador sem duplicar a tentativa. O estado autoritativo continua persistido em disco e pode ser retomado na mesma aba.

Em produção, defina `DAILY_CHALLENGE_SECRET` com ao menos 24 caracteres. Sem essa variável, o servidor gera uma chave em `DATA_DIR/.daily-challenge-secret`; `DATA_DIR` precisa ser persistente entre versões. Tanto `data/` quanto o arquivo de segredo são ignorados pelo Git.

## Salas multiplayer

1. O anfitrião escolhe nome e especialização em **Criar sala**. O servidor gera um código de 8 caracteres e uma credencial privada para essa pessoa.
2. Compartilhe **Copiar código** ou **Copiar link**. O convite contém apenas `?join=CODIGO`, nunca credenciais. A outra pessoa informa o código, nome e especialização para ocupar a segunda vaga.
3. Os dois confirmam prontidão. **Iniciar partida** só fica disponível ao anfitrião quando ambos estão prontos e conectados. A preparação de mão (mulligan) ocorre depois, na mesa; ainda não há cronômetro nessa etapa.
4. **Home** preserva a sessão nesta aba; **Retomar sessão** retorna à sala/mesa. Recarregar também recupera a sessão. Sair de um lobby libera a vaga do convidado e revoga sua credencial; o anfitrião pode encerrar o lobby. Ao voltar à home, você deixa de sinalizar presença até retomar.
5. Após o início, as vagas ficam reservadas. Desconectar não pausa os prazos nem produz vitória por abandono: o servidor confirma decisões pendentes, preserva EC e progride conforme as regras. A interface indica ausência após aproximadamente 10 segundos. Fechar a aba pode apagar a credencial de `sessionStorage`; o código não recupera uma vaga ocupada. Não há recuperação por conta.

Salas esperando expiram em 24 horas. As novas APIs validam perfil/código, impedem dupla ocupação e limitam admissões a 30 tentativas por minuto por IP visto pelo servidor (atrás de proxy, esse limite é compartilhado pelo IP do proxy). Criação e entrada da interface têm identificador secreto de solicitação para repetir com segurança uma operação cuja resposta se perdeu. Credenciais, esses identificadores e a seed nunca aparecem na projeção do lobby. A seed multiplayer é aleatória, criada no servidor após os perfis serem escolhidos.

O transporte usa consultas HTTP sequenciais a cada 1,2 segundo, com timeout e reconexão automática. Toda regra e prazo continuam autoritativos. É uma implementação para um único processo Node com snapshots em disco; múltiplas réplicas exigem armazenamento e coordenação compartilhados. Não há matchmaking, contas, espectadores ou ranking.

### Conectar computadores diferentes

Os participantes precisam acessar o **mesmo servidor por um endereço alcançável por ambos**. `127.0.0.1` no convite só funciona no computador que executa o jogo. O padrão continua local; nenhuma regra de firewall ou publicação é alterada pelo projeto.

Para uma rede local autorizada, após o build, é possível configurar o servidor antes de iniciar:

```powershell
$env:HOST = '0.0.0.0'
npm start
```

Abra em ambos os computadores `http://IP-DO-SERVIDOR:3001`. Para uso pela internet, a versão com modo contra IA, home, salas multiplayer, tutorial interativo e layout móvel está em [Architecture Developer Showdown](https://architecture-developer-showdown.brdanpe.tech/). A publicação usa servidor Node atrás de HTTPS; hospedagem estática isolada não atende a API de salas nem ao controlador automático. Consulte a [aceitação e publicação do modo IA](docs/ai-acceptance.md), o [registro inicial de publicação](docs/deployment-2026-09-10.md) e os exemplos de proxy e serviço em `deploy/`.

## Replay

Após o Showdown, **Salvar replay** exporta seed, nomes, especializações, versões e comandos. A seed define os sorteios; os comandos são necessários para reproduzir as decisões. O importador reexecuta o log e compara o hash do resultado.

```powershell
npm run demo:replay
```

Gera `docs/evidence/demo-replay.json`, uma partida completa com ações legais. Use **Reproduzir uma partida salva** no menu inicial.

Motor atual: **0.4.0**, conteúdo **0.1.0**. Replays finais de versões anteriores são rejeitados explicitamente. Partidas ainda em andamento em 0.2 ou 0.3 são atualizadas ao carregar: 0.4 normaliza o contrato versionado de incidentes, preservando as regras e a simulação das rodadas anteriores. Partidas de versões mais antigas precisam ser reiniciadas.

## Verificação

```powershell
npm test
npm run test:e2e
npm run test:production
```

- `npm test`: cobre regras, causalidade, três estratégias, contrato e ciclo de incidentes, desafio diário, transporte HTTP, salas, disputa de vaga, sigilo, reinício, prazos, reconexão e IA. As suítes também executam partidas sistêmicas e partidas completas contra o planejador automático.
- `test:e2e`: partida completa pela API usando dois clientes HTTP reais, sigilo, conflito de versão, reinício e replay. Não é uma suíte de automação de navegador.
- `test:production`: build e smoke test de HTML, assets e API no servidor de produção local.
- Interações visuais foram verificadas no navegador do Codex. Evidências e limites estão em `design-qa.md` e `docs/completion-audit.md`.
- A revisão de 11/09/2026 corrige conteúdo e botões fora da tela, com rolagem nos formulários/lobby, painéis móveis da partida e diálogos adaptados à altura disponível. Fluxos, tamanhos testados e limites: [aceitação de responsividade](docs/responsive-acceptance.md).

## Organização

```text
src/                    React, HUD, interação e mesa Three.js/R3F/Drei
packages/domain/        Tipos e aleatoriedade determinística
packages/content/       Catálogo, decks e cenários
packages/rules/         Comandos, custos, encaixes, configuração e grafo
packages/world/         Progressão e duração dos contextos
packages/session/       Fases, projeções privadas, resolução e replay
packages/simulation/    Fluxo, capacidade, latência, incidentes e Showdown
server/                 API autoritativa e snapshots locais
tests/                 Suítes, estratégias e replay de demonstração
docs/evidence/         Resultados de testes e capturas
```

O motor não depende de React ou Three.js. O servidor conserva o estado completo; cada token recebe apenas a projeção permitida. Snapshots em `data/` incluem dados privados e são ignorados pelo Git. Gravações são serializadas por partida e substituem o arquivo por rename após a escrita. Recarregar a mesma aba preserva sua sessão; fechar a aba pode eliminar os tokens mantidos em sessionStorage.

O relógio autoritativo vive em `server/round-clock.ts`; prazos são persistidos com a sala e independem da aba. O replay registra os comandos determinísticos produzidos pela expiração, sem depender de relógio de parede. `src/TurnFlow.tsx` e `src/turn-flow.css` compõem a trilha, portas de prontidão, etapas e transições. Animações respeitam `prefers-reduced-motion`.

A mesa usa geometria 3D com faces HTML presas às transformações da cena. Modelos GLB, texturas e pós-processamento podem melhorar o acabamento sem alterar as regras.

## Fontes e escopo

- `Architecture_Showdown_GDD_v0.3.docx`: regras, mecânicas e experiência.
- `Architecture_Showdown_TDD_v0.1.docx`: arquitetura técnica.
- A instrução do usuário prevalece sobre trechos conflitantes dos documentos: **identidades das cartas na mão e arquitetura adversária ficam ocultas até o Showdown**. Durante a partida, apenas o verso das cartas, o tamanho da mão e eventos genéricos de entrada, saída ou reorganização ficam visíveis ao outro jogador.
- A imagem fornecida orienta composição e perspectiva; não foi copiada como interface ou textura.

Este é o jogo com multiplayer por salas para dois participantes, mantendo o escopo do vertical slice. Não inclui matchmaking, contas, ranking ou infraestrutura de nuvem real. A simulação é um modelo de jogo com unidades e trade-offs definidos, não um benchmark de produtos cloud. A viabilidade técnica de três estratégias foi medida; balanceamento competitivo e diversão ainda dependem de playtests humanos. A validação visual cobre desktop e janela de aplicativo a partir de 766 px, não telefone estreito. A mesa 3D é carregada sob demanda: a home não baixa esse módulo ao abrir. O chunk da mesa ainda produz um aviso não bloqueante de tamanho (~920 kB antes de gzip).
