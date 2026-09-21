---
name: create-sdd-spec
description: Descobrir, desafiar, pesquisar e especificar uma task antes da implementação, produzindo ou revisando uma SDD (Software Design Document) verificável e ancorada no repositório e, quando houver mudança de modelo persistente, uma visão DBML do estado-alvo. Usar para refinar ideias, tickets, features, bugs, integrações, mudanças de dados, segurança, performance ou arquitetura; esclarecer requisitos, edge cases, riscos, trade-offs e critérios de aceite; ou avaliar se uma spec está pronta para implementação. Não usar para implementar a funcionalidade.
---

# Criar especificação SDD

Transformar contexto incompleto em decisões explícitas e em uma spec implementável. Priorizar descoberta e evidência; o Markdown final é consequência desse trabalho.

## Limites

- Não implementar a funcionalidade nem editar código, configuração, schemas, migrations ou infraestrutura.
- Inspecionar o projeto somente de forma read-only.
- Não instalar dependências, executar formatadores, gerar artefatos de implementação nem causar efeitos externos.
- Trabalhar na conversa por padrão. Criar ou editar o arquivo da spec somente quando o usuário pedir explicitamente. Quando esse arquivo criar ou alterar modelo persistente, gerar ou atualizar o DBML companheiro como parte da mesma entrega, sem modificar o banco.
- Se o usuário pedir implementação durante este fluxo, explicar o limite da skill e pedir confirmação antes de encerrar a fase de especificação.
- Não inventar fatos. Identificar toda afirmação como confirmada, hipótese ou recomendação quando sua natureza não estiver óbvia.
- Não transformar recomendação opcional em requisito sem aprovação do usuário.

## Combinar as skills certas

Carregar a skill de domínio **antes** de derivar as decisões que ela governa, não depois de escrevê-las. Invocá-la pela ferramenta `Skill`, com o nome exato do frontmatter, sem resumir o conteúdo em vez de carregar.

| Carregar | Antes de derivar |
| --- | --- |
| `supabase-postgres-best-practices` e `backend-supabase-senior` | modelo, tabela, coluna, tipo, índice, migration, RLS, policy, trigger, função SQL, fila ou job |
| `frontend-react-senior` | arquitetura de componente, ownership de estado, fluxo de dados, hook, rota, React Query, acessibilidade ou performance de UI |
| `design-system` e `ui-ux-avancado` | superfície visível nova ou alterada: tela, layout, componente, filtro, tabela, estado de tela ou fluxo de uso |
| `apply-clean-code` | fronteira entre módulos, nome de contrato e limite de responsabilidade |

Verificar quais dessas skills existem no projeto antes de citá-las; ignorar as ausentes sem substituir por conteúdo inventado.

Não empilhar outra skill que defina procedimento próprio — `refactor-code-safely`, `refine-agile-story` e semelhantes disputam a ordem do trabalho com este fluxo. Tratar as skills de domínio como restrição da spec, nunca como fluxo paralelo.

Carregar uma skill de domínio não autoriza implementar. Os limites acima continuam valendo.

### Registrar a seleção na spec

A spec é que seleciona as skills técnicas da implementação. Anotar em cada fase de rollout quais skills governam aquela fase, para que o prompt de implementação não precise escolher de novo.

Anotar somente skills verificadas no projeto. Deixar explícito que elas entram como conformidade com decisões já registradas em Design técnico e em Decisões; reabrir decisão aceita exige evidência nova, não preferência de skill.

## Nomear a prova de navegador

Antes de especificar a prova de navegador, descobrir o que o projeto tem: diretório de testes E2E, runner configurado (Playwright, Cypress ou outro), README do harness, convenção de nome de arquivo e se existe separação entre uma camada isolada (dependências externas interceptadas, determinística e offline) e uma camada integrada (backend real, só para afirmação sobre persistência).

Se o projeto não tiver harness E2E, não inventar um: registrar a lacuna e propor a camada de teste que existe, ou o teste manual, com o motivo.

**Critério mecânico: critério de aceite cujo texto descreve gesto de navegador — abrir, clicar, filtrar, ordenar, rolar, recarregar, ver — nomeia um arquivo E2E na Estratégia de testes.** Nomear arquivo, como a seção de arquivos criados e alterados já faz, e não só a camada, seguindo a convenção de nome que o projeto já usa.

Quando houver as duas camadas, escolher pelo que o critério afirma:

| O critério afirma | Camada | Por quê |
| --- | --- | --- |
| a tela mostra, bloqueia, filtra, ordena, calcula | isolada | não depende de banco; fixture responde |
| a UI escreveu em tal recurso, ou não escreveu | isolada | o registro de chamadas prova o destino sem banco |
| o dado **persiste** — recarregar, limpar storage, reabrir | integrada | mock nenhum sustenta afirmação sobre o banco |

Manter a camada integrada mínima e justificar cada teste posto nela. A camada isolada é o padrão; mandar para a integrada o que caberia na isolada troca segundos determinísticos por minutos frágeis.

Quando um critério de navegador **não** puder virar E2E — depende de integração externa, de dado que só existe em produção, de gesto que o runner não alcança — dizer isso no critério, com o motivo. "Sem prova automatizada porque X" é registro; silêncio é dívida que reaparece no fim do rollout como CA sem prova.

## Princípios de decisão

1. Entender o problema antes de aceitar a solução sugerida.
2. Pesquisar o sistema antes de propor arquitetura.
3. Preferir a menor mudança que resolva a causa real.
4. Adaptar a profundidade ao risco, alcance e incerteza.
5. Tornar decisões, trade-offs e lacunas rastreáveis.
6. Especificar comportamentos observáveis, não intenções vagas.

## Estado vivo da conversa

Manter durante o refinamento:

- **Confirmado**: fatos verificados e decisões aceitas, com fonte quando relevante.
- **Hipóteses**: suposições ainda não verificadas, com impacto caso estejam erradas, responsável ou fonte de validação e contingência.
- **Recomendações**: propostas pendentes, cada uma com benefício, custo e alternativa.
- **Questões em aberto**: dúvidas, classificadas como bloqueantes ou não bloqueantes.

Ao exibir um checkpoint de estado, usar esses quatro blocos e omitir apenas blocos vazios. Registrar itens rejeitados ou adiados em **Confirmado** como fora de escopo, com destino, motivo e dependência quando houver. Não reabrir decisão aceita sem nova evidência ou conflito.

## Workflow

### 1. Fazer triagem

Se não houver contexto suficiente para identificar problema e resultado esperado, pedir o contexto e aguardar.

Reformular brevemente:

- problema e evidência disponível;
- resultado esperado e atores afetados;
- solução presumida, se houver;
- restrições e não objetivos já conhecidos.

Classificar provisoriamente a complexidade:

| Nível | Sinais predominantes |
| --- | --- |
| **S** | Mudança localizada, contrato estável, fácil reversão, baixo risco. |
| **M** | Mais de um módulo ou fluxo, algumas decisões técnicas, risco moderado. |
| **L** | Vários domínios, dados ou integrações, migração/rollout, impacto amplo. |
| **XL** | Mudança arquitetural ou transversal, alta incerteza, difícil reversão ou risco crítico. |

Usar o maior nível indicado por alcance, incerteza, risco e irreversibilidade. Reclassificar quando surgirem evidências. A classificação controla profundidade, não tamanho em páginas.

### 2. Pesquisar o repositório e reconciliar fontes

Pesquisar antes de propor ou validar arquitetura, componente, hook, serviço, endpoint, tabela, migration, evento ou padrão novo.

Investigar somente o necessário para responder:

- onde vive o comportamento atual;
- quais convenções e abstrações semelhantes já existem;
- contratos, tipos, dados e testes envolvidos;
- consumidores e impactos indiretos;
- restrições documentadas no projeto.

Considerar em conjunto código, testes, migrations, schema, documentação, tickets e materiais fornecidos. Comparar afirmações relevantes entre as fontes; não presumir que o código atual representa a intenção futura nem que o ticket descreve corretamente o comportamento existente. Quando houver conflito, registrar fontes, decisão afetada e resolução. Tratar conflito material não resolvido como questão bloqueante.

Começar por busca direcionada e ampliar conforme as evidências. Citar caminhos, símbolos ou trechos que sustentem decisões. Distinguir claramente ausência de evidência de evidência de ausência. Verificar externamente fatos técnicos voláteis somente quando eles sustentarem uma decisão material.

Se o repositório não estiver disponível ou não contiver a resposta, declarar a limitação. Tratar nomes e desenho interno como hipóteses; não apresentá-los como decisões confirmadas. Perguntar ao usuário somente o que não puder ser descoberto localmente e alterar materialmente a spec.

### 3. Executar Challenge Mode

Antes de consolidar a solução, tentar refutá-la:

- resolve a causa ou apenas o sintoma?
- existe mudança menor que entrega o mesmo resultado?
- algo existente pode ser reutilizado ou estendido?
- a complexidade adicionada corresponde a um risco real?
- qual é o custo de remover ou reverter a decisão?
- quais consumidores, permissões, dados ou operações são afetados indiretamente?
- o comportamento pode ser obtido sem novo padrão, dependência ou infraestrutura?

Não criar objeções artificiais. Expor apenas achados que alterem escopo, desenho, risco ou esforço.

Para cada recomendação material, registrar:

- **Recomendação**: decisão proposta;
- **Benefício**: problema ou risco que resolve;
- **Custo/trade-off**: complexidade e consequências;
- **Alternativa mínima**: opção mais simples plausível;
- **Evidência**: fato do projeto ou premissa que a sustenta.

Aplicar essa estrutura também a recomendações preliminares. Se custo, alternativa ou evidência ainda não forem conhecidos, declarar a lacuna em vez de omitir o campo.

### 4. Refinar em ciclos curtos

Em cada rodada:

1. Atualizar somente decisões e lacunas relevantes.
2. Recomendar uma opção quando houver evidência suficiente.
3. Fazer de uma a três perguntas relacionadas, priorizando as bloqueantes.
4. Explicar qual decisão cada pergunta destrava.
5. Aguardar antes de incorporar recomendações opcionais.

Não perguntar novamente o que já foi respondido. Não despejar a spec inteira após cada resposta. Quando uma escolha for de baixo risco, reversível e não bloqueante, registrar uma recomendação em vez de interromper o fluxo desnecessariamente.

### 5. Desenhar e revisar

Especificar no nível necessário:

- responsabilidades, fluxo de dados e contratos;
- estados, regras de negócio e invariantes;
- falhas, recuperação e comportamento degradado;
- autenticação, autorização e dados sensíveis;
- compatibilidade, migração e reversibilidade;
- testes e evidências de conclusão, incluindo qual critério de aceite se prova no navegador e em qual arquivo E2E;
- rollout e observabilidade quando o risco justificar.

Ler [references/quality-gates.md](references/quality-gates.md) e aplicar apenas a revisão correspondente à complexidade e aos domínios afetados. Não adicionar cerimônia sem valor.

Quando a tarefa criar ou alterar dados persistentes, ler [references/database-modeling.md](references/database-modeling.md), distinguir estado atual de estado-alvo e definir estrutura, segurança, migração e revisão visual antes de consolidar.

### 6. Aplicar Definition of Ready

Antes da versão final, declarar:

```text
Implementation Ready: SIM | NÃO

Bloqueios:
- ...
```

Marcar **SIM** somente quando:

- problema, resultado, escopo e fora de escopo estiverem claros;
- requisitos e critérios de aceite forem observáveis e não contraditórios;
- decisões críticas estiverem confirmadas ou explicitamente delegadas à implementação sem risco relevante;
- o desenho estiver ancorado no repositório, ou as limitações de pesquisa estiverem visíveis;
- conflitos materiais entre fontes estiverem resolvidos ou declarados como bloqueios;
- riscos aplicáveis de dados, segurança, falha, compatibilidade e operação tiverem tratamento;
- quando houver mudança persistente, SDD e DBML representarem o mesmo estado-alvo e decisões não expressáveis em DBML permanecerem documentadas;
- não restarem questões bloqueantes.

Uma hipótese aceita conscientemente pode permanecer, desde que tenha responsável/fonte de validação, impacto e plano de contingência. Nesse caso, explicar por que ela não bloqueia.

Se o gate falhar, produzir uma spec provisória útil e listar o mínimo necessário para torná-la pronta. Não declarar conclusão por conveniência.

### 7. Consolidar a spec

Pedir aprovação para consolidar quando o gate estiver claro e não houver bloqueios. Ao produzir a versão final, ler [references/spec-template.md](references/spec-template.md), selecionar somente as seções relevantes e preservar rastreabilidade entre requisitos, desenho, testes e critérios de aceite.

Se o usuário pedir criação ou edição do arquivo da spec e houver modelo persistente novo ou alterado, gerar ou atualizar no mesmo diretório um `.dbml` com o mesmo nome-base da spec, salvo convenção existente no projeto. Seguir [references/database-modeling.md](references/database-modeling.md). Informar se a visão é completa ou parcial e resumir tabelas, campos e relações adicionados, alterados ou removidos. Não gerar DBML quando o modelo não mudar.

Materializar os arquivos conforme a seção 8.

Se o usuário pedir revisão de uma SDD existente, ler o documento inteiro e executar o mesmo workflow. Antes de editar, mapear a propagação da mudança por requisitos, dados, permissões, contratos, testes, riscos, rollout e aceite; atualizar o que foi afetado, remover riscos obsoletos e preservar o detalhe de itens adiados. Incrementar versão ou data quando o documento já usar esses metadados. Não limitar a revisão à seção citada pelo pedido.

### 8. Nomear e localizar os arquivos da spec

Aplicar somente quando o usuário tiver pedido criação ou edição do arquivo.

**Formato preferido: um diretório por card.**

```text
docs/specs/<numero-do-card>-<slug>/
  <slug>.md
  <slug>.dbml        # apenas quando o modelo persistente mudar
```

O diretório carrega o número do card e o slug; os arquivos internos usam somente o slug. Manter tudo o que pertence à spec nesse diretório, incluindo anexos futuros.

**Descobrir o número do card.** Procurar, nesta ordem:

1. número informado pelo usuário no pedido;
2. primeiro grupo numérico do nome da branch atual, que costuma seguir padrões como `feature/283-...`, `283-...`, `fix/283-...` ou `chore/283-...`;
3. número presente em issue, ticket ou URL citada na conversa.

Derivar o slug do resultado da spec em kebab-case curto, não do nome da branch — a branch descreve o trabalho, a spec descreve o resultado.

**Quando nenhum número for localizado**, não escolher sozinho e não criar arquivo antes de resolver: perguntar em uma única mensagem se o usuário prefere informar um número ou nome, ou usar o nome proposto pela skill, já apresentando a proposta concreta de diretório e arquivo. Aguardar a resposta.

**Convenção existente do projeto prevalece sobre a preferência acima.** Inspecionar o diretório de specs antes de criar. Se o projeto tiver convenção diferente e consistente, seguir a convenção e registrar a divergência em uma linha. Specs antigas em formato diferente não são motivo para abandonar o formato de diretório em specs novas, e não devem ser movidas ou renomeadas sem pedido explícito.

**Estabilidade de caminho.** Ao revisar spec existente, editar no local onde ela está. Não renomear, mover nem duplicar arquivo por preferência de formato; um caminho estável preserva links, histórico e referências em PRs e issues.

## Padrão de qualidade

- Usar linguagem precisa e testável; evitar “adequado”, “rápido”, “intuitivo” ou “tratar erros” sem medida ou comportamento.
- Separar requisitos de detalhes de implementação.
- Citar evidência do repositório perto da decisão que ela sustenta.
- Expor conflitos entre fontes e sua resolução; não ocultar contradições sob uma redação conclusiva.
- Tornar alternativas descartadas e seus motivos visíveis.
- Usar tabelas ou diagramas somente quando reduzirem ambiguidade real.
- Tratar DBML como visão derivada do estado-alvo, nunca como substituto de migration, RLS, policies, triggers, rollout ou rollback.
- Manter tasks S enxutas; aprofundar L/XL onde custo de erro e irreversibilidade forem maiores.
- Encerrar cada rodada com a decisão ou resposta necessária do usuário.
