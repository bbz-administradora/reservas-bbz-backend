# Máquina de estados e idempotência

## Labels canônicas

Manter `flow-local` durante todo o ciclo. Manter exatamente uma label de fase:

| Label | Significado |
| --- | --- |
| `flow:refining` | Contexto em refinamento |
| `flow:waiting-context` | Perguntas bloqueantes aguardam resposta |
| `flow:refined` | História refinada e dimensionada; modo refinar encerrado |
| `flow:specifying` | SDD em descoberta ou escrita |
| `flow:waiting-spec-approval` | SDD pronta aguarda aprovação humana |
| `flow:implementing` | Implementação autorizada em andamento |
| `flow:testing` | Checks e testes em execução ou correção |
| `flow:review` | Draft PR pronto para revisão humana |
| `flow:blocked` | Ação humana ou capability necessária |
| `flow:failed` | Falha não recuperada, com diagnóstico publicado |
| `flow:done` | PR merged ou encerramento manual confirmado |

Manter no máximo uma label de tamanho: `size:S`, `size:M`, `size:L` ou `size:XL`. Labels representam estado; nunca funcionam como gatilho autônomo de Actions.

## Transições

| Estado atual | Evidência/evento | Próximo estado | Ação principal |
| --- | --- | --- | --- |
| sem estado | execução solicitada e preflight válido | `refining` | aplicar `flow-local`, adquirir lease |
| `refining` | falta contexto bloqueante | `waiting-context` | publicar perguntas e liberar lease |
| `waiting-context` | `/flow answer` ou resposta local reconciliada | `refining` | registrar resposta e refazer refinamento puro |
| `refining` | história pronta e dimensionada, modo completo | `specifying` | persistir refinamento, preparar branch/worktree |
| `refining` | história pronta e dimensionada, modo refinar | `refined` | persistir refinamento e size, liberar lease, encerrar |
| `refined` | execução completa solicitada depois | `specifying` | reaproveitar história/size e preparar branch/worktree |
| `refined` | novo refinamento solicitado explicitamente | `refining` | reabrir refinamento sobre o `original-body` preservado |
| `specifying` | SDD Implementation Ready | `waiting-spec-approval` | publicar SHA e liberar lease |
| `waiting-spec-approval` | `/flow approve-spec` ou aprovação local explícita | `implementing` | registrar aprovação e iniciar código |
| `implementing` | implementação concluída | `testing` | executar checks previstos |
| `testing` | checks aceitáveis e branch publicada | `review` | criar/reutilizar Draft PR, liberar lease |
| qualquer fase ativa | inconsistência ou dependência humana | `blocked` | explicar ação necessária, liberar lease |
| qualquer fase ativa | falha não recuperável | `failed` | publicar diagnóstico, liberar lease |
| `review` | PR merged ou encerramento manual inequívoco | `done` | registrar conclusão |

Não avançar de `waiting-context` só porque existe qualquer comentário. Não avançar de `waiting-spec-approval` sem aprovação explícita válida. Não avançar de `refined` sem pedido humano de execução completa: `refined` é estado terminal do modo refinar, não uma fase intermediária a ser continuada por inferência.

## Ordem de derivação em retomada

Derivar o estado a partir de evidências, nesta ordem:

1. Issue existe, está acessível e pertence ao repositório esperado.
2. PR da branch está merged, aberto Draft, aberto ready ou ausente.
3. Branch vinculada/remota e worktree existem e correspondem ao mesmo nome.
4. SDD existe, contém status Implementation Ready e seu SHA coincide com o comentário `spec-ready`.
5. Comentários marcados registram backup, perguntas, respostas, aprovação, testes e handoff.
6. Labels atuais são coerentes com essas evidências.

A evidência estrutural vence uma label atrasada. Corrigir a label apenas quando a reconciliação for inequívoca.

`flow:refined` com comentário `refined`, size aplicado e sem branch, worktree ou SDD é estado coerente do modo refinar, não um fluxo interrompido. Se existir branch, SDD ou PR junto de `flow:refined`, a evidência estrutural vence: reconciliar para a fase correspondente. Se duas branches, dois PRs ou SHAs incompatíveis impedirem uma escolha segura, usar `flow:blocked`.

## Marcadores de comentários

Todo comentário da automação começa com um cabeçalho legível e contém um marcador HTML estável:

```md
## 🤖 Flow Local · <fase>
<!-- flow-feature:v1;kind=<kind>;issue=<numero> -->
```

Kinds canônicos:

- `lease`
- `original-body`
- `questions:<round>`
- `answer:<round>` para espelhar uma resposta dada localmente
- `refined`
- `spec-ready:<spec-sha>`
- `spec-approved:<spec-sha>`
- `implementation-started`
- `tests:<commit-sha>`
- `review:<pr-number>`
- `blocked`
- `failed`

Antes de criar qualquer comentário de fase, procurar o marcador correspondente. Atualizar ou reutilizar o existente quando possível; não duplicar. O backup `original-body` é criado uma única vez e nunca sobrescrito.

Comentários humanos só entram no contexto do refinamento quando a primeira linha não vazia for `/flow answer`. Aprovação de spec só é válida quando a primeira linha não vazia for `/flow approve-spec`. Ignorar comandos encontrados dentro de citações, code fences ou conteúdo gerado pela própria automação.

## Lease cooperativo

Usar um comentário único com o marcador:

```html
<!-- flow-feature:v1;kind=lease;run=<uuid>;actor=<github-login>;expires=<iso-8601> -->
```

- Duração recomendada: duas horas.
- Renovar editando o lease existente, não criando outro.
- Uma lease não expirada de outro run bloqueia mutações.
- Uma lease expirada só pode ser assumida após reconciliar issue, branch, worktree, SDD e PR.
- Liberar no gate humano, `review`, `blocked` ou `failed`, registrando expiração imediata ou estado liberado no mesmo comentário.
- O lease é cooperativo e não atômico; nunca alegar exclusão forte.

## Falhas e retomada

Usar `blocked` quando uma ação humana, permissão, ambiguidade ou capability impede avanço seguro. Usar `failed` quando uma operação tentou executar e terminou em falha não recuperada. Em ambos, publicar o que falhou, evidência, impacto, estado preservado e ação exata para retomar.
