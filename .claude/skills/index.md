# Catálogo de skills

Este arquivo mapeia as skills locais deste repositório, que vivem em `.claude/skills/<nome>/SKILL.md` — o diretório de descoberta de skills de projeto do Claude Code.

Como usar:

- **O usuário** invoca uma skill digitando `/<nome>`, por exemplo `/create-sdd-spec`.
- **O agente** carrega uma skill pela ferramenta `Skill`, usando o nome exato do frontmatter.
- A descoberta é automática: o Claude Code lê o `name` e a `description` de cada `SKILL.md` e aciona a skill quando a tarefa combina com a descrição. Não é preciso citar este índice.

## Skills disponíveis

| Skill | Responsabilidade | Usar quando |
| --- | --- | --- |
| [`refine-agile-story`](./refine-agile-story/SKILL.md) | Transformar contexto mínimo em histórias ágeis breves, claras e testáveis, refinando apenas lacunas bloqueantes. | Ao preparar cards para Trello, Jira, GitHub Boards ou ferramentas semelhantes a partir de ideias, features, bugs, melhorias ou tarefas técnicas. |
| [`create-sdd-spec`](./create-sdd-spec/SKILL.md) | Refinar o contexto de uma task e produzir uma especificação SDD interativa, implementável e testável, sem alterar o código. | Antes da implementação de features, bugs, integrações ou mudanças arquiteturais que precisem de requisitos, decisões técnicas, edge cases, riscos e critérios de aceite. |
| [`flow-feature`](./flow-feature/SKILL.md) | Orquestrar localmente uma issue do refinamento ao Draft PR com estado durável no GitHub e implementação isolada. | Ao executar, continuar ou fazer preflight do fluxo completo de uma issue, preservando os gates de contexto, SDD e revisão humana; ou no modo refinar, que encerra na história refinada. |
| [`apply-clean-code`](./apply-clean-code/SKILL.md) | Aplicar princípios de Clean Code com julgamento contextual e preservação de comportamento. | Ao escrever, alterar, refatorar, revisar ou explicar código com foco em legibilidade, manutenibilidade, qualidade interna, testes ou code smells. |
| [`backend-supabase-senior`](./backend-supabase-senior/SKILL.md) | Orientar decisões e implementações de backend e Supabase com segurança RLS-first. | Banco de dados, migrations, RLS, auth, permissões, storage, edge functions, secrets, webhooks, integrações, modelagem ou performance de queries. |
| [`frontend-react-senior`](./frontend-react-senior/SKILL.md) | Orientar implementação frontend React/TypeScript com foco em arquitetura, performance e manutenção. | Componentes, páginas, rotas, estado, React Query, formulários, hooks, code-splitting, refatoração ou acessibilidade no código. |
| [`ui-ux-avancado`](./ui-ux-avancado/SKILL.md) | Refinar fluxos e experiências de uso com clareza, eficiência e baixo atrito. | Navegação, hierarquia de informação, layouts, formulários, tabelas, filtros, estados de tela, onboarding, microinterações ou usabilidade. |
| [`design-system`](./design-system/SKILL.md) | Descobrir e defender o design system do projeto: paleta fechada, tokens, tipografia, forma e toque. | Cores, tipografia, tokens, tema, dark mode, espaçamento, raios, alvos de toque, shadcn, componentes, selos de status, ícones ou padronização visual. |
| [`refactor-code-safely`](./refactor-code-safely/SKILL.md) | Refatorar escopo delimitado sem alterar comportamento observável nem contratos. | Ao reorganizar internals, simplificar estrutura ou reduzir dívida técnica num arquivo, módulo ou diff indicado pelo usuário. |
| [`supabase`](./supabase/SKILL.md) | Guia oficial da Supabase para Database, Auth, Edge Functions, Realtime, Storage, CLI e depuração. | Em qualquer tarefa que toque um produto Supabase, `supabase-js`, `@supabase/ssr`, sessão, JWT, CLI ou logs. |
| [`supabase-postgres-best-practices`](./supabase-postgres-best-practices/SKILL.md) | Boas práticas de Postgres mantidas pela Supabase, válidas para Postgres em qualquer lugar. | Antes de criar ou alterar tabela, tipo, índice, policy, trigger, função SQL ou migration, e ao diagnosticar query lenta, lock ou timeout. |
| [`vercel-react-best-practices`](./vercel-react-best-practices/SKILL.md) | Regras de performance de React e Next.js da engenharia da Vercel. | Ao escrever, revisar ou refatorar componentes, data fetching, bundle e re-renders. |

## Combinações comuns

| Cenário | Skills sugeridas |
| --- | --- |
| Criar ou refinar um card curto para o backlog | `refine-agile-story`. |
| Refinar uma feature antes de implementá-la | `create-sdd-spec` e, conforme o domínio, uma ou mais skills especializadas abaixo. |
| Executar uma issue localmente do refinamento ao Draft PR | `flow-feature`, que coordena contexto, refinamento, SDD e as skills técnicas pertinentes. |
| Refinar o card de uma issue e parar por aí | `flow-feature` no modo refinar, que persiste a história e o size no GitHub sem gerar SDD nem código. |
| Escrever, refatorar ou revisar código com foco em manutenibilidade | `apply-clean-code` e a skill técnica do domínio afetado. |
| Nova tela ou reformulação de fluxo | `create-sdd-spec`, `ui-ux-avancado`, `design-system` e `frontend-react-senior`. |
| Feature full-stack com Supabase | `create-sdd-spec`, `backend-supabase-senior` e `frontend-react-senior`. |
| Padronização visual de componentes existentes | `design-system`, `ui-ux-avancado` e `frontend-react-senior`. |
| Mudança de dados sensíveis ou permissões | `create-sdd-spec` e `backend-supabase-senior`. |

## Manutenção do catálogo

Ao adicionar, renomear ou remover uma pasta de skill, atualizar este índice para manter os nomes, links e escopos sincronizados com o frontmatter do respectivo `SKILL.md`.

Requisitos de cada pasta de skill:

- `SKILL.md` obrigatório, com frontmatter contendo `name` (kebab-case, igual ao nome da pasta) e `description` em uma linha, escrita para que o agente saiba **quando** acionar a skill.
- `references/`, `evals/` e outros arquivos auxiliares são opcionais e carregados sob demanda via links relativos dentro do `SKILL.md`.
- `agents/openai.yaml`, quando presente, é metadado de interface do Codex. O Claude Code ignora esse arquivo; ele fica mantido apenas para portabilidade.

As skills deste diretório são agnósticas de projeto: não presumem produto, empresa, stack nem paleta. Cada uma descobre as convenções do repositório em que roda. Ao editá-las, manter essa propriedade — contexto específico de um produto pertence ao `CLAUDE.md` do projeto ou a uma skill própria de contexto, não a estas.
