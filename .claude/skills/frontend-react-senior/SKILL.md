---
name: frontend-react-senior
description: Atuar como desenvolvedor React e TypeScript sênior ao implementar, refatorar, revisar ou diagnosticar componentes, páginas, rotas, hooks, estado local ou compartilhado, Context, Effects, formulários, integrações com TanStack React Query, arquitetura frontend, testes, acessibilidade e performance. Usar também ao decidir componentização, reutilização, ownership de estado, fluxo de dados, organização de módulos e separação entre UI, regras da feature e acesso a APIs.
---

# Desenvolver frontend React

Produzir mudanças React corretas, coesas e compatíveis com o projeto. Planejar a menor arquitetura que sustente o comportamento pedido; não transformar preferências em regras universais nem usar abstrações como demonstração de sofisticação.

## Princípios

- Tratar componentes e hooks como unidades definidas por responsabilidade e motivo de mudança, não por tamanho arbitrário.
- Manter cada informação em uma única fonte de verdade e calcular valores derivados durante a renderização.
- Distinguir estado local de UI, formulário, URL, servidor, sessão e estado realmente compartilhado antes de escolher uma ferramenta.
- Preferir composição e fluxo explícito por props. Introduzir Context, reducer ou outra store somente quando o alcance e as transições justificarem.
- Usar Effects apenas para sincronizar React com sistemas externos. Manter eventos causados por interação nos handlers.
- Extrair reutilização depois de identificar um contrato estável; tolerar pequena duplicação quando a abstração criaria acoplamento ou opções artificiais.
- Medir antes de otimizar. Tratar memoização, virtualização e code-splitting como respostas a custo ou escala observáveis.
- Adaptar a solução à versão e às convenções verificadas no repositório. Não presumir APIs da versão mais recente do React.

## Workflow

### 1. Pesquisar antes de desenhar

1. Ler `package.json`, configuração TypeScript, scripts e arquivos diretamente relacionados.
2. Localizar componentes, hooks, tipos, queries, testes e consumidores semelhantes.
3. Verificar convenções do módulo, permissões, rotas e componentes do design system já disponíveis.
4. Preservar alterações existentes e não iniciar reorganização ampla fora do escopo.

Tratar o código atual como evidência do presente, não automaticamente como arquitetura ideal. Corrigir problemas locais quando necessário para a entrega; registrar dívida adjacente sem expandir silenciosamente a tarefa.

### 2. Modelar a mudança

Para mudanças não triviais, definir antes de editar:

- resultado observável e responsabilidades da árvore de componentes;
- entradas, eventos e fluxo unidirecional dos dados;
- inventário do estado, fonte de verdade e owner de cada valor;
- fronteiras entre apresentação, coordenação da feature e acesso remoto;
- estados inicial, carregando, vazio, sucesso, erro, parcial, retry e cancelamento aplicáveis;
- consumidores, rotas, permissões e testes potencialmente afetados.

Manter esse planejamento proporcional. Uma correção localizada não exige documento arquitetural.

### 3. Aplicar Challenge Mode

Antes de consolidar o desenho, responder:

- O novo estado pode ser derivado de props, estado existente, URL ou cache?
- Props, composição ou colocação mais próxima resolvem antes de Context?
- O componente ou hook proposto representa um conceito estável ou apenas move linhas?
- A camada adicional reduz acoplamento e melhora teste/reuso, ou somente aumenta navegação?
- O Effect sincroniza um sistema externo? Pode ser substituído por cálculo de renderização ou handler?
- A otimização responde a medição, volume conhecido ou contrato de identidade real?
- A solução menor preserva melhor as convenções e os consumidores existentes?

Se a proposta falhar a essas perguntas, simplificar antes de implementar.

### 4. Implementar por fronteiras coesas

- Manter UI declarativa e funções de renderização puras.
- Colocar regras puras em funções testáveis e lógica stateful reutilizável em custom hooks específicos.
- Separar chamadas remotas de componentes. Para features relevantes, preferir função de acesso tipada em `api/` e hooks de React Query em `hooks/`.
- Colocar componentes, hooks, API, schemas, tipos e testes junto da feature quando isso melhorar coesão. Não migrar módulos antigos apenas para uniformizar pastas.
- Reutilizar a biblioteca de componentes do projeto, componentes de domínio, permissões e utilitários existentes antes de criar variantes.
- Em todo formulário, validar campos obrigatórios, formatos e regras cruzadas; aplicar máscaras reutilizáveis a dados estruturados; mostrar erro inline acessível; focar o primeiro campo inválido; indicar loading no submit; impedir envio duplicado; e comunicar sucesso ou falha da ação com toast.
- Fazer mudanças incrementais e manter contratos públicos mínimos.

Ler [references/architecture-and-state.md](references/architecture-and-state.md) ao decidir componentes, estrutura de feature, state ownership, reducer ou Context.

Ler [references/effects-and-data.md](references/effects-and-data.md) ao trabalhar com Effects, custom hooks, Supabase, TanStack React Query, mutações, cache ou concorrência.

Ler [references/forms-and-feedback.md](references/forms-and-feedback.md) sempre que a tarefa criar ou alterar formulário, campo, máscara, validação, submissão ou feedback de ação.

### 5. Revisar qualidade e validar

Ler [references/quality-gates.md](references/quality-gates.md) ao implementar ou revisar código. Aplicar somente os gates afetados.

- Executar testes direcionados primeiro.
- Executar lint, testes mais amplos e build conforme alcance e risco.
- Não declarar comandos como aprovados quando não foram executados.
- Relatar decisões relevantes de componentização, estado e dados, validações executadas e riscos remanescentes.

## Limites entre skills

- Delegar identidade visual, tokens e consistência de componentes à `design-system`.
- Delegar fluxo, hierarquia de informação e usabilidade à `ui-ux-avancado`.
- Delegar schema, migrations, RLS, policies, secrets e enforcement de autorização à `backend-supabase-senior`.
- Tratar controles de permissão no frontend somente como experiência; a segurança efetiva deve permanecer no backend ou banco.

## Convenções do projeto

- Verificar a stack instalada antes de escrever qualquer linha: roteador, biblioteca de dados remotos, formulários, validação, biblioteca de componentes e CSS. Não presumir React Router, React Query, React Hook Form, Zod, shadcn/ui ou Tailwind porque são comuns; usar o que o `package.json` mostra.
- Usar os tipos gerados pelo backend e os tipos de domínio do projeto. Evitar `any`, casts amplos e non-null assertions sem evidência.
- Registrar novas permissões nos mecanismos existentes somente quando o módulo realmente introduzir uma capacidade protegida.
- Manter todo texto visível no idioma da interface, com ortografia e acentuação corretas e sem travessão longo: rótulo, placeholder, botão, coluna, estado vazio, validação e toast. Corrigir também os textos preexistentes do arquivo que a tarefa já está alterando, ajustando no mesmo commit os testes que casam por texto.
- Preservar rotas e lazy loading existentes; adicionar code-splitting onde a fronteira e o custo justificarem.
