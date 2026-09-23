# Template adaptativo de SDD

Usar este arquivo para consolidar a spec final. Omitir seções sem relevância; não preenchê-las com texto genérico. Para uma task S, preferir resumo, escopo, requisitos, desenho, testes, aceite e questões abertas. Adicionar as demais conforme risco e complexidade.

## Conteúdo

- Template Markdown: metadados; resumo; contexto; objetivos; escopo; requisitos; fluxos; design; falhas; testes; aceite; rollout; riscos; decisões; questões abertas; Definition of Ready.
- Regras de rastreabilidade.

```markdown
# [Título orientado ao resultado]

Status: Provisória | Implementation Ready
Complexidade: S | M | L | XL
Responsável: [quando conhecido]
Versão: [quando o documento tiver ciclo de revisão]
Atualizado em: [AAAA-MM-DD]

## 0. Pontos para revisão

[Para M/L/XL ou quando houver decisões materiais: listar de um a três pontos que mais merecem validação, hipóteses de maior impacto, conflitos resolvidos e mudanças no modelo de dados. Omitir quando não agregar.]

## 1. Resumo

[Problema, solução escolhida e resultado observável.]

## 2. Contexto e evidências

[Comportamento atual, usuários afetados, sinais do problema e evidências do repositório.]

### Conflitos entre fontes

| Fontes | Divergência | Decisão afetada | Resolução/status |
| --- | --- | --- | --- |
| [ticket, código, documentação...] | [o que não coincide] | [impacto] | [resolvido ou bloqueante] |

## 3. Objetivos e métricas

- OBJ-1: [resultado verificável]

## 4. Fora de escopo

| Item | Destino | Motivo ou dependência |
| --- | --- | --- |
| [exclusão explícita] | Descartado / Próxima entrega | [por quê ou o que precisa acontecer] |

## 5. Requisitos

### Funcionais

- RF-1: [comportamento observável]

### Não funcionais

- RNF-1: [limite ou qualidade mensurável]

### Regras e invariantes

- RB-1: [regra que deve permanecer verdadeira]

## 6. Experiência e fluxos

[Fluxo principal, alternativas e estados relevantes.]

## 7. Design técnico

### Arquitetura e responsabilidades

[Módulos existentes afetados, responsabilidades e justificativa.]

### Fluxo de dados e contratos

[Entradas, saídas, validação, sequência, erros e compatibilidade.]

### Dados e migração

[Estado atual e estado-alvo; entidades, campos, tipos, nulabilidade, defaults, relações, constraints, índices, invariantes, migration, backfill e reversão quando aplicáveis.]

**DBML:** [caminho, visão completa/parcial e `Consistência do modelo: APROVADA | NÃO APROVADA`, quando o modelo persistente mudar.]

### Segurança e privacidade

[Autenticação, autorização, dados sensíveis, abuso e auditoria.]

#### Matriz de permissões

| Ação/recurso | Perfil | Escopo permitido | Enforcement |
| --- | --- | --- | --- |
| [ação sensível] | [perfil] | [próprio, departamento, tenant, todos...] | [servidor, RLS/policy...] |

### Observabilidade

[Logs, métricas, alertas e sinais de sucesso/falha.]

## 8. Falhas e edge cases

| Condição | Comportamento esperado | Recuperação/observação |
| --- | --- | --- |
| [falha] | [resultado] | [retry, fallback, suporte ou alerta] |

## 9. Estratégia de testes

| Camada | Cenário | Arquivo | Evidência esperada |
| --- | --- | --- | --- |
| [unitário/componente/E2E mocked/E2E live/SQL/manual] | [cenário] | [caminho do arquivo de teste] | [asserção ou artefato] |

[Critério de aceite cujo texto descreve gesto de navegador — abrir, clicar, filtrar, ordenar, rolar, recarregar, ver — nomeia aqui um arquivo E2E, e não apenas a camada, na convenção do harness do projeto. Camada isolada por padrão; camada integrada só para afirmação sobre persistência. Quando um gesto não puder virar E2E, escrever o motivo em vez de deixar a linha em branco.]

### Marcadores de teste

| Marcador | Elemento | Usado por |
| --- | --- | --- |
| `data-testid="[nome]"` | [o que ele identifica] | [critério de aceite ou cenário] |

[Toda superfície nova ou alterada que um E2E precise alcançar nomeia seu marcador aqui, antes da implementação. Conteúdo visível não é chave de localização: texto muda por motivo que não é regressão, e asserção de ausência ancorada em texto que deixou de existir passa a passar por acidente. Classe do Tailwind e `.locator("..")` descrevem aparência e marcação, não identidade, e não servem de âncora. Omitir esta seção somente quando a entrega não tocar superfície visível.]

## 10. Critérios de aceite

- CA-1 — Dado [precondição], quando [ação], então [resultado observável].

## 11. Rollout e rollback

[Fases, compatibilidade, monitoramento, critérios de pausa e reversão.]

[Anotar em cada fase as skills de domínio que governam sua implementação, quando o projeto tiver skills. Elas entram como conformidade com as decisões de 7 e 13, não para reabri-las.]

0. [fase] — *Skills: [nomes verificados no projeto].* *Validação: [critérios de aceite provados na fase], `npm run test`, `npm run test:e2e`, `npm run lint`, `npm run build`.*

[Cada fase declara os comandos que a fecham. `npm run test:e2e` entra em toda fase que altere superfície visível; omiti-lo exige dizer por quê. Fase que termine com critério de navegador sem prova é fase incompleta, não fase entregue com observação.]

## 12. Riscos e trade-offs

| Risco/decisão | Impacto | Mitigação ou trade-off |
| --- | --- | --- |
| [item] | [efeito] | [tratamento] |

## 13. Decisões e alternativas

| Decisão | Evidência/justificativa | Alternativa descartada |
| --- | --- | --- |
| [decisão] | [por quê] | [alternativa e motivo] |

## 14. Questões em aberto

| Questão | Impacto | Responsável/fonte | Bloqueante? |
| --- | --- | --- | --- |
| [questão] | [decisão afetada] | [quem/onde validar] | Sim/Não |

### Hipóteses

| Hipótese | Impacto se errada | Responsável/fonte de validação | Contingência | Bloqueante? |
| --- | --- | --- | --- | --- |
| [suposição] | [o que muda] | [quem/onde validar] | [alternativa ou resposta] | Sim/Não |

## 15. Definition of Ready

Implementation Ready: SIM | NÃO

Bloqueios:
- [pendência, ou “Nenhum”]

Hipóteses aceitas:
- [referenciar somente hipóteses não bloqueantes da tabela acima]
```

## Regras de rastreabilidade

- Dar identificadores apenas quando ajudarem a relacionar requisitos, testes e aceite; não burocratizar specs pequenas.
- Fazer cada critério de aceite provar um requisito ou regra relevante.
- Ligar cada critério de aceite de navegador a um arquivo E2E nomeado, ou ao motivo pelo qual ele não tem prova automatizada.
- Ligar decisões técnicas a evidência do repositório, restrição confirmada ou risco explícito.
- Registrar conflitos entre fontes e não escolher silenciosamente qual delas prevalece.
- Marcar caminhos e símbolos não verificados como candidatos, nunca como fatos.
- Registrar a alternativa mínima quando a solução escolhida adicionar padrão, dependência ou infraestrutura.
- Usar identificadores estáveis para requisitos, regras, decisões e aceite apenas quando a complexidade ou a vida útil justificar.
- Quando houver DBML, tratá-lo como visão derivada do estado-alvo e manter RLS, triggers, migration e rollback na SDD.
- Anotar skills por fase de rollout somente quando existirem no projeto, tratando-as como conformidade com decisões já registradas, não como decisão nova.
