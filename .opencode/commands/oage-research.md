---
description: Pesquisa documentacao oficial de uma biblioteca via context7 antes de implementar (Context7 Gate)
agent: build
---
Pesquisa disciplinada de uma biblioteca/framework antes de qualquer implementacao (OAGE §12, §43, §49).

Argumento: nome da biblioteca (e opcionalmente a versao) a pesquisar.

Fluxo obrigatorio:
1. Verificar a versao real instalada em `package.json` (nao assumir)
2. `context7_resolve-library-id` com o nome da biblioteca
3. `context7_query-docs` com o library ID, incluindo a versao especifica (`/org/project/version`)
4. Confirmar que a versao da documentacao corresponde a versao do `package.json`
5. Procurar exemplos de uso no codigo existente do projecto (grep) para verificar consistencia
6. Verificar compatibilidade com outras dependencias relevantes

Termina com uma recomendacao concreta: quais APIs/metodos usar, quais evitar (deprecated/breaking changes), e qualquer anti-pattern documentado para esta biblioteca. Nunca responder a partir da memoria do modelo sem ter consultado o context7 primeiro.
