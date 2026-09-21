# Effects, custom hooks e dados remotos

## Conteúdo

- [Decidir se um Effect existe](#decidir-se-um-effect-existe)
- [Projetar custom hooks](#projetar-custom-hooks)
- [Separar acesso remoto](#separar-acesso-remoto)
- [Usar TanStack React Query](#usar-tanstack-react-query)
- [Concorrência e ciclo de vida](#concorrência-e-ciclo-de-vida)
- [Erros e feedback](#erros-e-feedback)

## Decidir se um Effect existe

Usar Effect para sincronizar com algo fora do modelo declarativo do React, como subscription, timer, DOM imperativo, API do navegador ou conexão externa.

Não usar Effect para:

- calcular valor derivado para renderização;
- responder diretamente a clique ou submissão;
- manter duas representações do mesmo estado sincronizadas;
- chamar callback do pai após mudança que pode ocorrer no mesmo evento;
- inicializar lógica global sem considerar remontagem em desenvolvimento.

Ao manter um Effect:

- incluir todas as dependências reativas;
- separar sincronizações independentes;
- retornar cleanup simétrico;
- tornar setup e cleanup seguros sob remontagem;
- cancelar ou ignorar trabalho assíncrono obsoleto;
- evitar desabilitar regras de hooks; corrigir a estrutura primeiro.

## Projetar custom hooks

Extrair custom hook quando existir lógica stateful reutilizável, integração externa, coordenação coerente de uma feature ou contrato que torne o componente mais declarativo.

Manter o nome orientado ao propósito, como `useClientSearch` ou `usePresenceSubscription`. Não criar wrappers genéricos como `useMount`, hooks que apenas renomeiam `useState` ou funções prefixadas com `use` que não chamam hooks.

Definir:

- entradas mínimas e tipadas;
- retorno estável conceitualmente, sem expor detalhes internos desnecessários;
- estados e erros possíveis;
- ownership dos efeitos colaterais;
- política de cancelamento e concorrência quando houver assíncrono.

Hooks compartilham lógica, não instâncias de estado. Se consumidores precisarem da mesma instância, elevar o estado, usar provider ou utilizar a fonte de servidor compartilhada.

## Separar acesso remoto

Para fluxos simples e locais, um hook de query pequeno pode conter a chamada. Separar uma função de `api/` quando houver reuso, transformação, paginação, testes próprios, múltiplas operações ou contrato de domínio relevante.

Preferir a direção:

```text
Componente -> hook/query options -> função de API -> Supabase/HTTP
```

- Manter funções de API independentes de renderização, toast e navegação.
- Receber parâmetros explícitos e retornar dados tipados ou lançar erro normalizado.
- Não esconder autorização: UI controla visibilidade; RLS/backend executa a regra efetiva.
- Não acessar segredos no cliente.
- Validar payloads externos quando os tipos de compilação não garantirem o runtime.

Não criar repository, service e adapter simultaneamente sem necessidade. Cada fronteira deve reduzir acoplamento, permitir substituição real ou concentrar uma política relevante.

## Usar TanStack React Query

Tratar React Query como owner do estado de servidor. Não copiar `data`, `isLoading` ou `error` para `useState`.

Para queries:

- usar query keys determinísticas, hierárquicas e baseadas nos parâmetros que alteram o resultado;
- centralizar factories de keys quando o domínio tiver várias queries relacionadas;
- usar `enabled` apenas para dependências reais, sem non-null assertion insegura no `queryFn`;
- escolher `staleTime` pela tolerância de negócio, não por valor padrão copiado;
- preservar dados anteriores, paginação ou infinite query quando a experiência exigir;
- usar `select` para transformação de consumo sem duplicar cache desnecessariamente;
- permitir cancelamento com `signal` quando o client suportar.

Para mutações:

- impedir duplicidade quando a operação não for idempotente;
- invalidar a menor família de keys que possa estar desatualizada;
- atualizar cache diretamente quando a resposta autoritativa for suficiente;
- usar optimistic update somente com snapshot e rollback definidos;
- decidir retry conforme idempotência e natureza do erro;
- manter feedback visual perto da coordenação da feature, evitando acoplar hooks reutilizáveis a textos específicos.

Tratar falhas parciais de operações compostas. Se duas escritas precisarem ser atômicas, resolver no backend ou banco; uma sequência no cliente não oferece transação.

## Concorrência e ciclo de vida

- Evitar que resposta antiga substitua parâmetros novos.
- Cancelar requests quando possível e ignorar resultado obsoleto quando cancelamento não existir.
- Desabilitar ou deduplicar submissões incompatíveis.
- Usar identificador/idempotency key quando o backend oferecer esse contrato.
- Não assumir que `setState` é imediatamente observável após a chamada.
- Usar `startTransition` ou valor diferido apenas para manter interações responsivas, nunca para mascarar trabalho remoto incorreto.

## Erros e feedback

Normalizar erros técnicos em fronteira apropriada e apresentar mensagem acionável em pt-BR. Preservar detalhe técnico seguro para diagnóstico, sem expor payload sensível.

Distinguir:

- ausência legítima de dados;
- erro de validação;
- não autenticado ou sem permissão;
- conflito de concorrência;
- indisponibilidade ou timeout;
- erro inesperado.

Oferecer retry somente quando seguro. Usar error boundary para falha de renderização ou de uma região, não como substituto do estado de erro de uma query ou submissão.
