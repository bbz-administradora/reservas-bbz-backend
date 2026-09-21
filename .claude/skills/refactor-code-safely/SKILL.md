---
name: refactor-code-safely
description: Refatorar somente o código existente que o usuário indicar explicitamente, melhorando estrutura, organização, legibilidade, coesão e facilidade de manutenção sem alterar comportamento observável nem contratos. Usar quando o pedido mencionar refatorar, refactor, reorganizar internals, simplificar estrutura, reduzir dívida técnica ou aplicar o princípio do escoteiro em um arquivo, módulo, diff ou fluxo delimitado. Não usar para limpeza espontânea fora do escopo, revisão sem edição, implementação de feature ou correção que exija mudança funcional.
---

# Refatorar código com segurança

Deixar o contexto explicitamente tocado melhor do que foi encontrado, em incrementos pequenos e verificáveis. Tratar a preservação de comportamento como restrição central e a melhoria estrutural como objetivo. Parar antes que limpeza local se torne reescrita, mudança de contrato ou arquitetura especulativa.

## Combinar as skills certas

1. Usar `apply-clean-code` em toda refatoração como camada transversal de nomes, funções, módulos, erros, testes e aplicação sem dogma.
2. Usar `frontend-react-senior` ao tocar React, TypeScript de frontend, componentes, hooks, estado, Effects, formulários, React Query, rotas, acessibilidade ou performance.
3. Usar `backend-supabase-senior` ao tocar schema, SQL, migrations, RLS, auth, storage, Edge Functions, integrações, webhooks, triggers, índices ou queries.
4. Adicionar skills de design system ou UI/UX somente quando a refatoração realmente afetar apresentação ou experiência.

Tratar as skills especialistas e as instruções do repositório como restrições do refactor. Não duplicar suas regras nem usar esta skill para contorná-las.

## Delimitar antes de editar

1. Identificar o alvo explicitamente autorizado: símbolos, arquivos, módulo, diff ou fluxo.
2. Converter pedidos amplos em um primeiro recorte coeso e verificável. Se não houver fronteira segura, pedir ao usuário para escolher o recorte antes de editar.
3. Declarar internamente o problema estrutural concreto e o benefício esperado: reduzir ambiguidade, acoplamento, duplicação de conhecimento, mistura de responsabilidades, fluxo difícil ou custo de teste.
4. Excluir dívida adjacente sem relação direta. Aplicar o princípio do escoteiro apenas ao trecho tocado e às dependências indispensáveis para deixá-lo coerente.
5. Não misturar correção funcional, feature ou alteração de regra de negócio. Se uma delas for necessária, interromper o refactor neutro e obter autorização para tratá-la separadamente.

## Construir uma rede de segurança

Ler [references/contract-safety.md](references/contract-safety.md) antes de editar.

1. Ler instruções locais, estado do worktree, implementação, consumidores, tipos, testes e histórico relevante do alvo.
2. Inventariar entradas, saídas, efeitos, erros, ordem, nulabilidade, timing e contratos externos que devem permanecer iguais.
3. Executar a validação direcionada existente para registrar a linha de base quando viável.
4. Adicionar teste de caracterização antes da alteração quando o comportamento for importante, pouco documentado e insuficientemente protegido. Testar o contrato observável, não a forma interna que será alterada.
5. Classificar o risco. Limitar refactors de risco alto a passos menores ou não executá-los sem cobertura e autorização suficientes.

Não confundir ausência de teste com liberdade para mudar comportamento. Quando não for possível construir evidência suficiente, reduzir o alcance e declarar a limitação.

## Escolher a menor transformação útil

Ler somente as seções pertinentes de [references/refactoring-catalog.md](references/refactoring-catalog.md).

- Relacionar cada transformação a um smell observado e a um ganho verificável.
- Preferir renomear, extrair, mover, encapsular ou simplificar localmente antes de introduzir novas camadas.
- Remover duplicação somente quando representar o mesmo conhecimento e compartilhar motivo de mudança.
- Criar abstração apenas quando houver conceito estável, fronteira real ou pressão concreta de evolução e teste.
- Seguir os idiomas da linguagem, do framework e do repositório, mesmo quando diferirem de exemplos clássicos orientados a objetos.
- Preservar soluções menos elegantes quando uma transformação aumentar navegação, indireção, superfície pública ou risco sem benefício proporcional.

## Executar em passos pequenos

1. Fazer uma transformação conceitual por vez.
2. Manter o código compilável e os testes relevantes aprovados entre passos sempre que o custo permitir.
3. Preservar nomes públicos, assinaturas, formatos, rotas, permissões, ordem de efeitos e semântica de erros, salvo autorização explícita em uma tarefa separada.
4. Ajustar testes acoplados à implementação somente quando continuarem comprovando o mesmo comportamento. Nunca enfraquecer uma asserção para fazer o refactor passar.
5. Revisar cada extração ou movimento como leitor: o nome acrescenta significado, a coesão aumentou e ficou mais fácil localizar a regra?
6. Remover helpers, interfaces ou wrappers recém-criados quando apenas deslocarem complexidade.

## Aplicar o princípio do escoteiro com parcimônia

Aceitar uma melhoria adjacente somente quando todas forem verdadeiras:

- estiver no código já tocado ou for necessária para completar o refactor autorizado;
- preservar comportamento e contratos com risco baixo;
- tiver benefício claro de leitura, coesão ou segurança de mudança;
- puder ser validada pelo mesmo conjunto de verificações;
- não ampliar materialmente o diff nem esconder a intenção principal.

Caso contrário, registrar a oportunidade sem implementá-la. Parar quando o alvo estiver coerente, o ganho marginal cair ou o próximo passo exigir decisão de produto, contrato, migração ou arquitetura.

## Revisar contratos e validar

1. Inspecionar o diff inteiro e justificar cada linha pelo objetivo do refactor.
2. Comparar antes e depois nos contratos inventariados, incluindo casos de borda e falha.
3. Executar testes direcionados primeiro; ampliar para tipos, lint, integração e build conforme alcance e risco.
4. No frontend, verificar props públicas, DOM e acessibilidade observáveis, estado, Effects, query keys, cache, loading, erro e navegação afetados.
5. No backend, verificar schema, RLS, privilégios, payloads, idempotência, transações, concorrência, logs e performance relevante.
6. Distinguir regressão causada pelo diff de falha preexistente. Não corrigir a segunda fora do escopo.
7. Não afirmar que o comportamento foi preservado sem informar qual evidência sustenta essa conclusão.

## Guardrails

- Não alterar API pública, contrato de tipo, payload, evento, rota, persistência, permissão ou mensagem consumida externamente sob o rótulo de refactor neutro.
- Não reescrever migrations históricas nem editar código gerado ou vendorizado quando houver uma fonte geradora.
- Não substituir arquitetura estável por padrão, factory, interface, classe, hook ou camada sem pressão concreta.
- Não fazer refactor amplo junto de feature urgente, correção crítica ou mudança de dados; separar os diffs quando isso melhorar revisão e rollback.
- Não remover validação, autorização, observabilidade, tratamento de falha ou compatibilidade para reduzir linhas.
- Não otimizar sem evidência de custo nem piorar complexidade assintótica, quantidade de queries ou renderizações por conveniência estética.
- Não impor métricas universais de tamanho, complexidade, cobertura ou número de argumentos.

## Entregar

Informar de forma concisa:

- qual estrutura melhorou e por quê;
- quais arquivos e contratos foram afetados ou deliberadamente preservados;
- quais validações foram executadas e seus resultados;
- quais melhorias adjacentes foram deixadas de fora;
- quais limitações ou riscos permanecem quando a equivalência não pôde ser demonstrada completamente.
