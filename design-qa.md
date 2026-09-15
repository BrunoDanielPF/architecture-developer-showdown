# Design QA — mesa 3D e mão em leque

Data: 2026-09-14.

## Alvo e evidências

- Fonte visual: `docs/evidence/threejs-table-reference.png` (700 × 409 px), cópia da imagem anexada pelo usuário.
- Implementação: `docs/evidence/threejs-table-redesign-v2.png` (1280 × 720 px; viewport CSS 1280 × 720; devicePixelRatio 1).
- Comparação normalizada: `docs/evidence/threejs-table-comparison-v2.png`. Os dois lados foram comparados em caixas de 620 × 349 px; a fonte foi recortada verticalmente de 700 × 409 para 700 × 393 antes da redução, aproximando a proporção 16:9 sem distorção.
- Comparação regional: `docs/evidence/threejs-table-detail-v2.png`, com recortes ampliados da mão e dos módulos nas duas imagens. O recorte confirma o arco contínuo, a sobreposição das cartas e a remoção da caixa superior dos nós.
- Evidência móvel: `docs/evidence/threejs-table-mobile.png` (captura full-page a 390 × 844 CSS px; devicePixelRatio 1).
- Estado comparado: preparação contra IA, cinco cartas privadas, carta central Retry selecionada e mesa centralizada.

## Findings

Não restam diferenças acionáveis P0, P1 ou P2 dentro do objetivo acordado. A referência foi usada como modelo de composição, não como conteúdo ou identidade a copiar.

- Tipografia: a implementação mantém DM Sans/Manrope e a hierarquia compacta do produto. A fonte display pesada da referência não foi copiada porque reduziria a leitura dos nomes e métricas do jogo; diferença aceita.
- Espaçamento e ritmo: câmera alta, moldura inteira, zonas centrais, deck lateral, mercado vertical e mão em arco de −13° a +13° preservam a organização visual da fonte. Consoles de recursos e turno ficam fora do leque a 1280 × 720 e no viewport intermediário.
- Cores e tokens: fundo azul-marinho, ciano de sistema, ouro de seleção e cores por família preservam a identidade do Architecture Developer Showdown. O laranja/vermelho da referência não foi importado; diferença intencional.
- Imagem e ambiente: cidade, árvores, corrimãos, iluminação, moldura, grade e zonas são geometria/material/iluminação renderizados em Three.js. Cada nó agora é um `ArchitectureModule` com uma única carcaça arredondada, faixa luminosa frontal e conectores laterais; o rótulo HTML é transparente, sem borda e sem sombra, rente à superfície. Nenhuma imagem da referência foi usada como fundo ou textura.
- Conteúdo: história persistente, métricas, arquitetura privada, EC, ações, mercado e trilha de rodadas continuam visíveis. O painel de cenário substitui o pequeno marcador lateral da fonte porque a narrativa por rodada é requisito funcional do jogo.
- Ícones: a biblioteca Lucide e os ícones do catálogo existentes foram preservados, com estilo e alinhamento consistentes.
- Acessibilidade e estados: cartas continuam sendo controles com rótulo acessível e estado pressionado; foco permanece visível. Movimento reduzido continua respeitado.
- Responsividade: em 390 px não há overflow horizontal (`scrollWidth = clientWidth = 390`); cartas viram grade de duas colunas e a página rola verticalmente. Em desktop não há rolagem do documento (`1280 × 720`).

## Histórico de comparação e correções

1. P2 — em uma janela intermediária de aproximadamente 790 × 696, as cartas externas invadiam os consoles laterais. O leque recebeu escala e sobreposição específicas entre 761 e 900 px; a mão passou a ocupar 390 px e os consoles ficaram livres.
2. P2 — o primeiro nó era parcialmente coberto pelo painel de cenário. O mapa de arquitetura foi deslocado 0,9 unidade no eixo X sem alterar o grafo do domínio.
3. P2 — o primeiro enquadramento recortava as bordas laterais da mesa. O zoom ortográfico adaptativo passou a considerar a moldura completa (`width / 29`, `height / 22.4`). A evidência final mostra bordas, luzes, corrimãos e cenário periférico dentro do viewport.
4. P2 — regras antigas de `nth-child` sobrescreviam o cálculo do leque e deixavam três cartas quase retas. As regras foram removidas; as cinco transformações medidas ficaram em −13°, −6,5°, 0°, +6,5° e +13°, com queda progressiva de 22, 11, 0, 11 e 22 px.
5. P2 — os nós pareciam duas caixas empilhadas e o painel HTML flutuava sobre elas. As duas caixas foram substituídas por um único `ArchitectureModule`; a superfície clicável passou a `background: transparent`, `border: 0` e `box-shadow: none`.
6. P2 — no viewport intermediário, o arco mais forte aproximou a última carta do console de turno. Largura, sobreposição e área da mão foram recalibradas para manter separação visual sem enfraquecer o leque.
7. Recomparação final — fonte e implementação foram reunidas em `threejs-table-comparison-v2.png`. O arco em U, a carta central elevada e os módulos físicos únicos foram confirmados sem diferenças P0/P1/P2 remanescentes.

## Verificação funcional

- Seleção da carta Retry elevou a carta central e atualizou `aria-pressed` de `false` para `true`.
- Zoom no Canvas alterou o tabuleiro sem mudar os limites da mão (`x 355`, `y 473.4`, `570 × 210` em 1280 × 720).
- A superfície clicável de um módulo foi medida com fundo transparente, borda zero e nenhuma sombra; o botão `Componente API da loja` permaneceu alcançável e focável.
- Arraste em espaço vazio moveu o nó Clientes de `(204.0, 326.9)` para `(229.4, 315.7)` sem mover a mão.
- “Centralizar mesa” restaurou o enquadramento.
- Console do navegador interno: nenhum erro ou warning.
- `npm test -- --run`: 50 testes em 9 arquivos passaram.
- `npm run build`: passou. Permanece o aviso não bloqueante de chunk Three.js acima de 500 kB.

## Follow-up polish

- P3 opcional: aumentar a saturação das luzes periféricas se for desejado um clima ainda mais arcade.
- P3 opcional: animar discretamente os quatro pontos de luz da moldura, mantendo `prefers-reduced-motion`.

final result: passed
