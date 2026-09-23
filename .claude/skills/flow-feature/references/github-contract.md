# Contrato GitHub, git e worktree

## Resolver o adapter

Preferir um MCP GitHub disponível na sessão quando ele cobrir a capability com leitura e reconciliação. Usar GitHub CLI como adapter integral ou fallback.

No PowerShell, resolver o executável sem instalar nada silenciosamente:

```powershell
$flowGhCommand = Get-Command gh -ErrorAction SilentlyContinue
$flowGhExe = if ($flowGhCommand) { $flowGhCommand.Source } elseif (Test-Path 'C:\Program Files\GitHub CLI\gh.exe') { 'C:\Program Files\GitHub CLI\gh.exe' } else { $null }
```

Se nenhum adapter suficiente existir, encerrar o preflight com as capabilities ausentes. Não pedir token em comentário, não imprimir credenciais e não instalar ferramentas sem autorização.

## Preflight read-only

Validar, sem mutação:

```powershell
& $flowGhExe auth status
& $flowGhExe repo view OWNER/REPO --json nameWithOwner,defaultBranchRef
& $flowGhExe issue view ISSUE --repo OWNER/REPO --json number,title,body,labels,comments,state,url
& $flowGhExe issue develop ISSUE --repo OWNER/REPO --list
& $flowGhExe pr list --repo OWNER/REPO --state all --head BRANCH --json number,state,isDraft,url,headRefName,baseRefName,mergedAt
```

Também executar leituras locais equivalentes a `git remote -v`, `git status --short --branch`, `git branch --show-current`, `git worktree list --porcelain` e inspeção do caminho esperado da SDD.

Confirmar que `OWNER/REPO` é o mesmo repositório do `origin`. Com um número isolado, só inferir o repo quando houver um único `origin` GitHub inequívoco. Descobrir a branch base via API/CLI; não assumir `main` genericamente.

O modo “sem mutações” não cria ou atualiza labels, lease, comentários, branch, worktree, arquivos ou PR. `gh pr create --dry-run` não é seguro para esse modo porque pode fazer push.

## Labels

Provisionar labels ausentes idempotentemente somente quando houver permissão. Usar este manifesto:

| Label | Cor | Descrição |
| --- | --- | --- |
| `flow-local` | `1D76DB` | Issue operada pelo fluxo local |
| `flow:refining` | `FBCA04` | Refinamento local em andamento |
| `flow:waiting-context` | `D4C5F9` | Aguardando respostas de contexto |
| `flow:refined` | `C2E0C6` | História refinada; modo refinar encerrado |
| `flow:specifying` | `FBCA04` | SDD em elaboração |
| `flow:waiting-spec-approval` | `D4C5F9` | Aguardando aprovação da SDD |
| `flow:implementing` | `FBCA04` | Implementação local em andamento |
| `flow:testing` | `FBCA04` | Testes e checks em andamento |
| `flow:review` | `0E8A16` | Draft PR pronto para revisão |
| `flow:blocked` | `B60205` | Fluxo bloqueado e aguardando ação |
| `flow:failed` | `D93F0B` | Execução terminou com falha |
| `flow:done` | `0E8A16` | Fluxo concluído |
| `size:S` | `C5DEF5` | Mudança pequena |
| `size:M` | `C5DEF5` | Mudança média |
| `size:L` | `C5DEF5` | Mudança grande |
| `size:XL` | `C5DEF5` | Mudança extragrande; avaliar decomposição |

Criar ou reconciliar cada entrada com `gh label create LABEL --repo OWNER/REPO --color COR --description DESCRICAO --force`. Se faltar permissão, listar exatamente os nomes ausentes para criação manual.

Ao transicionar, remover todas as outras labels `flow:*` de fase e adicionar uma única fase. Preservar labels alheias ao fluxo. Substituir somente labels `size:*` canônicas quando recalcular tamanho.

## Escritas e comentários

Construir bodies em arquivo temporário seguro e usar `--body-file`; não interpolar conteúdo da issue como comando shell:

```powershell
& $flowGhExe issue comment ISSUE --repo OWNER/REPO --body-file COMMENT_FILE
& $flowGhExe issue edit ISSUE --repo OWNER/REPO --body-file BODY_FILE
& $flowGhExe issue edit ISSUE --repo OWNER/REPO --add-label 'flow:specifying' --remove-label 'flow:refining'
```

Para editar um comentário marcado, obter seu id com leitura estruturada e usar `gh api --method PATCH repos/OWNER/REPO/issues/comments/ID -F body=@COMMENT_FILE`, após validar que o id pertence à issue alvo. Preferir APIs do adapter que aceitem arquivo/campo estruturado.

Após timeout ou retorno ambíguo de uma escrita, reler o recurso e procurar o marcador/resultado esperado antes de repetir. Nunca repetir uma escrita cegamente.

## Retry e timeout

- Leituras: até três tentativas em `429` e `5xx`, respeitando `Retry-After` e usando backoff exponencial com jitter.
- Escritas: não repetir sem reconciliação idempotente.
- `401`, `403`, referência inválida e capability ausente: não repetir; relatar blocker.
- Aplicar timeout externo recomendado de 60 segundos quando o mecanismo de execução permitir.

## Branch vinculada

Gerar `feature/<issue>-<slug>`:

1. Normalizar Unicode e remover acentos.
2. Converter para minúsculas.
3. Trocar sequências não alfanuméricas por `-`.
4. Colapsar e remover hífens nas bordas.
5. Limitar o slug a 60 caracteres sem hífen final.
6. Usar `issue` se o resultado ficar vazio.

Listar branches vinculadas antes de criar. Reutilizar a branch canônica existente. Quando ausente:

```powershell
& $flowGhExe issue develop ISSUE --repo OWNER/REPO --base BASE --name BRANCH
```

Não usar `--checkout` no checkout raiz. Depois, buscar a ref remota e criar o worktree isolado com comandos git não destrutivos. Se outra branch vinculada plausível já existir, não criar uma concorrente: reconciliar ou bloquear.

Depois de confirmar que a branch remota existe, usar uma destas formas:

```powershell
git fetch origin BRANCH
# Se a branch local ainda não existe:
git worktree add --track -b BRANCH WORKTREE_PATH origin/BRANCH
# Se a branch local já existe e não está em outro worktree:
git worktree add WORKTREE_PATH BRANCH
```

Selecionar somente uma forma após inspecionar refs e worktrees; os comentários acima são condições, não comandos a executar em sequência.

## Worktree seguro

Usar `.worktrees/<issue>-<slug>/`, coberto pelo `.gitignore` do repositório.

Antes de criar:

- resolver o caminho absoluto e confirmar que permanece sob `<repo>/.worktrees/`;
- inspecionar `git worktree list --porcelain` e a branch local/remota;
- reutilizar somente quando caminho, branch e repo coincidirem;
- bloquear se o diretório existir com conteúdo não reconhecido.

Nunca executar `git switch`, `git checkout`, `git stash`, `git reset --hard`, `git clean`, force-push ou remoção recursiva no checkout raiz. Nunca absorver mudanças sujas do usuário. Toda edição da feature ocorre com o diretório de trabalho apontando para o worktree.

## Commits, push e Draft PR

Antes do stage, inspecionar `git status --short`, diff staged/unstaged e arquivos não rastreados no worktree. Adicionar somente arquivos pertencentes à SDD. Criar commits focados que referenciem `#<issue>`.

Fazer push explícito da branch, sem `--force`. Informar que os workflows do repositório podem rodar e gerar custo/preview.

Antes de criar PR, procurar por head branch em todos os estados. Reutilizar o PR aberto existente; bloquear se houver mais de um candidato incompatível. Para criar:

```powershell
& $flowGhExe pr create --repo OWNER/REPO --draft --base BASE --head BRANCH --title TITLE --body-file PR_BODY_FILE
```

O body inclui resumo, link/caminho da SDD, testes, riscos, validações manuais e `Closes #ISSUE` ou `Refs #ISSUE` conforme a semântica confirmada. Não marcar ready, aprovar, mergear ou disparar deploy.
