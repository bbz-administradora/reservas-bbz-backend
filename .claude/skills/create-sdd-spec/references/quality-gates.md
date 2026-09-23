# Gates de revisão por complexidade

Aplicar os gates cumulativamente: M inclui S; L inclui S e M; XL inclui todos. Ignorar itens claramente irrelevantes e registrar apenas omissões que poderiam parecer acidentais.

## Gate S — comportamento localizado

- O problema e o resultado esperado estão observáveis?
- O fluxo principal, estado vazio, loading e erro mudam?
- Valores inválidos, limites e duplicidade têm comportamento definido?
- Existe regressão provável em fluxo adjacente?
- Os critérios de aceite cobrem sucesso e a falha mais provável?
- A mudança pode ser validada com teste existente, teste novo ou E2E de navegador?
- Todo critério de aceite que descreve gesto de navegador tem arquivo E2E nomeado? Cenário manual é o resto, não o padrão.

## Gate M — múltiplos módulos ou contratos

- Responsabilidades entre componentes, hooks, serviços ou módulos estão claras?
- Contratos de entrada, saída, validação e erro estão definidos?
- Consumidores existentes e compatibilidade foram pesquisados?
- Concorrência, retry, cancelamento e idempotência são relevantes?
- Autenticação, autorização e exposição de dados mudam?
- Responsividade, acessibilidade, localização ou fuso afetam o fluxo?
- Testes unitários, de componente e E2E estão distribuídos de forma coerente, sem duplicar em navegador o que jsdom já prova?
- O que exige navegador está na camada certa do harness do projeto: camada isolada por padrão, camada integrada só para afirmação sobre persistência?
- Logs ou métricas são necessários para diagnosticar falhas?

## Gate L — dados, integrações ou rollout

- Modelo de dados, invariantes, índices e impacto de query estão definidos?
- Migration, backfill, consistência durante transição e rollback estão cobertos?
- Retenção, privacidade, auditoria e dados sensíveis foram avaliados?
- Timeouts, rate limits, indisponibilidade e falhas parciais de terceiros estão definidos?
- Webhooks ou filas exigem autenticação, deduplicação, ordenação ou reprocessamento?
- Compatibilidade retroativa e versionamento têm estratégia explícita?
- Rollout gradual, feature flag ou dual-read/write têm benefício superior ao custo?
- Métricas de saúde, alertas, owner e resposta operacional estão claros?
- Dependências entre equipes e sequência de entrega estão explícitas?

## Gate XL — arquitetura ou alto risco

- Alternativas arquiteturais reais foram comparadas com critérios explícitos?
- A decisão é reversível? Se não, quais evidências justificam o compromisso?
- Limites de domínio, ownership e contratos de longo prazo estão claros?
- Capacidade, escala, degradação e custo operacional foram estimados?
- Há plano de migração por fases com estados intermediários válidos?
- Blast radius, segurança, abuso e recuperação de desastre foram avaliados?
- Há critérios de pausa, rollback e sucesso mensurável por fase?
- Questões que exigem spike, ADR, prova de conceito ou validação externa estão atribuídas?

## Revisões direcionadas

Aplicar além do nível quando o domínio aparecer.

### Consistência entre fontes

- Código, testes, documentação, ticket e materiais fornecidos concordam sobre o comportamento atual e o desejado?
- Cada conflito material identifica as fontes, a decisão afetada e a resolução ou bloqueio?
- Fatos técnicos voláteis que sustentam decisões foram verificados em fonte atual?
- O código atual foi tratado como evidência do presente, não automaticamente como intenção futura?

### Frontend e experiência

- Navegação, foco, teclado, leitores de tela e contraste quando aplicáveis.
- Estados inicial, vazio, carregando, sucesso, erro, parcial, retry e cancelamento.
- Comportamento responsivo e preservação de estado.
- Feedback para ações lentas, destrutivas ou irreversíveis.
- Guarda de rota e permissão do módulo, quando a superfície for protegida: entrada autorizada, bloqueio do não autorizado e redirecionamento do não autenticado.
- Destino da escrita, quando a tela grava: em qual tabela a UI escreve, provado pelo registro de chamadas da camada mockada.

### Backend e segurança

- Limites de confiança, validação server-side e princípio do menor privilégio.
- Autorização por operação e recurso; RLS/policies quando aplicáveis.
- Segredos fora do cliente, sanitização de logs e trilha de auditoria.
- Idempotência, transações, corrida, integridade e comportamento sob retry.

### Identidade e permissões

- Método de identificação, criação de conta, primeiro acesso, recuperação, sessão e logout estão definidos?
- A matriz ação × perfil explicita o escopo de dados, em vez de somente permitir ou negar?
- Está definido quem cria o primeiro usuário privilegiado e quem pode conceder ou remover privilégios?
- Usuários sem organização, tenant, departamento ou vínculo obrigatório têm comportamento seguro definido?
- A autorização efetiva ocorre no servidor ou banco; controles do frontend são tratados somente como UX?

### Dados

- Estado atual e estado-alvo foram distinguidos usando migrations, schema e consumidores reais?
- Fonte de verdade, tipos, defaults, cardinalidade, nulabilidade e invariantes estão definidos?
- PKs, FKs, `ON DELETE`/`ON UPDATE`, uniques, checks, enums e índices relevantes estão explícitos?
- Nulabilidade, desnormalização, retenção e exclusão têm justificativa de negócio?
- Regras em trigger ou função e autorização por RLS/policies estão documentadas fora do DBML?
- Migration, backfill, compatibilidade durante a transição e rollback estão cobertos?
- Volume, paginação, impacto de query, reconciliação e reparo de inconsistências foram avaliados?
- Se o modelo mudou, SDD e DBML representam o mesmo estado-alvo e a visão está marcada como completa ou parcial?

### Ciclo de vida e estados

- Cada entidade com `status` possui estados e significado definidos?
- Transições permitidas, proibidas e terminais estão explícitas?
- Ator, precondição, efeitos colaterais e comportamento sob retry estão definidos por transição?
- Concorrência, cancelamento, expiração e recuperação de estado inválido foram avaliados?

### Importação e exportação

- Colunas, ordem, granularidade, encoding, separador, formatos de data/número e nome do arquivo estão definidos?
- Filtros aplicados, limites de volume e permissões alteram o conteúdo exportado?
- Validação, duplicidade, erro por linha, atomicidade e reprocessamento da importação estão definidos?
- Dados sensíveis, auditoria e prevenção de formula injection ou conteúdo malicioso foram avaliados?

### Integrações

- Contrato, autenticação, timeout, retry com backoff e circuit breaking quando necessário.
- Rate limit, deduplicação, ordenação e falhas parciais.
- Sandbox, mocks, observabilidade e procedimento de suporte.
- Política quando o terceiro estiver lento, indisponível ou retornar dados inválidos.
