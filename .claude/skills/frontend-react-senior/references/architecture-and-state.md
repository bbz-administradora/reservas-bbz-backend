# Arquitetura de componentes e estado

## Modelo mental obrigatório

- Tratar renderização como cálculo puro de UI a partir de props, estado e contexto.
- Lembrar que cada render captura um snapshot; handlers e callbacks observam os valores do render em que foram criados.
- Usar atualização funcional quando o próximo estado depender do anterior.
- Entender identidade pela posição na árvore, tipo e `key`. Usar keys estáveis do domínio, nunca índice quando itens puderem reordenar, inserir ou remover.
- Não mutar props ou estado. Produzir novas referências apenas onde ocorreu mudança.
- Manter fluxo de dados de cima para baixo e eventos de baixo para cima, salvo fronteira compartilhada justificada.

## Planejar componentes

Separar um componente quando pelo menos um sinal for verdadeiro:

- representa conceito visual ou de domínio reconhecível;
- possui responsabilidade ou frequência de mudança distinta;
- encapsula interação, acessibilidade ou estado próprio coerente;
- aparece em mais de um consumidor com contrato estável;
- permite testar ou compreender uma parte relevante isoladamente.

Não separar apenas por número de linhas. Evitar componentes com muitas flags que combinam comportamentos incompatíveis; preferir composição, slots explícitos ou variantes tipadas.

Manter páginas como composição e coordenação de alto nível. Evitar que elas acumulem acesso remoto, transformação de domínio, validação e detalhes extensos de apresentação no mesmo arquivo.

## Decidir reutilização

1. Procurar componente ou primitiva existente.
2. Comparar semântica, comportamento, acessibilidade e variações reais.
3. Estender quando o conceito for o mesmo e o contrato continuar coeso.
4. Criar componente de domínio quando a regra for compartilhada dentro do domínio.
5. Criar componente genérico somente após existir abstração estável.

Não unificar componentes visualmente parecidos que possuem regras, ciclos de vida ou evolução diferentes.

## Classificar estado

| Categoria | Fonte preferida | Exemplos |
| --- | --- | --- |
| Derivado | Calcular durante render | lista filtrada, total, permissão derivada |
| UI local | `useState` próximo do uso | aba efêmera, diálogo, seleção temporária |
| Transições locais complexas | `useReducer` | editor com eventos e invariantes relacionados |
| Formulário | React Hook Form + schema Zod | valores, erros, dirty e submissão |
| Navegação compartilhável | URL/React Router | busca, página, ordenação, item selecionado por rota |
| Servidor | TanStack React Query | entidades remotas, loading, erro e cache |
| Sessão/transversal | Context existente ou store justificada | autenticação, empresa, permissões |

Antes de adicionar estado, perguntar se o valor pode ser calculado, recebido, localizado mais perto do uso ou representado por uma fonte já existente.

Evitar:

- copiar props para estado sem política explícita de reset;
- armazenar objeto selecionado e identificador quando um deriva do outro;
- estados booleanos contraditórios como `isLoading`, `isSuccess` e `isError` controlados manualmente;
- sincronizar dois estados equivalentes por Effect;
- estruturas profundas difíceis de atualizar.

## Escolher reducer e Context

Usar reducer quando eventos claros atualizarem partes relacionadas, quando invariantes precisarem ficar centralizadas ou quando múltiplos setters tornarem transições difíceis de auditar. Manter reducer puro e modelar ações como union discriminada.

Usar Context quando consumidores distantes precisarem da mesma informação estável ou capacidade. Não usar Context apenas para evitar poucas props intermediárias. Preferir composição quando o intermediário só encaminha uma região de UI.

Ao criar Context:

- expor hook consumidor que falha com mensagem clara fora do provider;
- evitar valor default falso que esconda provider ausente;
- dividir estado e ações, ou domínios com frequências distintas, quando rerenders forem relevantes;
- estabilizar o valor somente se consumidores realmente dependerem da identidade;
- não duplicar dados de servidor já administrados pelo React Query.

## Organizar por feature

Para feature nova ou coesa, considerar:

```text
src/features/<dominio>/
  api/
  components/
  hooks/
  schemas/
  types/
  utils/
```

Criar apenas as pastas necessárias. Manter componentes genéricos em `src/components/ui` e integrações realmente transversais em fronteiras compartilhadas. Evitar `utils`, `hooks` ou `types` globais como depósitos sem domínio.

No legado, preferir colocação compatível com o módulo existente e migração incremental. Introduzir a estrutura feature-first quando ela resolver uma mudança real, não para reorganizar o repositório inteiro.
