# Modo contra IA — 11/09/2026

## Análise e implementação

O projeto já separava o motor puro (`packages/session`), validação de comandos (`packages/rules`), simulação e transporte autoritativo (`server/app.ts`). Os dois participantes são estados de jogador independentes. Portanto, foi possível acrescentar um controlador automático à segunda vaga sem modificar regras, economia, formato de replay ou versão do motor.

- Home: **Jogar contra IA** substitui o início com dois perfis no mesmo computador. Basta nome e especialização; nenhum código, segundo perfil ou troca de sessão é necessário.
- A partida identifica **Arquiteto IA** e mantém os estados de prontidão existentes.
- `server/bot.ts` recebe uma observação restrita, avalia comandos legais com simulação e busca de até duas ações, com no máximo 80 candidatos por expansão e cinco alternativas de continuação.
- A IA considera carga atual, vazão, conclusão, consistência, segurança, latência, custo operacional e EC disponível. Usa configurações limitadas, sem promessa de estratégia ótima.
- A política não recebe o objeto da partida, seed, cenários futuros ou jogador adversário. Cada comando é novamente validado pelo motor real.
- O servidor agenda uma decisão a cada 1,2 segundo, persiste estado e comanda a IA sem depender da aba. Expiração da rodada tem prioridade. Falhas de decisão usam a mesma validação para concluir pesquisa ou confirmar a fase.
- Compras disputadas usam as regras existentes; a IA replaneja o saldo disponível no ajuste. O replay registra as decisões efetivas e não reexecuta a política.
- Criação idempotente, limite de admissões, token exclusivo do humano e autorização por credencial mantêm o mesmo padrão das salas. A segunda vaga não aceita autenticação externa.

## Verificação automatizada

`npm test`: **44 testes aprovados**, incluindo sete novos testes:

1. Decisão sem mutar a observação e invariância frente a alterações ocultas.
2. Escolha de pesquisa, ações esgotadas e jogador já pronto.
3. Recuperação de compra disputada com orçamento válido.
4. 24 partidas completas: comandos aceitos, EC/ações não negativos, mão no limite, grafos válidos, construção efetiva e replay idêntico.
5. Perfil inválido, credencial única, isolamento da vaga da IA e criação concorrente/repetida após reinício.
6. Execução sem polling, retomada em disco e preservação do prazo corrente.
7. Cinco rodadas pela API, versão desatualizada rejeitada e replay importável.

`npm run build`: TypeScript e Vite aprovados. Mantém o aviso preexistente sobre tamanho do bundle da mesa 3D.

`npx tsx tests/production-smoke.ts`: HTML, bundles e API da produção local aprovados.

## Verificação no navegador

Versão local servida em `http://127.0.0.1:3109/`, com snapshots de QA separados dos dados normais do projeto.

- 1366 × 768: formulário de um perfil, botão inicial visível a 100%, identificação do modo contra IA e sessão recuperada após recarregar.
- 390 × 844: formulário, criação e preparação da partida, prontidão automática da IA, implantação humana com gasto de 3 EC/1 ação, confirmação e telemetria. Sem overflow horizontal; controles acessíveis com rolagem normal.
- Sessão recuperada continua na vaga humana, sem botão para controlar o oponente.
- Partida concluída no navegador até os seis testes do Showdown, com alternância para o grafo da IA, placar final em desktop/celular e retorno à home por **Nova partida**. A IA construiu uma réplica e uma fila e venceu quatro categorias nesta partida; esse caso isolado não mede seu equilíbrio.

Capturas em `docs/evidence/ai-qa/`: `desktop-form.png`, `mobile-form.png`, `mobile-round.png`, `desktop-reconnected.png`, `desktop-result.png` e `mobile-result.png`.

## Limites

Um único nível de IA por heurísticas, sem treinamento, conversa, ajuste automático de dificuldade ou avaliação estatística de equilíbrio. O planejador faz busca limitada e pode ignorar combinações boas. O desempenho com muitas salas simultâneas precisa de teste de carga; continua a arquitetura existente de um processo Node com snapshots locais.

As dimensões móveis foram emuladas no navegador desktop; não substituem teste em aparelho físico.

## Publicação

Publicada em 11/09/2026 em https://architecture-developer-showdown.brdanpe.tech/.

- Release ativa: `architecture-developer-showdown-20260911-193407`.
- Release anterior preservada: `architecture-developer-showdown-20260911-085719`.
- Pacote com 26 arquivos e SHA-256 `36e882d2a870cc70f177c55eb0980cb6194c6f2637b55dec2adaec48a00548a5`.
- Smoke Linux passou antes da ativação. A troca atômica manteve os dados e o serviço voltou ativo; o Nginx permaneceu válido.
- Backup anterior à troca: `/var/backups/architecture-developer-showdown/architecture-developer-showdown-20260911-193407/data.tar.gz`, proprietário `root:root`, permissão `600`.
- A validação externa confirmou hashes de HTML/CSS/JS, HTTPS e cabeçalhos, redirecionamento HTTP, EngenhaLab acessível e uma partida multiplayer completa.
- A verificação específica criou uma sessão solo, confirmou que só há credencial humana, concluiu cinco rodadas autônomas, abriu o Showdown e importou o replay. Partida de validação: `377b939e08e80944`.
- Formulário público inspecionado em 390 × 844, a 100% de zoom, sem overflow horizontal e com o botão inicial visível. Captura: `docs/evidence/ai-qa/public-mobile-form.png`.

Evidências: [metadados do pacote](evidence/ai-deploy.json), [manifesto SHA-256](evidence/ai-release-manifest.json) e [verificação pública](evidence/ai-published-verification.json).
