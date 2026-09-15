# Mesa, mão e contexto das rodadas — 12/09/2026

Implementação local para manter a mão independente da câmera e tornar os contextos e as consequências de cada rodada consultáveis.

- A mão usa a camada de interface, com seleção, arraste para encaixes, troca inicial e navegação horizontal. Zoom e pan afetam apenas a cena.
- Arrastar uma área vazia move o tabuleiro. A roda aproxima/afasta; os controles também aceitam pan e pinça por toque. Centralizar reposiciona a câmera e limpa a inércia do pan.
- As conexões mostram o nome do protocolo; hover/foco e inspeção oferecem a descrição. As pontas das setas acompanham o sentido do último segmento da conexão.
- O anúncio de contexto inclui a história e os sinais. Pode ser fechado e reaberto. O relógio autoritativo continua funcionando.
- O resultado mostra variações absolutas (incluindo pontos percentuais para erros), comparadas à medição anterior, sem pontuar a jogada. A primeira medição é identificada como baseline.
- O painel conserva o resultado da última rodada e as histórias reveladas. A API projeta o histórico existente no runtime, preservando reconexão e os limites de instrumentação de cada medição. Nenhum estado privado do adversário é exposto.

## Validação

- `npm test`: 47 testes aprovados em 8 arquivos, incluindo persistência das medições, comparação e sigilo.
- `npm run test:production`: TypeScript, build, HTML, bundles e API aprovados. Permanece o aviso de tamanho do bundle 3D.
- `npx tsx tests/table-feedback-browser.ts`: Edge headless, API real local com relógio controlado. Verificou bounds invariáveis da mão durante zoom e pan, movimento efetivo da arquitetura, centralização, protocolo e descrição, arraste e implantação, resultado após avanço/reload, navegação da mão e ausência de overflow horizontal em 766 e 390 px.
- Capturas em `docs/evidence/table-feedback/` foram inspecionadas visualmente. Os testes não substituem validação de gestos em um aparelho físico.

O servidor de prévia local usa porta 3173 e dados separados em `data-ui-feedback`.
