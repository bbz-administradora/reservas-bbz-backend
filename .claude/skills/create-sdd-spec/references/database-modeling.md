# Modelagem persistente e DBML

Ler esta referência quando a task criar ou alterar tabelas, campos, enums, relações, constraints, índices, políticas ou outra estrutura persistente. O objetivo é permitir revisão rápida do estado-alvo sem transformar o diagrama em uma segunda fonte de verdade.

## 1. Reconciliar o estado atual

Inspecionar, conforme a stack:

- migrations e schema declarativo;
- tipos gerados, ORM e validações que espelham o banco;
- PKs, FKs, constraints, índices, enums e defaults;
- RLS/policies, grants, triggers, funções e seeds;
- queries e testes que revelem consumidores ou invariantes.

Distinguir explicitamente:

- **Estado atual confirmado**: o que existe no repositório;
- **Estado-alvo proposto**: como ficará após a implementação;
- **Diferença**: o que será adicionado, alterado ou removido.

Não tratar migration antiga isolada como schema atual quando migrations posteriores puderem tê-la alterado.

## 2. Especificar o estado-alvo

Para cada entidade afetada, definir somente o que for material:

- propósito e fonte de verdade;
- campos, tipos, nulabilidade e defaults;
- PKs, FKs, cardinalidade e comportamento `ON DELETE`/`ON UPDATE`;
- uniques, checks, enums e índices;
- estratégia de exclusão, retenção e auditoria;
- invariantes e lógica em trigger ou função;
- autorização no banco, incluindo RLS/policies quando aplicável;
- migration, backfill, compatibilidade durante a transição e rollback;
- volume esperado e impacto nas queries críticas.

Tratar nulabilidade, exclusão e desnormalização como decisões de negócio. Explicar quando um valor pode ser nulo, por que dados podem ou não ser apagados e qual leitura justifica uma duplicação deliberada.

## 3. Gerar o DBML

Gerar uma visão DBML quando a SDD final criar ou alterar o modelo persistente. Materializar o arquivo apenas quando o usuário tiver pedido criação ou edição do arquivo da spec.

- Usar o mesmo nome-base da spec e o mesmo diretório, conforme a seção 8 do SKILL. Exemplo: `docs/specs/283-aprovacoes/aprovacoes.md` e `docs/specs/283-aprovacoes/aprovacoes.dbml`.
- Representar o **estado-alvo**, não uma sequência de migrations.
- Informar no início se o arquivo contém o modelo completo ou uma visão parcial das tabelas afetadas e suas relações diretas.
- Refletir literalmente nomes, schemas, tipos, nulabilidade, defaults, PKs, FKs, uniques, enums, cardinalidades e índices confirmados na SDD.
- Não inventar campo, tipo, default, constraint, índice ou relação para completar o desenho.
- Manter questões não resolvidas na SDD; se afetarem estruturalmente o modelo, não apresentar a parte correspondente como pronta.
- Atualizar o DBML no mesmo passo que qualquer revisão da SDD que mude o modelo.

Usar comentários no DBML apenas para contexto estrutural útil que sua sintaxe não expresse bem. Manter na SDD — e não tentar substituir no diagrama — RLS/policies, triggers, funções, backfill, transações, rollout, rollback, observabilidade e justificativas.

Quando a SDD existir apenas na conversa, apresentar a visão em um bloco `dbml`; não criar arquivo sem autorização para materializar a spec. Se uma questão bloqueante impedir um modelo coerente, apresentar somente a parte confirmada como provisória ou adiar o DBML e declarar o bloqueio.

## 4. Aplicar o gate de consistência

Antes da entrega, verificar:

- SDD e DBML descrevem as mesmas tabelas, campos e enums?
- Tipos, nulabilidade e defaults coincidem?
- PKs, FKs, uniques, índices e cardinalidades coincidem?
- O escopo completo ou parcial está explícito?
- O resumo de mudanças corresponde ao estado-alvo?
- Decisões não representáveis no DBML continuam na SDD?
- Nenhuma hipótese foi convertida silenciosamente em estrutura definitiva?

Declarar `Consistência do modelo: APROVADA | NÃO APROVADA`. Se não estiver aprovada, listar divergências como bloqueios da Definition of Ready.

## 5. Resumir para revisão

Antes de remeter o leitor ao documento completo, destacar:

- tabelas, campos e relações adicionados, alterados ou removidos;
- decisões de nulabilidade, exclusão e cardinalidade que merecem revisão;
- impacto de migration, backfill, RLS/policies e rollback;
- hipóteses ou conflitos de fonte ainda relevantes;
- caminho do DBML e se ele representa visão completa ou parcial.
