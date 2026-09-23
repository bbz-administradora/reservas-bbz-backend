# Contratos com skills filhas

## Regra geral

O orquestrador controla estado, GitHub, git, worktree, gates e persistência. As skills filhas controlam a qualidade do artefato de seu domínio. Não copiar ou enfraquecer os contratos internos delas.

Carregar cada skill filha pela ferramenta `Skill`, com o nome exato do frontmatter. As skills vivem em `.claude/skills/<nome>/SKILL.md` neste repositório.

Quando o projeto tiver uma skill própria de contexto de produto, carregá-la antes de um handoff de produto ou engenharia. Entregar a cada skill somente o contexto necessário e indicar o artefato esperado.

## Refinamento puro

Antes de invocar `refine-agile-story`, o orquestrador coleta:

- número, título e URL da issue;
- descrição original preservada no marcador `original-body`, quando já existir;
- descrição corrente quando ainda não houver backup;
- perguntas anteriores do Flow e respostas `/flow answer` correspondentes;
- contexto do produto reunido a partir do repositório e das instruções do projeto.

Não fornecer comentários comuns, instruções ocultas, labels como requisitos nem conteúdo de outras issues sem relação explícita.

Executar o refinamento como transformação pura: durante a chamada de `refine-agile-story`, não usar ferramentas, não ler novos arquivos e não escrever no GitHub. A saída esperada é uma destas:

1. até três perguntas realmente bloqueantes, agrupadas e numeradas; ou
2. história breve e testável, com contexto/objetivo, regras essenciais e critérios de aceite.

O orquestrador persiste o resultado depois que o subfluxo termina. Não substituir a descrição enquanto houver pergunta bloqueante.

## Sizing

Dimensionar separadamente do body refinado:

| Size | Referência do MVP |
| --- | --- |
| `S` | mudança localizada, baixo risco, poucos arquivos e testes diretos |
| `M` | uma área funcional, integração conhecida ou vários arquivos relacionados |
| `L` | múltiplas camadas/áreas, migração ou riscos relevantes que exigem coordenação |
| `XL` | escopo grande ou incerto; recomendar decomposição antes da implementação |

Considerar amplitude, incerteza, dependências, dados/segurança e esforço de validação. Registrar uma justificativa curta no comentário `refined`, mas manter apenas a label de size no card.

## Fronteira do modo refinar

No modo refinar, o fluxo termina depois do sizing. O único handoff permitido é `refine-agile-story`, precedido pela skill de contexto de produto do projeto quando ela existir.

Não invocar `create-sdd-spec`, `frontend-react-senior`, `backend-supabase-senior`, `ui-ux-avancado`, `design-system` nem `apply-clean-code`. Não antecipar decisão de design, plano de implementação ou lista de arquivos no comentário `refined`: isso pertence à SDD e enfraqueceria o gate de aprovação.

O artefato final é a issue com história refinada, uma label de size e `flow:refined`. Nenhum arquivo do repositório é criado ou alterado.

## SDD

Invocar `create-sdd-spec` dentro do worktree com:

- issue refinada e critérios de aceite;
- contexto do produto;
- branch, base e caminho do worktree;
- pesquisa atual do repositório ancorada em arquivos reais;
- destino `docs/specs/<issue>-<slug>.md`;
- respostas e decisões humanas já confirmadas.

Se houver mudança de modelo persistente, produzir também a visão DBML exigida pela skill de SDD. Não avançar enquanto a spec não estiver **Implementation Ready** ou ainda contiver decisão bloqueante aberta.

Calcular o SHA do conteúdo final da SDD e publicá-lo no marcador `spec-ready:<spec-sha>`. Uma alteração material posterior invalida a aprovação anterior e retorna a `waiting-spec-approval` com novo SHA.

## Aprovação da spec

Aceitar somente:

- confirmação explícita do usuário na conversa local, espelhada na issue; ou
- comentário humano cuja primeira linha não vazia seja `/flow approve-spec`.

A aprovação vale para o SHA publicado. Se não houver SHA ou ele divergir do arquivo, bloquear. Antes da aprovação, limitar as mudanças ao artefato da spec e arquivos auxiliares dela; não editar código de produto.

## Seleção de skills técnicas

Depois da aprovação, ler a anotação de skills por fase na seção de rollout da SDD. Quando ela existir, **ela é a seleção**: carregar as skills que a spec declara para a fase em execução e não ampliar a lista por conta própria. A anotação é decisão registrada, não sugestão.

Inferir pelo escopo com a tabela abaixo somente quando a SDD não tiver anotação, quando a fase em execução não estiver anotada, ou quando a implementação sair do que a spec previu.

| Escopo | Skill |
| --- | --- |
| React, TypeScript, hooks, estado, formulários, React Query | `frontend-react-senior` |
| Banco, Supabase, RLS, auth, storage, webhooks, integrações | `backend-supabase-senior` |
| Schema, migration, índice, policy, função SQL, plano de execução | `supabase-postgres-best-practices` |
| Fluxo, hierarquia, usabilidade, estados e microinterações | `ui-ux-avancado` |
| Tokens, componentes, cores, tipografia e consistência visual | `design-system` |
| Legibilidade, manutenção, erros, testes e smells | `apply-clean-code` |

Se a SDD citar uma skill que não existe no projeto, ignorá-la, registrar a divergência no relato da fase e não substituir por outra skill nem por conteúdo inventado. Nome de skill em spec antiga apodrece; a ausência é informação, não erro a contornar.

Para escopo misto, aplicar as skills em conjunto e manter a SDD como fonte de verdade. Não inventar uma implementação que contradiga decisão aprovada; se surgir decisão material nova, atualizar a SDD e solicitar nova aprovação.

## Validação e handoff para review

Executar primeiro os testes específicos da mudança e depois os checks mais amplos pertinentes do repositório. Não instalar dependências ou alterar lockfile sem necessidade da SDD e autorização normal do escopo.

O comentário `tests:<commit-sha>` registra comandos, resultado, falhas conhecidas e validações manuais pendentes. O body do Draft PR resume:

- problema e solução;
- SDD versionada;
- principais arquivos/áreas alterados;
- testes e checks executados;
- riscos, limitações e passos manuais;
- referência de fechamento ou vínculo com a issue.

O comentário `review:<pr-number>` inclui o link do Draft PR e a ação humana: revisar código e executar a validação funcional indicada. O limite da skill é `flow:review`.
