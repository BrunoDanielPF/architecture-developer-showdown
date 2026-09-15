# Correção de conteúdo fora da tela

Verificação visual em 10–11/09/2026, no navegador integrado do Codex, usando o build de produção local em `127.0.0.1:3107`. Publicação na VPS em 11/09/2026.

## Problema identificado

A regra global `html, body, #root { height: 100%; overflow: hidden }`, criada para a mesa 3D, também impedia rolar os formulários e o lobby. Na preparação local em 390 × 667, o botão começava em y=720 e terminava em y=763, sem rolagem normal para alcançá-lo. [Captura anterior](evidence/viewport-qa/01-setup-before-mobile.png).

Os painéis sobrepostos da mesa também não cabiam em larguras de celular. Diálogos com conteúdo extenso precisavam respeitar a altura disponível, e os botões do tutorial precisavam permanecer acessíveis durante sua rolagem.

## Correções

- Documento com rolagem vertical normal; recorte restrito ao espaço da mesa 3D. Formulários e lobby crescem com seu conteúdo, incluindo nomes longos e mensagens de erro.
- Navegação entre formulário, home e partida volta ao topo, evitando abrir uma tela nova na posição anterior de rolagem.
- Em larguras até 760 px ou alturas até 500 px, os painéis da partida ocupam blocos sequenciais, com progresso/relógio fixado no topo durante a rolagem. A mão e o mercado têm controles legíveis em grade, com seleção por toque; os comandos continuam usando o mesmo servidor e regras.
- Diálogos limitados à altura dinâmica da janela, rolagem interna, botões que se reorganizam e navegação do tutorial fixada na sua base. Campos móveis usam fonte de 16 px; controles principais da mesa e do tutorial têm área de toque ampliada.
- O desktop mantém a mesa com cartas 3D. A mudança de tamanho alterna a apresentação da mão sem duplicá-la ou alterar as decisões da partida. A cortina privada não renderiza cartas da mão no layout móvel.

## Fluxos verificados

1. **Home e preparação local — corrigido.** Formulário preenchido, rolagem comum até “Abrir a mesa”, abertura e retorno ao topo. Validado também em 844 × 390, com o botão entre y=231 e y=274. [Captura](evidence/viewport-qa/11-setup-landscape.png).
2. **Criar/entrar e sala de espera — corrigido.** Criação pela interface, entrada por convite em uma segunda sessão, prontidão dos dois e início pelo anfitrião. Em 390 × 667, os botões de prontidão e início ficaram entre y=388 e y=486 depois de rolagem comum. Em 1366 × 600, as ações ficaram entre y=397 e y=440. Entrada também validada em 320 × 568. [Celular](evidence/viewport-qa/02-lobby-after-mobile.png), [notebook](evidence/viewport-qa/03-lobby-after-desktop.png).
3. **Tutorial — corrigido.** Nove etapas navegadas em 320 × 568; nenhuma excedeu a largura interna do diálogo e os dois botões de navegação permaneceram dentro da janela. Exercício de Cache executado e retorno de foco ao concluir observado. [Captura](evidence/viewport-qa/07-tutorial-320.png).
4. **Mesa, mão e configuração — corrigido nos estados verificados.** Preparação das duas sessões, seleção de Índice pelo celular e implantação com redução de 8 para 6 EC e de 2 para 1 ação. Botões de preparação e confirmação acessíveis; cortina local conferida em 844 × 390, sem cartas privadas renderizadas. Desktop em 1920 × 1080 manteve cinco cartas 3D e nenhuma cópia na grade móvel. [Mão e comandos](evidence/viewport-qa/05-hand-after-mobile.png), [configuração](evidence/viewport-qa/06-card-config-mobile.png), [desktop](evidence/viewport-qa/12-table-desktop.png).
5. **Replay e resultados — corrigido.** Replay real importado, seis categorias navegadas, resultado final aberto, rolagem até salvar/explorar/nova partida e retorno à home. Verificado em 320 × 568, 768 × 1024 e 1366 × 600. [Resultado móvel](evidence/viewport-qa/08-results-320.png), [tablet](evidence/viewport-qa/09-showdown-tablet.png), [resultado desktop](evidence/viewport-qa/10-results-desktop.png).

Medições adicionais: [layout-checks.json](evidence/viewport-qa/layout-checks.json). Sem erros de console na conferência final. Os 37 testes automatizados e o build passaram; o smoke local de HTML, bundles e API também passou.

## Limites

Os tamanhos foram simulados no navegador desktop; não houve teste em um aparelho iOS/Android físico, com teclado virtual real ou leitor de tela. Rolagem vertical é intencional quando o conteúdo ultrapassa a janela. A visualização 3D continua dependendo de WebGL. O diálogo de pesquisa recebeu as regras compartilhadas de largura/altura e quebra de cartões, mas não teve uma nova pesquisa completa executada nesta revisão.

## Publicação

Release publicada: `architecture-developer-showdown-20260911-085719`, em https://architecture-developer-showdown.brdanpe.tech/. [Manifesto de arquivos](evidence/responsive-release-manifest.json), [metadados do pacote](evidence/responsive-deploy.json).

A ativação usou `deploy/update.sh`: SHA-256 conferido, smoke Linux aprovado antes da troca, backup dos seis snapshots existentes e preservação da versão anterior `architecture-developer-showdown-20260910-165737`. Backup privado (600) em `/var/backups/architecture-developer-showdown/architecture-developer-showdown-20260911-085719/data.tar.gz`.

O [relatório externo](evidence/responsive-published-verification.json) confirmou HTML/CSS/JS idênticos ao manifesto, HTTPS, redirecionamento HTTP, acesso ao EngenhaLab e uma partida completa pela API pública até exportar o replay. Serviço ativo; `nginx -t` aprovado; configuração Nginx inalterada.

A sala foi conferida também pelo navegador no domínio público: ações entre y=388 e y=486 em 390 × 667, e entre y=400 e y=443 em 1366 × 600 após rolagem comum, sem redução de zoom. Nenhum erro de console. A sala temporária dessa conferência foi encerrada pela interface. [Captura pública móvel](evidence/viewport-qa/13-published-lobby-mobile.png), [captura pública desktop](evidence/viewport-qa/14-published-lobby-desktop.png), [medições públicas](evidence/viewport-qa/published-layout-checks.json).
