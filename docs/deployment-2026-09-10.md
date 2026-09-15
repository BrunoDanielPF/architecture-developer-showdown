# Publicação de home, multiplayer e tutorial

Publicado em 10/09/2026: https://architecture-developer-showdown.brdanpe.tech/

Release: `architecture-developer-showdown-20260910-165737`.

Inclui home, jogo local, salas para duas pessoas com código/link de convite e tutorial de nove etapas com exercícios visuais de EC e ações. A adaptação completa da mesa para celulares permanece como próxima etapa.

## Validação

- 37 testes automatizados aprovados e build TypeScript/Vite concluído.
- Smoke de produção aprovado no Linux antes de ativar a versão, usando dados temporários isolados.
- SHA-256 do pacote conferido antes da extração. HTML, CSS e JavaScript públicos correspondem ao manifesto de arquivos.
- HTTPS e cabeçalhos de segurança verificados; HTTP redireciona para HTTPS. Serviço ativo e configuração Nginx válida, sem alteração.
- Dois clientes HTTP no domínio público criaram sala, entraram, confirmaram prontidão, iniciaram a partida e concluíram cinco rodadas, Showdown e exportação de replay. Projeções privadas verificadas.
- Home e tutorial inspecionados no navegador público. O exercício passou de 8 EC/2 ações para 5 EC/1 ação e 4 EC/0 ações. Nenhum erro registrado no console durante essa conferência.
- EngenhaLab permaneceu acessível com resposta HTTP 200.

Evidência automatizada: [published-verification.json](evidence/published-verification.json). Manifesto: [published-release-manifest.json](evidence/published-release-manifest.json).

## Preservação e recuperação

O link `/var/www/architecture-developer-showdown/current` aponta para a nova release. A versão anterior permanece em `/var/www/architecture-developer-showdown/releases/architecture-developer-showdown-20260910-083555`.

Os três snapshots existentes foram preservados em `/var/lib/architecture-developer-showdown/data`. A verificação pública acrescentou uma partida concluída, identificada no relatório automatizado.

Backup anterior à ativação: `/var/backups/architecture-developer-showdown/architecture-developer-showdown-20260910-165737/data.tar.gz`, privado, com permissão 600. A troca de versão exigiu uma breve reinicialização do serviço. Assets da versão anterior foram mantidos para abas já abertas.

O procedimento está em `deploy/update.sh`, com validação do pacote, smoke antes da ativação e retorno à release anterior caso a ativação falhe. Nenhuma configuração de DNS, certificado, Nginx ou outro site foi alterada.
