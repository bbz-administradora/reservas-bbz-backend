# Catálogo operacional de refatorações

Selecionar técnicas pelo problema observado, não pelo desejo de aplicar um catálogo. Cada transformação deve melhorar entendimento ou custo de mudança e preservar comportamento observável.

## Sumário

1. [Compor funções e fluxo](#compor-funções-e-fluxo)
2. [Mover responsabilidades](#mover-responsabilidades)
3. [Organizar dados e contratos internos](#organizar-dados-e-contratos-internos)
4. [Simplificar chamadas e dependências](#simplificar-chamadas-e-dependências)
5. [Tratar duplicação](#tratar-duplicação)
6. [Refatorar React e TypeScript](#refatorar-react-e-typescript)
7. [Refatorar Supabase e backend](#refatorar-supabase-e-backend)
8. [Transformações de alto risco](#transformações-de-alto-risco)
9. [Critérios de parada](#critérios-de-parada)

## Compor funções e fluxo

| Sinal observado | Transformação candidata | Cuidado principal |
| --- | --- | --- |
| Bloco coeso exige explicação | Extrair função com nome de intenção | Não criar salto que esconda um fluxo já linear |
| Função delega sem acrescentar significado | Incorporar função | Não eliminar uma fronteira útil para teste ou volatilidade |
| Expressão densa mistura decisões | Introduzir variável explicativa ou extrair predicado | Preservar avaliação curta, ordem e custo |
| Temporário obscurece uma regra pura | Substituir temporário por consulta | Não recalcular operação cara ou instável |
| Muitos níveis de condição | Usar cláusulas de guarda ou decompor condição | Preservar precedência, efeitos e mensagens de erro |
| Etapas distintas compartilham um bloco | Separar fases e explicitar dados intermediários | Não criar pipeline abstrato sem necessidade |
| Loop acumula responsabilidades independentes | Separar ou extrair o corpo do loop | Verificar custo; duas passagens podem ser inadequadas em grande volume |

## Mover responsabilidades

- Mover função ou dado para o módulo que conhece a regra e protege seus invariantes.
- Extrair módulo, classe, componente ou hook quando surgir um conceito coeso com motivo próprio de mudança.
- Incorporar estrutura extraída quando ela apenas fragmentar a leitura.
- Ocultar delegação quando consumidores conhecem detalhes internos instáveis.
- Remover intermediário quando ele apenas repassa chamadas e não representa fronteira, política ou tradução.

Antes de mover, mapear dependências nos dois sentidos. Uma extração que exige muitos parâmetros, expõe estado interno ou cria imports circulares costuma indicar fronteira incorreta.

## Organizar dados e contratos internos

- Renomear símbolos para expressar domínio, unidade, estado e efeitos.
- Encapsular variável mutável quando isso centralizar invariantes ou escrita.
- Introduzir objeto de valor ou parâmetro somente quando os campos formarem um conceito estável.
- Separar dados derivados de estado armazenado e manter uma fonte de verdade.
- Substituir valor mágico por nome quando ele representar regra ou unidade real.
- Tornar ausência e estados inválidos explícitos pelos recursos idiomáticos da linguagem.

Evitar alteração em formato serializado, coluna, enum, payload ou tipo público. Essas mudanças exigem migração de contrato, não apenas refactor.

## Simplificar chamadas e dependências

- Remover parâmetro não usado depois de comprovar todos os consumidores.
- Separar operações selecionadas por flag quando elas tiverem intenções e efeitos distintos.
- Agrupar parâmetros apenas quando o grupo possuir semântica própria e recorrente.
- Introduzir função ou factory para concentrar construção complexa quando houver invariantes reais.
- Encapsular biblioteca externa quando for necessário traduzir semântica, validar dados ou limitar volatilidade.
- Remover wrapper genérico quando ele apenas replica a API subjacente.

Alterar assinatura pública, nome exportado ou payload requer estratégia de compatibilidade e autorização explícita.

## Tratar duplicação

1. Confirmar que os trechos representam o mesmo conhecimento.
2. Confirmar que tendem a mudar pela mesma razão.
3. Nomear o conceito compartilhado antes de extraí-lo.
4. Preservar variações legítimas sem parâmetros opcionais artificiais.
5. Manter duplicação temporária quando o conceito ainda estiver evoluindo.

Não usar DRY para unir coincidência textual, domínios diferentes ou fluxos com políticas independentes.

## Refatorar React e TypeScript

Combinar com `frontend-react-senior`.

- Extrair cálculo puro de componente quando isso melhorar teste e narrativa.
- Calcular estado derivado durante renderização em vez de sincronizá-lo por Effect.
- Manter evento causado por interação no handler correspondente.
- Aproximar estado do menor owner comum; elevar ou compartilhar apenas quando consumidores reais exigirem.
- Separar apresentação, coordenação da feature e acesso remoto quando a mistura criar motivos distintos de mudança.
- Extrair custom hook somente para lógica stateful reutilizável ou para uma responsabilidade nomeável; não usar hook para esconder qualquer bloco.
- Preservar props públicas, identidade de keys, ordem de hooks, query keys, semântica de cache, estados de loading/erro e DOM acessível.
- Não adicionar `useMemo`, `useCallback`, Context, reducer ou store sem custo, escala ou contrato de identidade que justifique.
- Não trocar `any` por cast amplo ou non-null assertion; melhorar a fronteira de tipos sem mentir ao compilador.

Validar interações e estados observáveis, não a árvore interna de componentes.

## Refatorar Supabase e backend

Combinar com `backend-supabase-senior`.

- Isolar tradução e validação na fronteira de APIs e integrações.
- Extrair regra pura de Edge Function quando isso permitir teste sem rede nem segredo.
- Centralizar autorização ou lógica SQL repetida somente com revisão de RLS, privilégios e risco de recursão.
- Reduzir round-trips e N+1 apenas com equivalência de resultado e ordem demonstrada.
- Preservar transação, atomicidade, locks, idempotência, timeout, retry e observabilidade.
- Evoluir schema de forma aditiva e faseada quando uma mudança de contrato for autorizada; nunca reescrever migration aplicada.
- Verificar `security definer`, `search_path`, owner e grants ao mover lógica para função SQL.
- Regenerar tipos a partir da fonte quando o schema mudar; não editar tipos gerados como origem da alteração.

Mudança de schema, RLS, policy, trigger ou payload deve ser tratada como alteração estrutural explícita, ainda que acompanhe um refactor.

## Transformações de alto risco

Aplicar somente com evidência e autorização proporcionais:

- substituir condicional por polimorfismo ou tabela de estratégias;
- trocar herança por composição ou remodelar hierarquias;
- introduzir camada arquitetural ou inverter dependências centrais;
- substituir tipo primitivo por modelo de domínio em fronteira pública;
- alterar sincronização, concorrência ou processamento assíncrono;
- trocar biblioteca, framework, persistência ou protocolo.

Procurar primeiro uma preparação compatível: testes de caracterização, extração de função pura, encapsulamento da fronteira ou adaptador pequeno. Se o benefício exigir mudança observável, abrir uma tarefa própria.

## Critérios de parada

Parar quando:

- o smell que motivou o trabalho foi removido ou reduzido de forma suficiente;
- o código comunica melhor sua intenção e ficou mais fácil de testar ou alterar;
- todos os passos restantes têm benefício apenas estético;
- o próximo passo amplia a superfície pública ou exige decisão não autorizada;
- a validação disponível não sustenta mais transformações com segurança.
