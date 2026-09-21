# Preservação de comportamento e contratos

Usar este guia para construir a rede de segurança antes de qualquer refatoração. Comportamento observável inclui mais do que o valor retornado: erros, efeitos, ordem, timing relevante, acessibilidade, permissões e persistência também podem ser contratos.

## Mapear a superfície observável

| Superfície | Exemplos a preservar |
| --- | --- |
| Chamadas de código | Assinaturas, tipos, nulabilidade, defaults, mutação, exceções e ordem dos resultados |
| Interface | Texto necessário, estados, foco, atalhos, semântica HTML, atributos acessíveis e navegação |
| Estado e dados remotos | Query keys, invalidação, deduplicação, cache, retry, loading, erro e cancelamento |
| HTTP e integrações | Método, rota, headers, autenticação, payload, status, timeout, retry e idempotência |
| Banco | Schema, constraints, RLS, privilégios, funções, triggers, ordem, atomicidade e plano de migração |
| Operação | Logs necessários, métricas, tracing, mensagens diagnósticas e consumo de recursos relevante |
| Compatibilidade | Imports, exports, nomes públicos, serialização, arquivos, configuração e variáveis de ambiente |

Pesquisar consumidores diretos e indiretos. Considerar testes, mocks, fixtures, scripts, jobs, integrações e chamadas SQL como consumidores, não apenas imports da linguagem.

## Classificar o risco

### Baixo

- Renomear símbolo estritamente privado com suporte do type checker ou busca completa.
- Extrair expressão ou função pura sem alterar ordem de avaliação.
- Remover código comprovadamente inalcançável dentro do alvo.
- Simplificar fluxo local mantendo as mesmas condições e efeitos.

Executar testes direcionados e checagem estática pertinente.

### Médio

- Mover responsabilidade entre módulos internos.
- Reorganizar estado, Effects, async, tratamento de erro ou cache.
- Extrair componente, hook, classe, módulo ou fronteira interna.
- Consolidar duplicação com pequenas diferenças.

Exigir consumidores mapeados, testes de comportamento e validação ampliada. Preferir compatibilidade temporária quando a superfície de uso não puder ser comprovada como interna.

### Alto

- Alterar API/export público, schema, migration, RLS, autorização ou payload externo.
- Mudar transação, concorrência, ordem de efeitos, retry, idempotência ou timing relevante.
- Trocar hierarquia, modelo de dados, framework, biblioteca central ou arquitetura.
- Refatorar código crítico sem testes ou com consumidores desconhecidos.

Não tratar como refactor neutro. Dividir em preparação compatível e mudança explícita, ou pedir autorização e especificação próprias.

## Construir evidência

Escolher a proteção mais próxima do contrato:

- Teste unitário para regras puras, bordas e invariantes.
- Teste de componente para interação, acessibilidade e estados visíveis.
- Teste de integração para banco, cache, rede, autenticação e fronteiras.
- Teste de contrato para payloads, serialização e APIs públicas.
- Teste de caracterização para comportamento legado importante ainda não especificado.
- Typecheck, lint e build para compatibilidade estrutural e integração do projeto.
- Inspeção do plano ou benchmark somente quando performance fizer parte do risco.

Um teste de caracterização deve registrar o comportamento atual relevante, mesmo que sua forma não seja ideal. Não cristalizar detalhes internos, bugs conhecidos irrelevantes ou snapshots enormes sem intenção clara.

## Comparar antes e depois

Confirmar explicitamente:

- mesmas entradas aceitas e rejeitadas;
- mesmos resultados, ordenação e arredondamento;
- mesmas condições de erro e recuperação;
- mesmos efeitos e mesma ordem quando observável;
- mesmos limites de permissão e exposição de dados;
- mesmos estados de UI e semântica acessível;
- mesmos contratos de persistência e integração;
- nenhuma regressão relevante de queries, renderizações ou complexidade.

Se uma diferença for desejável, removê-la do refactor e registrá-la como mudança funcional separada.

## Preservar reversibilidade

- Preferir commits e etapas pequenas que possam ser revertidos isoladamente.
- Manter adaptadores temporários somente quando houver consumidores a migrar; definir sua remoção fora do refactor atual.
- Evitar alterar simultaneamente definição e todos os consumidores quando uma fronteira pública ou externa não estiver completamente conhecida.
- Não usar compatibilidade improvisada para mascarar falta de entendimento do contrato.
