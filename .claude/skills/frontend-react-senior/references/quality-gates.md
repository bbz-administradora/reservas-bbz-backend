# Gates de qualidade React e TypeScript

Aplicar os gates correspondentes ao alcance da mudança. Não adicionar abstrações, testes ou otimizações sem relação com o risco real.

## TypeScript e contratos

- Tipar props, eventos, retornos de hooks, payloads e erros relevantes.
- Preferir `unknown` e narrowing a `any`.
- Usar unions discriminadas para estados mutuamente exclusivos e transições complexas.
- Evitar `as`, `!` e tipos excessivamente amplos; validar a origem da incerteza.
- Não duplicar tipos gerados do Supabase sem criar tipo de domínio por transformação explícita.
- Manter props mínimas e semânticas; evitar objetos de configuração que aceitam combinações inválidas.
- Preservar inferência quando ela comunica o contrato com clareza.

## Formulários

- Ler e aplicar [forms-and-feedback.md](forms-and-feedback.md) para o contrato completo de validação, máscaras, foco, loading e toast.
- Usar React Hook Form para estado e interação do formulário e Zod para contrato validável.
- Manter valores iniciais, schema e payload de submissão coerentes.
- Definir comportamento de loading, erro por campo, erro global, sucesso e reenvio.
- Impedir submissão duplicada quando aplicável.
- Associar label, descrição e erro ao campo; mover foco para o primeiro erro quando útil.
- Não depender apenas de validação no cliente para regras de segurança ou integridade.

## Renderização e performance

Investigar nesta ordem:

1. remover estado e Effects redundantes;
2. localizar estado mais perto dos consumidores;
3. dividir regiões com responsabilidades diferentes;
4. evitar Context excessivamente amplo;
5. medir com profiler ou cenário reproduzível;
6. aplicar `memo`, `useMemo` ou `useCallback` somente na fronteira comprovada.

Não usar memoização para corrigir lógica instável. Confirmar dependências e custo de comparação. Considerar paginação ou virtualização para listas grandes e code-splitting para fronteiras de rota ou módulos pesados.

## Acessibilidade e experiência

- Preferir elemento HTML semântico a simulação com `div` e ARIA.
- Garantir nome acessível, label, foco visível e operação por teclado.
- Restaurar ou mover foco conscientemente em diálogos, menus e mudanças de rota.
- Anunciar feedback assíncrono importante sem gerar ruído.
- Não comunicar estado apenas por cor.
- Preservar contraste, zoom, redução de movimento e layout responsivo aplicáveis.
- Definir loading, vazio, erro, sucesso, parcial e ação de recuperação.

## Segurança frontend

- Nunca colocar secret, service role ou credencial privilegiada no bundle.
- Tratar dados e HTML externos como não confiáveis; evitar `dangerouslySetInnerHTML` ou sanitizar na fronteira correta.
- Não usar ocultação de botão como autorização.
- Evitar registrar tokens, dados pessoais ou payloads sensíveis.
- Validar redirect e URLs externas antes de navegar.

## Testes

Escolher a camada mais barata que prove o comportamento:

- testar função pura para transformação, reducer e regra determinística;
- testar componente com Testing Library por papel, nome e interação visível;
- testar hook dentro de provider realista quando cache, contexto ou ciclo de vida forem relevantes;
- mockar a fronteira externa, não detalhes internos do componente;
- usar E2E para jornada crítica, integração entre rotas e regressão de alto impacto.

Cobrir sucesso e a falha mais provável. Adicionar casos de concorrência, retry, permissão, vazio ou acessibilidade quando fizerem parte do risco. Evitar snapshots grandes e asserts sobre implementação.

## Revisão arquitetural

- A árvore de componentes reflete responsabilidades reais?
- O estado é mínimo, não contraditório e possui owner claro?
- Context, reducer e custom hooks têm necessidade demonstrável?
- Componentes não acessam dados remotos diretamente?
- A camada de API e o hook possuem fronteiras proporcionais à complexidade?
- Queries, mutações e invalidações mantêm cache coerente?
- Effects sincronizam sistemas externos e possuem cleanup?
- Componentes reutilizados mantêm semântica e acessibilidade?
- A mudança evita dependências circulares e barrels que escondem ciclos?
- O escopo não inclui migração estrutural sem benefício para a entrega?

## Verificação antes de concluir

1. Executar testes dos arquivos e fluxos alterados.
2. Executar `npm run lint` quando o alcance permitir.
3. Executar `npm test` e `npm run build` para mudanças transversais ou antes de entrega de maior risco.
4. Verificar rotas, permissões, imports e console nos fluxos afetados.
5. Informar comandos executados, falhas preexistentes e validações não realizadas.

Não corrigir falhas alheias silenciosamente. Se uma falha impedir evidência da mudança, separar o diagnóstico e comunicar o bloqueio.
