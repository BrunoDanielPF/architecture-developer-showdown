# Publicação da mesa Three.js e mão em leque

Publicado em 14/09/2026: https://architecture-developer-showdown.brdanpe.tech/

Release: `architecture-developer-showdown-20260914-213408`.

Commit de aplicação: `e2612e3041d193434a932726b99d6567f59f8720`. O manifesto de release foi gerado após o commit `5f9e820`, que atualiza a contagem registrada para 50 testes.

## Conteúdo publicado

- Mesa renderizada com Three.js/React Three Fiber.
- Componentes de arquitetura integrados em uma única carcaça visual, sem painéis flutuantes sobrepostos.
- Mão de cinco cartas em leque no layout desktop.
- Adaptação responsiva validada em 390×844, sem rolagem horizontal.

## Validação

- 50 testes automatizados aprovados em 9 arquivos.
- Build TypeScript/Vite aprovado; permanece somente o aviso não bloqueante do chunk Three.js acima de 500 kB.
- Smoke de produção local aprovado.
- SHA-256 local e remoto do pacote: `25772fb1efe8e646ddbdb2f55c5bc311e8f67dc124e4e5090bcd0dc1bcb22e65`.
- HTML, CSS e JavaScript públicos correspondem ao manifesto.
- HTTPS 200, API `/api/health` 200, HTTP redirecionando para HTTPS e cabeçalhos CSP, HSTS, `X-Frame-Options: DENY` e `nosniff` presentes.
- Fluxos públicos multiplayer e solo com IA concluíram cinco rodadas, Showdown e replay.
- EngenhaLab permaneceu com HTTP 200 e o domínio raiz permaneceu isolado com HTTP 404.
- Mesa Three.js e leque de cartas inspecionados no domínio público; viewport 390×844 validado sem overflow horizontal.

## Preservação e recuperação

A release anterior `architecture-developer-showdown-20260911-193407` permanece disponível. Antes da troca atômica do symlink `current`, os dados foram salvos em `/var/backups/architecture-developer-showdown/architecture-developer-showdown-20260914-213408/data.tar.gz`, com permissão `600`.

Evidências: [manifesto](evidence/threejs-release-manifest.json) e [verificação pública](evidence/threejs-published-verification.json).
