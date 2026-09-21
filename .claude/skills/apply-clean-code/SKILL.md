---
name: apply-clean-code
description: Aplicar princípios de Clean Code com julgamento contextual ao escrever, alterar, refatorar, revisar ou explicar código. Usar quando a tarefa mencionar Clean Code, Uncle Bob, legibilidade, manutenibilidade, simplificação, qualidade interna, dívida técnica, code smells, nomes, funções, comentários, tratamento de erros, testes, classes, fronteiras, concorrência ou refinamento incremental; também usar em auditorias de código que peçam achados concretos sem mudança de comportamento.
---

# Aplicar Clean Code

Melhorar a facilidade de entender, alterar e testar o código sem transformar heurísticas em regras cegas. Preservar correção, contratos e comportamento salvo quando o pedido autorizar mudança funcional.

## Preparar o trabalho

1. Classificar o pedido:
   - **Implementar**: escrever ou alterar comportamento solicitado.
   - **Refatorar**: melhorar estrutura preservando comportamento observável.
   - **Revisar**: identificar problemas e recomendar correções sem editar.
   - **Explicar**: ensinar ou comparar princípios sem modificar arquivos.
2. Respeitar a autorização do modo. Não converter revisão ou diagnóstico em edição.
3. Ler em [references/principles.md](references/principles.md) a postura inicial, a seção temática afetada e “Como aplicar sem dogma”. Em auditoria abrangente ou pedido para aplicar “todos os princípios”, ler a referência inteira.
4. Para revisão, auditoria ou busca de smells, ler também [references/review-checklist.md](references/review-checklist.md) e o catálogo da seção 15 da referência principal.
5. Ler instruções do repositório e pesquisar convenções, testes, contratos e consumidores relevantes antes de propor uma estrutura nova.
6. Combinar esta skill com skills de linguagem, framework, domínio, segurança ou produto quando acionadas. Usar esta skill como camada transversal de qualidade, não como substituta do conhecimento especializado.

Usar o sumário da referência para carregar somente o necessário em tarefas focadas: nomes/funções/comentários/formatação (seções 2–5), modelagem/erros/fronteiras (6–8), testes (9), módulos/arquitetura (10–12), concorrência (13) e refatoração ampla (14–16).

## Ordenar prioridades

Resolver conflitos nesta ordem:

1. Segurança, privacidade e integridade de dados.
2. Correção e requisitos explícitos do usuário.
3. Contratos públicos e comportamento compatível.
4. Instruções e convenções verificadas no repositório.
5. Testabilidade, clareza e facilidade de mudança.
6. Simplicidade estrutural e consistência estética.

Tratar cada princípio como heurística. Manter uma exceção quando houver motivo concreto — por exemplo API pública, restrição de framework, desempenho medido, interoperabilidade ou código gerado — e registrar o trade-off.

## Executar mudanças

### 1. Estabelecer a linha de base

- Localizar o comportamento, os testes e os consumidores afetados.
- Identificar mudanças preexistentes e não sobrescrevê-las.
- Executar a validação mais direcionada disponível quando isso ajudar a distinguir falhas preexistentes de regressões.
- Se não houver testes suficientes, considerar teste de caracterização antes de refatorar comportamento de risco.

### 2. Definir o menor incremento coerente

- Explicar internamente qual problema concreto será resolvido: ambiguidade, responsabilidade misturada, acoplamento, duplicação real, erro oculto ou dificuldade de teste.
- Evitar ampliar o escopo para “limpar” arquivos adjacentes sem relação com a tarefa.
- Preferir passos pequenos, revisáveis e reversíveis a reescritas extensas.
- Separar mudança de comportamento de refatoração sempre que isso melhorar a verificação.

### 3. Aplicar os princípios

- Escolher nomes que revelem intenção e pertençam ao vocabulário do domínio.
- Manter funções focadas, com fluxo legível e nível de abstração coerente.
- Tornar dependências e efeitos colaterais explícitos.
- Modelar objetos, dados e fronteiras conforme a responsabilidade real, sem abstração prematura.
- Tratar erros perto da fronteira capaz de acrescentar contexto ou decidir recuperação.
- Usar comentários apenas para contexto que o código não consegue expressar adequadamente.
- Manter testes legíveis, determinísticos e orientados a comportamento.
- Remover duplicação somente quando existir um conceito compartilhado e uma razão comum para mudar.

### 4. Revisar o diff

- Confirmar que cada alteração pertence ao resultado solicitado.
- Procurar mudanças acidentais de contrato, semântica, ordem, nulabilidade, concorrência ou tratamento de erro.
- Verificar se extrações e abstrações reduziram carga cognitiva de fato.
- Remover compatibilidade improvisada, comentários redundantes e helpers usados uma única vez quando eles não acrescentarem significado.

### 5. Validar proporcionalmente ao risco

- Executar testes direcionados primeiro; ampliar para tipos, lint, integração ou build conforme o alcance.
- Não corrigir falhas preexistentes fora do escopo; relatá-las separadamente.
- Não alegar preservação comprovada quando a validação não puder ser executada.
- Para concorrência, incluir repetição, diferentes ordens de execução e ferramentas específicas disponíveis no projeto quando aplicável.

## Conduzir revisão de código

- Priorizar defeitos, regressões, riscos de segurança, contratos frágeis e dificuldades reais de manutenção.
- Vincular cada achado a arquivo, linha ou símbolo e explicar a consequência observável.
- Distinguir bug, risco, smell e preferência. Não elevar gosto pessoal a defeito.
- Evitar listas mecânicas de violações; consolidar sintomas que tenham a mesma causa.
- Ordenar por impacto e confiança. Usar o formato detalhado de [references/review-checklist.md](references/review-checklist.md).
- Se não houver achados, declarar isso e informar lacunas de teste ou validação ainda relevantes.

## Guardrails

- Não impor contagens universais de linhas, argumentos, cobertura ou complexidade.
- Não extrair funções ou classes apenas para reduzir tamanho; exigir melhora de nome, coesão, teste ou reutilização conceitual.
- Não aplicar DRY a coincidências superficiais ou código que evolui por razões diferentes.
- Não esconder alteração funcional dentro de uma refatoração descrita como neutra.
- Não substituir clareza por padrões, camadas, interfaces ou factories sem pressão de mudança concreta.
- Não editar artefatos gerados ou vendorizados quando a fonte geradora puder ser alterada.
- Não reescrever migrations históricas já aplicadas; seguir a estratégia de evolução do projeto.
- Não enfraquecer validação, autorização, logs essenciais ou tratamento de falhas para deixar o fluxo “mais limpo”.

## Entregar o resultado

Para implementação ou refatoração, informar:

- resultado observável;
- arquivos relevantes alterados;
- validações executadas e resultado;
- exceções conscientes, limitações ou riscos remanescentes.

Para revisão, apresentar primeiro os achados ordenados por prioridade e depois um resumo curto. Para explicação, apresentar conceito, trade-off e exemplo mínimo quando isso ajudar.
