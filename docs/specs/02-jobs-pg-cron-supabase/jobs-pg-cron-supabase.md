# Mover os jobs agendados para o pg_cron do Supabase, com a API serverless como executor sem relógio

Status: Implementation Ready
Complexidade: L
Responsável: Matheus Galdino
Versão: 1.1
Atualizado em: 2026-09-21
Modelo persistente: [jobs-pg-cron-supabase.dbml](jobs-pg-cron-supabase.dbml) — visão parcial

> **v1.1** — revisão pela skill `create-sdd-spec`, com `supabase-postgres-best-practices` e `backend-supabase-senior` carregadas. Reclassificada de M para L (modelo persistente novo, integração HTTP saindo do banco, cutover com blast radius). Mudanças materiais: RLS nas tabelas novas, funções passam a `security invoker` com `search_path` fixo, PK do ledger vira `bigint identity`, o orçamento de tempo passa a derivar do `timeout_ms` do job, jobs de runtime não registram execução sem efeito, e as migrations viram idempotentes.

## 0. Pontos para revisão

1. **O relógio sai da API e passa para o banco, e isso precisa ser exclusivo.** Hoje os sete jobs são registrados no `toad-scheduler` dentro do processo Fastify ([src/app.ts](../../../src/app.ts), `app.ready().then(() => setupJobs(app))`). Na Vercel esse processo é uma função serverless: cada instância que sobe registra o próprio agendador e é congelada entre requisições. O resultado não é "o job atrasa" — é que o disparo passa a depender de quantas instâncias existem e de quando elas estão acordadas. Colocar o pg_cron ao lado sem tirar o agendador da API não resolve nada: cria dois relógios. **Tirar o `setupJobs` do caminho de produção é pré-requisito de tudo**, e é a Fase 1.
2. **Os sete jobs de negócio continuam em TypeScript, num lugar só.** Inclusive os dois de `cleanup/`, que são um `DELETE` cada ([expired-pre-reservations.ts:19](../../../src/infra/jobs/cleanup/expired-pre-reservations.ts#L19), [expired-reservations.ts:17](../../../src/infra/jobs/cleanup/expired-reservations.ts#L17)) e poderiam virar função SQL. A fronteira adotada é outra: **regra de negócio mora no repositório, em TypeScript; SQL é reservado aos jobs do próprio runtime** (`reconcile` e `prune_history`), que precisam ser SQL porque um watchdog não pode depender do caminho HTTP que ele vigia. Quem abre `src/infra/jobs/` vê os sete, sem exceção e sem precisar saber escrever migration para mudar um deles.
3. **Os outros cinco continuam em TypeScript e o pg_cron só toca a campainha.** Eles renderizam React Email e falam SMTP via nodemailer ([src/utils/email.ts](../../../src/utils/email.ts)); reescrever isso em Deno/Edge Function seria outra task, bem maior. O `pg_net` faz um POST numa rota interna e o **ledger `jobs.job_run`, no próprio Postgres, é a fonte de verdade** — não o retorno HTTP, que o pg_net guarda em tabela unlogged por 6 horas. A garantia de execução única vem de `unique (job_name, scheduled_for, attempt)` somada ao fato de o `net.http_post` só sair quando a transação do cron faz commit.
4. **A URL do gatilho tem de ser o domínio próprio.** A proteção SSO do projeto `reservas-bbz-backend` na Vercel está **ligada**, com `deploymentType: all_except_custom_domains` (verificado na API da Vercel em 2026-09-21). Ou seja: `https://gestao-api.bbz.com.br` responde; qualquer URL `*.vercel.app` devolve 401 antes de chegar no Fastify. Isso decide a URL de produção e obriga o ambiente de validação a usar token de bypass (§7).
5. **Dois defeitos pré-existentes ficam mais caros com retry e são corrigidos aqui.** No job de presença, a atualização da reserva e o incremento de `warning_count` são duas queries fora de transação ([attendance-status.ts:119](../../../src/infra/jobs/attendance/attendance-status.ts#L119) e [:177](../../../src/infra/jobs/attendance/attendance-status.ts#L177)): morrer no meio perde a advertência para sempre, porque a reserva já não está mais `pending`. No job de e-mail, o `sendEmail` acontece antes de marcar `sent` ([attendance-status.ts:549](../../../src/infra/jobs/attendance/attendance-status.ts#L549)): morrer no meio reenvia na próxima passada. Nenhum dos dois foi causado por esta task; os dois passam de improváveis a prováveis quando existe retry automático, então entram no escopo.

## 1. Resumo

Os sete jobs agendados do backend vivem no processo da API, num scheduler em memória. Isso funcionava no Render, que roda uma instância longa e sempre acordada — e é exatamente o que o [README:96](../../../README.md#L96) documenta como invariante: "o serviço Render precisa permanecer ativo e com uma única instância de scheduler, ou os jobs serão interrompidos/duplicados". O deploy passou para a Vercel (`4d554f4`), onde esse invariante não existe: a API é uma função serverless, sem processo longo e com N instâncias.

A solução: **o pg_cron do Supabase passa a ser o único relógio.** Os sete jobs continuam em TypeScript, agora expostos numa rota interna autenticada por segredo compartilhado e disparada pelo `pg_net`; o que sai do código é só o horário. Um schema `jobs` no Postgres guarda a definição declarativa das agendas e um ledger de execuções que dá exclusão mútua, execução única por horário, watchdog, retry com teto e histórico consultável. O agendador em memória sai do caminho de produção e sobrevive apenas como runner de desenvolvimento, atrás de uma variável de ambiente que o boot recusa em produção.

Resultado observável: cada job dispara no horário certo, uma vez, com registro de início, fim, duração e resultado; um job que falhou por deploy em andamento é retentado sem intervenção; e qualquer pessoa responde "esse job rodou hoje?" com uma query, em vez de garimpar log de função serverless.

## 2. Contexto e evidências

### O que existe hoje

Sete jobs, todos criados em [src/infra/jobs/index.ts](../../../src/infra/jobs/index.ts) e registrados em `app.scheduler` dentro do `app.ready()` de [src/app.ts](../../../src/app.ts).

| Nome da task (canônico) | Agenda declarada | Tipo `toad-scheduler` | Toca SMTP? | Arquivo |
| --- | --- | --- | --- | --- |
| `cleanup-expired-pre-reservations` | a cada 30 min | `SimpleIntervalJob` | não | [cleanup/expired-pre-reservations.ts](../../../src/infra/jobs/cleanup/expired-pre-reservations.ts) |
| `cleanup-expired-reservations` | 02:50 diário | `CronJob` `0 50 2 * * *` | não | [cleanup/expired-reservations.ts](../../../src/infra/jobs/cleanup/expired-reservations.ts) |
| `attendance-status-updater` | 03:00 diário | `CronJob` `0 0 3 * * *` | não | [attendance/attendance-status.ts:297](../../../src/infra/jobs/attendance/attendance-status.ts#L297) |
| `email-notification-data-collector` | 03:10 diário | `CronJob` `0 10 3 * * *` | **sim** | [attendance/attendance-status.ts:642](../../../src/infra/jobs/attendance/attendance-status.ts#L642) |
| `weekly-compliance-wednesday-reminder` | quarta 02:00 | `CronJob` `0 0 2 * * 3` | **sim** | [compliance/weekly-compliance-notifier.ts:356](../../../src/infra/jobs/compliance/weekly-compliance-notifier.ts#L356) |
| `weekly-compliance-friday-report` | sexta 02:00 | `CronJob` `0 0 2 * * 5` | **sim** | [compliance/weekly-compliance-notifier.ts:381](../../../src/infra/jobs/compliance/weekly-compliance-notifier.ts#L381) |
| `weekly-early-checkout-monday-reminder` | segunda 02:10 | `CronJob` `0 10 2 * * 1` | **sim** | [early-checkout/weekly-reminder.ts:184](../../../src/infra/jobs/early-checkout/weekly-reminder.ts#L184) |

Todos os `CronJob` usam `timezone: 'America/Sao_Paulo'` e `preventOverrun: true`. As expressões têm **seis campos** (segundos na frente), convenção do `croner`/`toad-scheduler`; o pg_cron usa cinco. A conversão está em §7.

### Por que isso não funciona na Vercel

A entrada serverless é [api/index.js](../../../api/index.js): cada invocação faz `app.ready()` uma vez por instância e emite a requisição no servidor Fastify em memória. `setupJobs` está pendurado justamente nesse `app.ready()`. Portanto:

- **Registro por instância.** Cada instância fria que a Vercel sobe registra os sete jobs. Duas instâncias simultâneas atendendo tráfego são dois agendadores.
- **`preventOverrun` não protege nada entre instâncias.** É flag do `toad-scheduler`, válida dentro de um processo. Nada impede duas instâncias de rodarem o mesmo job no mesmo minuto.
- **Timer congelado.** Entre invocações a função é congelada; timer só avança enquanto a instância está acordada. O job de 30 minutos é `SimpleIntervalJob` contado a partir do boot da instância (`runImmediately: false`), então depende de a instância viver 30 minutos acordada — improvável num backend com tráfego de horário comercial, e às 02:00 praticamente impossível.
- **Consequência combinada:** os jobs diários e semanais provavelmente **não rodam** (ninguém acessa a API às 2 da manhã, não há instância acordada) e os de intervalo curto podem rodar **em duplicidade** quando há concorrência. É o pior dos dois mundos, e é silencioso: o `console.log('✅ Jobs agendados com sucesso')` continua aparecendo no log de cada instância.

### O que o banco já oferece

A conta é Supabase. **O projeto de produção é `xgpimigeqhkjaixhggog`**, confirmado em 2026-09-21 pelo `POSTGRES_USER` do projeto na Vercel (`postgres.xgpimigeqhkjaixhggog`, alvos `production` e `preview`) — e não `wnzvnmqvlmmwawnjuszo`, que a [spec 01](../01-migracao-s3-supabase-storage/migracao-s3-supabase-storage.md) registrou e está defasado. O projeto de validação é `gestao_reservas_copy` (`kpwxmtqmzzybaolhijxb`, Postgres `15.14.1.166`), que é também o que o `supabase link` local aponta e o que o `.env` de desenvolvimento usa. Postgres 15.14 está acima de 15.6.1.122, que é o piso para `pg_cron` 1.6.4 — a versão que a Supabase recomenda por causa do auto-revive do worker.

Três extensões sustentam o desenho, todas parte da imagem padrão da plataforma: `pg_cron` (relógio), `pg_net` (POST assíncrono) e `supabase_vault` (segredo do gatilho fora do SQL versionado). **Confirmar a instalação nos dois projetos é o primeiro passo da Fase 0** — o MCP disponível nesta sessão aponta para outro projeto da organização e não serve de prova para estes dois.

### Como o deploy e as migrations chegam ao banco

[.github/workflows/build-action.yml](../../../.github/workflows/build-action.yml) é o único publicador: `main` → produção, `dev` → preview. Ele roda `supabase db push --include-all` antes de publicar na Vercel. Ou seja, **o caminho canônico de produção é `supabase/migrations/`**, e é lá que o setup do pg_cron entra.

Existe um segundo sistema de migration, o `node-pg-migrate` em [src/infra/migrations/](../../../src/infra/migrations), usado no desenvolvimento local contra o Postgres do [compose.yaml](../../../src/infra/compose.yaml) (`postgres:16-alpine`, sem pg_cron e sem pg_net). O baseline do Supabase inclusive carrega a tabela `pgmigrations` ([baseline:198](../../../supabase/migrations/20260918000000_baseline.sql#L198)), herança desse histórico. Consequência prática: **mudança de schema que o desenvolvimento local precisa enxergar tem de ser escrita nos dois sistemas; objeto que só existe no Supabase (pg_cron, pg_net, Vault) vai só em `supabase/migrations/`.**

### Restrições da Vercel que entram no desenho

| Fato | Evidência | Efeito no desenho |
| --- | --- | --- |
| Proteção SSO ligada, exceto domínio customizado | API da Vercel, projeto `prj_viCHKLYHYhufZ4oPAwf4iYjVZzTL`: `ssoProtection.enabled = true`, `deploymentType = all_except_custom_domains` | Gatilho aponta para `https://gestao-api.bbz.com.br`. Preview exige `x-vercel-protection-bypass` |
| Uma única função atende tudo | `rewrites: [{ source: "/(.*)", destination: "/api/index" }]` em [vercel.json](../../../vercel.json) | A rota de job herdaria o `maxDuration` da API pública. Por isso entra uma função dedicada |
| Nenhum `maxDuration` declarado | [vercel.json](../../../vercel.json) só declara `includeFiles` | O job de e-mail (até 60 envios a 1/s) estoura o default. Precisa de limite explícito e de orçamento de tempo no código |
| CORS não atrapalha | [src/app.ts](../../../src/app.ts): o bloqueio em produção só vale `if (env.NODE_ENV === 'production' && origin)` | Chamada servidor-a-servidor não manda `Origin` e passa |

### Conflitos entre fontes

| Fontes | Divergência | Resolução |
| --- | --- | --- |
| [README:9](../../../README.md#L9) e [:92](../../../README.md#L92) × projeto na Vercel | README diz Render e `api-sistema-reserva.bbz.com.br`; a produção hoje é Vercel em `gestao-api.bbz.com.br` | README defasado desde `4d554f4`. Vale a realidade da Vercel; o README é atualizado na Fase 5 |
| Docblock de [index.ts](../../../src/infra/jobs/index.ts) × código × `console.log` do mesmo arquivo | Cabeçalho diz "segunda às 02:00" para o early-checkout; o cron é `0 10 2 * * 1` (02:10) e o log diz 02:10 | Vale o código: **02:10** |
| [1754505982200_add-warning-count-to-users.js](../../../src/infra/migrations/1754505982200_add-warning-count-to-users.js) × [attendance-status.ts:10](../../../src/infra/jobs/attendance/attendance-status.ts#L10) | Comentário da migration fala em banimento com 3 pontos; o código usa `WARNING_COUNT_LIMIT = 5`, igual ao README | Vale o código: **5**. Fora de escopo, registrado |
| `croner` em [package.json](../../../package.json) | Declarado como dependência e não importado em nenhum arquivo de `src/` | Dependência morta. Removida na Fase 5 |

## 3. Objetivos e métricas

| Objetivo | Métrica observável | Como medir |
| --- | --- | --- |
| Cada job dispara no horário certo | Desvio entre `scheduled_for` e `started_at` ≤ 120 s em 100% das execuções de uma semana | `select max(started_at - scheduled_for) from jobs.job_run` |
| Nenhuma execução duplicada | Zero pares de execuções concluídas com o mesmo `(job_name, scheduled_for)` | `select job_name, scheduled_for, count(*) from jobs.job_run where status in ('succeeded','partial') group by 1,2 having count(*) > 1` |
| Nenhuma execução perdida | 7/7 jobs com execução bem-sucedida no período esperado, por 7 dias corridos | `jobs.v_job_health` |
| Falha é visível em até 24 h | Todo `status in ('failed','partial')` aparece no digest do dia seguinte | Digest diário (§7) |
| Custo de execução é previsível | ~53 invocações/dia na função de jobs (48 da limpeza de meia em meia hora + 5 dos demais), cada uma na casa de segundos | Observabilidade da Vercel, filtrando `/v1/internal/jobs` |

## 4. Fora de escopo

- **Reescrever job em Deno/Edge Function.** Os cinco jobs de e-mail continuam no bundle Node. Portar React Email + nodemailer é outra task.
- **Mudar regra de negócio de qualquer job.** Limiar de advertência, dias exigidos de compliance, janelas de check-in, teto de 60 e-mails por execução: tudo permanece. Esta spec troca o ambiente de execução, não o comportamento.
- **Fila de mensagens (`pgmq`) para fan-out de e-mail.** O volume atual (≤ 60 e-mails/dia) não paga a complexidade.
- **Divergência entre `WARNING_COUNT_LIMIT = 5` e o comentário da migration.** Registrada em §2, não corrigida.
- **Suíte de testes automatizados.** O repositório não tem nenhuma ([README:158](../../../README.md#L158)); a estratégia de verificação está em §9 e é manual/roteirizada.
- **Remover o adapter de S3 e `STORAGE_DRIVER`.** É a Fase 5 da [spec 01](../01-migracao-s3-supabase-storage/migracao-s3-supabase-storage.md).
- **Unificar os dois sistemas de migration.** Fica documentado como restrição, não resolvido aqui.

## 5. Requisitos

### Funcionais

- **RF-1**: O pg_cron do projeto Supabase é o único agendador dos dez jobs — sete de negócio e três do próprio runtime.
- **RF-2**: Os sete jobs de negócio executam no backend Node, acionados por `POST` em `/v1/internal/jobs/:name`, emitido pelo `pg_net`. Nenhum deles tem regra de negócio em SQL de migration.
- **RF-3**: Os jobs do próprio runtime (`internal-jobs-reconcile` e `internal-jobs-prune-history`) executam dentro do Postgres, sem chamada HTTP, porque precisam funcionar quando o caminho HTTP está quebrado.
- **RF-4**: Toda execução de job **de negócio** — automática ou manual — gera uma linha em `jobs.job_run` com `status`, `started_at`, `finished_at`, `stats` e, em caso de falha, `error`. Os jobs de runtime (`internal-jobs-reconcile` e `internal-jobs-prune-history`) só gravam quando **agiram** ou falharam: rodando a cada 5 minutos, o reconciliador sozinho produziria 288 linhas por dia contra ~58 de todos os jobs de negócio somados, e o ledger viraria registro do watchdog em vez de registro do trabalho. Quem prova que eles estão vivos é `cron.job_run_details`, que registra toda execução sempre.
- **RF-5**: As agendas são declaradas em `jobs.job_definition` e aplicadas ao `cron.job` por `jobs.sync_schedules()`. Ninguém chama `cron.schedule` à mão.
- **RF-6**: Execução manual de qualquer job é uma linha de SQL (`select jobs.trigger_http('<nome>', 'manual')` ou `select jobs.run_sql('<nome>')`), com registro no ledger igual ao do disparo automático.
- **RF-7**: Execução que falhou ou terminou parcial é retentada automaticamente até `max_attempts`, preservando o `scheduled_for` original.
- **RF-8**: Um digest diário por e-mail reporta job que falhou, ficou parcial ou não rodou na janela esperada.
- **RF-9**: Em desenvolvimento, cada job é executável sob demanda por `npm run job:run -- <nome>`, sem pg_cron local e sem disparo automático.

### Não funcionais

- **RNF-1**: A rota interna exige segredo compartilhado; sem ele ou com ele errado, responde 401 e não executa nada.
- **RNF-2**: O segredo não aparece em arquivo versionado, em `cron.job.command`, em log de aplicação nem em resposta HTTP. Vive no Supabase Vault (lado do banco) e nas variáveis de ambiente da Vercel (lado da API).
- **RNF-3**: O código não tem como agendar nada. `@fastify/schedule`, `toad-scheduler` e `croner` saem do projeto, e com eles `setupJobs` e `app.scheduler`. "Dois relógios" deixa de ser impossível por configuração e passa a ser impossível por ausência de código.
- **RNF-4**: Nenhum job excede 5 minutos de execução, recomendação da própria Supabase para pg_cron. Job que não termina no orçamento de tempo encerra como `partial`.
- **RNF-5**: Rollback é `update jobs.job_definition set enabled = false` + `sync_schedules()`, sem deploy e sem migration reversa. Enquanto se investiga, cada job continua disparável na mão por uma linha de SQL. **Voltar ao agendador em memória não é caminho de rollback** — ver RNF-3 e §11.
- **RNF-6**: `cron.job_run_details` e `jobs.job_run` têm poda automática. A Supabase avisa explicitamente que `cron.job_run_details` cresce sem limite e atrapalha upgrade in-place.

### Regras e invariantes

- **RB-1**: `jobs.job_definition` é append-only em nome. Job retirado do ar fica com `enabled = false`; a linha não é apagada. É o que permite a `sync_schedules()` saber o que desagendar.
- **RB-2**: O nome do job é a mesma string em quatro lugares: `jobs.job_definition.name`, `cron.job.jobname`, a chave do registry em TypeScript e o `:name` da rota. Divergência é erro de build (§9).
- **RB-3**: `scheduled_for` é `date_trunc('minute', now())` no instante do disparo, e é reaproveitado por todas as tentativas do mesmo horário. É essa coluna que torna "duas execuções do mesmo horário" uma violação de unicidade, e não um acidente detectado depois.
- **RB-4**: Nenhum job supõe que rodou o job anterior. A cadeia 03:00 → 03:10 (presença → e-mail) funciona porque o job de e-mail lê `email_notification_status in ('pending','error')`, e não porque o de presença rodou 10 minutos antes.
- **RB-5**: Todo handler de job é idempotente por linha de dado: reexecutar não duplica efeito, porque a seleção é feita pelo próprio estado (`attendance_status = 'pending'`, `status = 'pre_reserved'` etc.).
- **RB-6**: A rota interna não tem JWT, não tem CSRF e não aparece no Swagger. Autenticação é só o segredo compartilhado.
- **RB-7**: O prazo de execução de um job é sempre menor que o prazo com que o watchdog o considera travado. Garantido por construção: o gatilho manda o `timeout_ms` da definição no corpo, e a API usa `min(JOBS_TIME_BUDGET_MS, timeout_ms − 10 s)` como prazo. Sem isso, um job vivo seria marcado `failed` e redisparado — duas execuções simultâneas, exatamente o que esta spec existe para impedir.
- **RB-8**: Toda tabela do schema `jobs` nasce com RLS habilitada e nenhuma policy, que é o padrão verificado nas 17 tabelas de `public`. O acesso existe porque o papel `postgres` — o que a API usa — tem `rolbypassrls`. Tabela nova sem RLS seria a única do banco fora do padrão.

## 6. Experiência e fluxos

Não há interface de usuário nesta task. Os fluxos observáveis são de operação:

1. **Rotina normal.** Ninguém faz nada. De meia em meia hora o pg_cron dispara a limpeza de pré-reservas; às 05:50, 06:00 e 06:10 UTC (02:50, 03:00 e 03:10 em São Paulo) os três diários; nas madrugadas de segunda, quarta e sexta, os três semanais. De 5 em 5 minutos o reconciliador confere, dentro do banco, se ficou alguma execução pelo caminho.
2. **"Esse job rodou?"** `select * from jobs.v_job_health;` devolve uma linha por job com última execução, status, duração e estatísticas.
3. **"Preciso rodar agora."** `select jobs.trigger_http('cleanup-expired-pre-reservations', 'manual');` no SQL Editor. O ledger registra `trigger = 'manual'`. **Cuidado com qual job**: os dois de limpeza são seguros para disparo manual a qualquer hora; `attendance-status-updater` distribui advertência e desativa conta, e os quatro de e-mail mandam e-mail de verdade. Para esses, disparo manual é decisão consciente, não teste (§11, decisão de Q-6).
4. **"Um job está com problema, quero desligar só ele."** `update jobs.job_definition set enabled = false where name = '...'; select jobs.sync_schedules();`
5. **Falhou sozinho.** O reconciliador roda de 5 em 5 minutos, marca a execução travada como `failed`, retenta se ainda houver tentativa disponível e, se acabarem, deixa para o digest da manhã, que chega em `DEVELOPER_EMAIL`.

## 7. Design técnico

### Arquitetura e responsabilidades

```
pg_cron (cron.job)                     ← único relógio, expressões em UTC
   │
   ├── kind = 'sql'  → jobs.run_sql('<nome>')      ← só reconcile e prune_history
   │                      ├── pg_try_advisory_xact_lock  (exclusão mútua)
   │                      ├── insert jobs.job_run (running)
   │                      ├── execute jobs.<funcao>()    → jsonb de stats
   │                      └── update jobs.job_run (succeeded | failed)
   │
   └── kind = 'http' → jobs.trigger_http('<nome>')  ← os sete jobs de negócio
                          ├── lê Vault (base_url, segredo)
                          ├── insert jobs.job_run (dispatched)   ─┐ mesma
                          └── net.http_post(...)                 ─┘ transação
                                      │
                                      ▼
                        POST https://gestao-api.bbz.com.br/v1/internal/jobs/:name
                                      │
                         api/jobs.js (função dedicada na Vercel)
                                      │
                          rota interna → registry → handler
                                      │
                          jobs.claim_run → executa → jobs.finish_run
```

Responsabilidades, uma por caixa:

| Componente | Responsabilidade | O que ele **não** faz |
| --- | --- | --- |
| `cron.job` | Saber a hora | Saber o que o job faz |
| `jobs.job_definition` | Ser a verdade declarativa das agendas | Guardar histórico |
| `jobs.job_run` | Ser o histórico e o mecanismo de exclusão | Decidir agenda |
| `jobs.trigger_http` | Registrar a intenção e entregar o gatilho | Esperar resultado |
| Rota interna | Autenticar, reclamar a execução, executar, reportar | Agendar |
| Registry TS | Mapear nome → handler | Conhecer HTTP ou SQL |
| Handler | A regra de negócio, que não muda | Saber que existe cron |
| `jobs.reconcile` | Watchdog e retry | Executar regra de negócio |

### Por que o `pg_net` disparar e o ledger decidir

O `net.http_post` é assíncrono e só entra na fila **depois do commit** da transação que o chamou. Isso é a peça que dá exatamente-uma-vez de graça: o `insert` no ledger e o enfileiramento do POST estão na mesma transação, então não existe estado em que o gatilho saiu e o registro não existe, nem o contrário.

O que o `pg_net` **não** dá: resposta confiável. Ela vai para `net._http_response`, tabela **unlogged**, purgada em 6 horas, e o `timeout_milliseconds` cancela a espera do lado do banco sem cancelar o trabalho do lado da API. Por isso o resultado é gravado pela própria API (`jobs.finish_run`), e `net._http_response` é usado só como fonte auxiliar de diagnóstico pelo watchdog (status 401/5xx, `timed_out`, `error_msg`).

### Fuso horário

O pg_cron avalia as expressões no fuso de `cron.timezone`, que no Supabase é GMT/UTC e não é ajustável pelo usuário. Não é problema: **o Brasil não tem horário de verão desde 2019**, então `America/Sao_Paulo` é UTC−3 fixo, e a conversão é aritmética estável.

| Job | Hoje (6 campos, `America/Sao_Paulo`) | pg_cron (5 campos, UTC) | Horário local |
| --- | --- | --- | --- |
| `cleanup-expired-pre-reservations` | intervalo de 30 min a partir do boot | `*/30 * * * *` | :00 e :30 de cada hora |
| `cleanup-expired-reservations` | `0 50 2 * * *` | `50 5 * * *` | 02:50 |
| `attendance-status-updater` | `0 0 3 * * *` | `0 6 * * *` | 03:00 |
| `email-notification-data-collector` | `0 10 3 * * *` | `10 6 * * *` | 03:10 |
| `weekly-compliance-wednesday-reminder` | `0 0 2 * * 3` | `0 5 * * 3` | quarta 02:00 |
| `weekly-compliance-friday-report` | `0 0 2 * * 5` | `0 5 * * 5` | sexta 02:00 |
| `weekly-early-checkout-monday-reminder` | `0 10 2 * * 1` | `10 5 * * 1` | segunda 02:10 |

Nenhum dos horários cruza a meia-noite na conversão (02:00–03:10 local vira 05:00–06:10 UTC do **mesmo** dia), então o dia da semana não desloca: segunda continua 1, quarta 3, sexta 5.

**Mudança de comportamento deliberada:** o job de pré-reservas deixa de contar 30 minutos a partir do boot da instância e passa a rodar alinhado ao relógio de parede, em `:00` e `:30`. É o comportamento de cron nativo e o motivo de o job existir.

**Fio-terra de horário de verão.** Se o Brasil voltar a adotar DST, os jobs continuam rodando, uma hora fora do horário local pretendido. O reconciliador verifica o desvio e o digest reporta:

```sql
select utc_offset = interval '-3 hours' as offset_esperado
from pg_timezone_names
where name = 'America/Sao_Paulo';
```

### Dados e migração

**Estado atual confirmado.** Não existe schema `jobs`. As 17 tabelas de `public` têm `relrowsecurity = true` e **nenhuma policy** — o acesso funciona porque o papel que a API usa, `postgres`, tem `rolbypassrls = true` (verificado em 2026-09-21). A PK dominante é `uuid default gen_random_uuid()` em 14 tabelas; as três de log ou apoio (`backup_logs`, `email_types`, `pgmigrations`) usam sequence `integer`.

**Estado-alvo.** Schema `jobs` com duas tabelas, quatro funções de runtime, duas funções de job interno e uma view. Mais uma alteração em tabela existente, o `CHECK` de `space_reservations.email_notification_status`. A visão está em [jobs-pg-cron-supabase.dbml](jobs-pg-cron-supabase.dbml), **parcial** por desenho: cobre as tabelas criadas e a coluna alterada, sem redesenhar o domínio.

```dbml
Table jobs.job_definition {
  name           text      [pk, note: 'mesmo nome em cron.job, no registry TS e na rota']
  kind           text      [not null, note: "check in ('sql','http')"]
  schedule_utc   text      [not null, note: 'expressao cron de 5 campos, avaliada em UTC']
  schedule_label text      [not null, note: 'agenda em horario de Sao Paulo, para humanos']
  sql_function   text      [null, note: 'obrigatorio quando kind = sql']
  http_path      text      [null, note: 'obrigatorio quando kind = http']
  timeout_ms     integer   [not null, default: 30000, note: 'teto de execucao; a API deriva dele o proprio prazo (RB-7)']
  max_attempts   smallint  [not null, default: 1]
  enabled        boolean   [not null, default: false, note: 'nasce desligado: ligar e acao humana, nao efeito de deploy']
  description    text      [not null]
  created_at     timestamptz [not null, default: `now()`]
  updated_at     timestamptz [not null, default: `now()`]
}

Table jobs.job_run {
  id            bigint      [pk, increment, note: 'generated always as identity']
  job_name      text        [not null, ref: > jobs.job_definition.name]
  scheduled_for timestamptz [not null, note: "date_trunc('minute', now()) no disparo"]
  attempt       smallint    [not null, default: 1]
  status        text        [not null, note: "check in ('dispatched','running','succeeded','partial','failed','skipped')"]
  trigger       text        [not null, default: 'pg_cron', note: "check in ('pg_cron','manual','retry')"]
  request_id    bigint      [null, note: 'id devolvido por net.http_post']
  started_at    timestamptz [null]
  finished_at   timestamptz [null]
  stats         jsonb       [not null, default: `'{}'`]
  error         text        [null]
  created_at    timestamptz [not null, default: `now()`]

  indexes {
    (job_name, scheduled_for, attempt) [unique, note: "parcial: where status <> 'skipped'"]
    (job_name, created_at)
    status [note: "parcial: where status in ('dispatched','running')"]
  }
}
```

Três decisões de modelagem que merecem revisão:

- **PK `bigint generated always as identity`, e não `uuid`.** Diverge da convenção dominante do repositório de propósito: `job_run` é ledger append-only de alto volume, e UUID v4 como PK fragmenta índice (regra `schema-primary-keys`). O precedente interno é `backup_logs`, mesma natureza, que já usa sequence. Registrado aqui por ser divergência consciente, não descuido.
- **Índice único parcial, excluindo `skipped`.** Execução pulada não é tentativa e não pode disputar a chave com a execução que a pulou — sem a cláusula parcial, um disparo manual no mesmo minuto de um automático teria o registro do skip descartado em silêncio. O predicado é seguro porque `skipped` é terminal no `insert`: nenhuma linha entra ou sai do índice depois.
- **Sem coluna `resumable`.** Retomabilidade é propriedade de como o handler foi escrito, não da agenda. Vive no registry TypeScript; duplicá-la no banco criaria dois donos para o mesmo fato, sem consumidor do lado SQL. A `description` da definição menciona quando o job é retomável.

**RLS.** `jobs.job_definition` e `jobs.job_run` nascem com `enable row level security` e **nenhuma policy**, idêntico às 17 tabelas de `public` (RB-8). Não é cerimônia: o schema não é exposto na API REST, mas tabela protegida por padrão é o piso do projeto, e o custo é zero porque `postgres` ignora RLS.

**Alteração em tabela existente.** O `CHECK` de `space_reservations.email_notification_status` ganha o valor `'sending'`, para reservar a linha antes de mandar o e-mail (§0.5). O constraint atual está em [baseline:276](../../../supabase/migrations/20260918000000_baseline.sql#L276) e aceita apenas `not-evaluated`, `pending`, `sent`, `not-required`, `error`. Postgres não tem `add constraint if not exists` (regra `schema-constraints`), então a troca é `drop constraint if exists` seguido de `add constraint` dentro de um bloco `do`, nos dois sistemas de migration.

Migrations, respeitando a divisão de §2:

| Arquivo | Sistema | Conteúdo |
| --- | --- | --- |
| `supabase/migrations/<ts>_jobs_runtime.sql` | Supabase (prod + cópia) | extensões, schema `jobs`, as duas tabelas com RLS, as funções, a view e as definições dos 10 jobs — todas com `enabled = false`, de modo que a migration não liga nada sozinha (§11) |
| `supabase/migrations/<ts>_email_status_sending.sql` | Supabase (prod + cópia) | troca do `CHECK` de `email_notification_status` |
| `src/infra/migrations/<ts>_add-sending-to-email-notification-status.js` | node-pg-migrate (local) | a mesma troca do `CHECK`, para o desenvolvimento local |

**As duas migrations Supabase são idempotentes**, porque a primeira pode falhar no meio — `create extension pg_net` é o candidato mais provável — e o `supabase db push` do CI reexecuta o arquivo inteiro: `create schema if not exists`, `create table if not exists`, `create or replace function`, constraint em bloco `do`, e `insert ... on conflict (name) do update` nas definições, que também é o que mantém `updated_at` vivo sem precisar de trigger.

O schema `jobs` **não** é criado no banco local: o handler só fala com o ledger quando a requisição traz `runId`, e localmente os jobs são executados por `npm run job:run`, que chama o handler direto. Isso evita manter o mesmo schema em dois sistemas de migration.

Migration não guarda segredo. Os segredos do lado do banco são criados à mão, uma vez por projeto, na Fase 0:

```sql
select vault.create_secret('https://gestao-api.bbz.com.br', 'jobs_base_url');
select vault.create_secret('<segredo gerado>',              'jobs_trigger_secret');
-- só no projeto de validação, porque preview tem proteção SSO:
select vault.create_secret('<bypass da Vercel>',            'jobs_protection_bypass');
```

### As funções do schema `jobs`

Esqueleto do que a migration cria. Não é pseudocódigo: é a forma pretendida.

Três regras valem para todas. **`security invoker`**, que é o default: o único chamador é `postgres`, dono de todos os objetos, então `security definer` não compraria nada e abriria a classe de problema que o linter do Supabase chama de `function_search_path_mutable`. **`set search_path = ''`**, com todo objeto qualificado pelo schema — é o que impede que um schema plantado no caminho de busca sequestre `public.space_slots`. E **nenhum `grant execute` para `anon` ou `authenticated`**.

```sql
create schema if not exists jobs;
revoke all on schema jobs from anon, authenticated;
comment on schema jobs is 'Runtime dos jobs agendados. Nao exposto na API.';

-- create table if not exists jobs.job_definition (...);
-- create table if not exists jobs.job_run (...);

alter table jobs.job_definition enable row level security;
alter table jobs.job_run        enable row level security;
-- Sem policy, de proposito: o acesso vem do papel postgres, que tem
-- rolbypassrls. E o mesmo padrao das 17 tabelas de public (RB-8).

create unique index if not exists job_run_slot_uniq
  on jobs.job_run (job_name, scheduled_for, attempt)
  where status <> 'skipped';
```

```sql
-- Reconcilia cron.job a partir da tabela declarativa. Idempotente.
create or replace function jobs.sync_schedules()
returns table (job text, acao text)
language plpgsql
set search_path = ''
as $$
declare
  d record;
begin
  for d in select * from jobs.job_definition order by name loop
    -- Validacao 1: o job SQL aponta para uma funcao que existe.
    if d.kind = 'sql' and pg_catalog.to_regprocedure(d.sql_function || '()') is null then
      raise exception 'job %: funcao % nao existe', d.name, d.sql_function;
    end if;

    -- Validacao 2: RB-7. Abaixo do piso, o prazo que a API deriva ficaria
    -- negativo e o watchdog passaria a matar execucao viva.
    if d.timeout_ms < 30000 then
      raise exception 'job %: timeout_ms % abaixo do piso de 30000', d.name, d.timeout_ms;
    end if;

    if d.enabled then
      perform cron.schedule(
        d.name,
        d.schedule_utc,
        case d.kind
          when 'sql'  then pg_catalog.format('select jobs.run_sql(%L)', d.name)
          else             pg_catalog.format('select jobs.trigger_http(%L)', d.name)
        end
      );
      return query select d.name, 'agendado'::text;
    else
      if exists (select 1 from cron.job where jobname = d.name) then
        perform cron.unschedule(d.name);
      end if;
      return query select d.name, 'desagendado'::text;
    end if;
  end loop;
end;
$$;
```

`cron.schedule` com um `jobname` que já existe substitui a definição, então a função serve tanto para criar quanto para alterar agenda. Retirar um job do ar é `enabled = false` (RB-1), nunca `delete`.

```sql
-- Corpo dos jobs de runtime: exclusao mutua, prazo e ledger.
create or replace function jobs.run_sql(p_job text, p_trigger text default 'pg_cron')
returns void
language plpgsql
set search_path = ''
as $$
declare
  d        jobs.job_definition;
  v_slot   timestamptz := pg_catalog.date_trunc('minute', pg_catalog.now());
  v_inicio timestamptz := pg_catalog.clock_timestamp();
  v_stats  jsonb;
  v_erro   text;
begin
  select * into d from jobs.job_definition where name = p_job and enabled;
  if not found then
    raise warning 'job % inexistente ou desabilitado', p_job;
    return;
  end if;

  -- O equivalente honesto do preventOverrun: se a execucao anterior ainda
  -- roda, esta desiste e fica registrada como skipped.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_job, 0)) then
    insert into jobs.job_run (job_name, scheduled_for, status, trigger, error)
    values (p_job, v_slot, 'skipped', p_trigger, 'execucao anterior em andamento');
    return;
  end if;

  -- O timeout_ms da definicao vira limite real de execucao.
  perform pg_catalog.set_config('statement_timeout', d.timeout_ms::text, true);

  begin
    execute pg_catalog.format('select %s()', d.sql_function) into v_stats;
  exception when others then
    v_erro := pg_catalog.sqlstate || ': ' || pg_catalog.sqlerrm;
  end;

  -- RF-4: job de runtime so entra no ledger quando agiu ou falhou. Quem prova
  -- que ele esta vivo a cada 5 minutos e cron.job_run_details.
  if v_erro is not null or pg_catalog.coalesce((v_stats->>'acted')::boolean, false) then
    insert into jobs.job_run
      (job_name, scheduled_for, status, trigger, started_at, finished_at, stats, error)
    values (
      p_job, v_slot,
      case when v_erro is null then 'succeeded' else 'failed' end,
      p_trigger, v_inicio, pg_catalog.clock_timestamp(),
      pg_catalog.coalesce(v_stats, '{}'::jsonb), v_erro
    );
  end if;
end;
$$;
```

O `insert` acontece no fim, e não no começo, porque para job SQL a transação é uma só: a exclusão mútua já vem do advisory lock e não há outro processo a quem anunciar "estou rodando". O bloco com `exception` abre uma subtransação, então o erro capturado não leva junto o registro que o documenta.

```sql
-- Gatilho dos jobs HTTP. O insert e o POST na mesma transacao.
create or replace function jobs.trigger_http(
  p_job           text,
  p_trigger       text        default 'pg_cron',
  p_attempt       smallint    default 1,
  p_scheduled_for timestamptz default null
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  d          jobs.job_definition;
  v_slot     timestamptz := pg_catalog.coalesce(p_scheduled_for, pg_catalog.date_trunc('minute', pg_catalog.now()));
  v_base     text;
  v_secret   text;
  v_bypass   text;
  v_headers  jsonb;
  v_run      bigint;
  v_request  bigint;
begin
  select * into d from jobs.job_definition where name = p_job and enabled and kind = 'http';
  if not found then
    raise warning 'job % inexistente, desabilitado ou nao-http', p_job;
    return null;
  end if;

  select decrypted_secret into v_base   from vault.decrypted_secrets where name = 'jobs_base_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'jobs_trigger_secret';
  if v_base is null or v_secret is null then
    raise exception 'segredos jobs_base_url/jobs_trigger_secret ausentes no Vault';
  end if;

  -- Uma execucao ativa por job. O teto e o timeout da definicao mais folga.
  if exists (
    select 1 from jobs.job_run r
     where r.job_name = p_job
       and r.status in ('dispatched','running')
       and pg_catalog.coalesce(r.started_at, r.created_at) >
           pg_catalog.now() - (d.timeout_ms * interval '1 millisecond') - interval '60 seconds'
  ) then
    insert into jobs.job_run (job_name, scheduled_for, attempt, status, trigger, error)
    values (p_job, v_slot, p_attempt, 'skipped', p_trigger, 'execucao anterior em andamento');
    return null;
  end if;

  insert into jobs.job_run (job_name, scheduled_for, attempt, status, trigger)
  values (p_job, v_slot, p_attempt, 'dispatched', p_trigger)
  returning id into v_run;

  v_headers := pg_catalog.jsonb_build_object(
    'Content-Type',  'application/json',
    'x-jobs-secret', v_secret
  );

  select decrypted_secret into v_bypass from vault.decrypted_secrets where name = 'jobs_protection_bypass';
  if v_bypass is not null then
    v_headers := v_headers || pg_catalog.jsonb_build_object('x-vercel-protection-bypass', v_bypass);
  end if;

  select net.http_post(
    url                  := v_base || d.http_path,
    body                 := pg_catalog.jsonb_build_object(
                              'job',          p_job,
                              'runId',        v_run,
                              'scheduledFor', v_slot,
                              'timeoutMs',    d.timeout_ms   -- RB-7
                            ),
    headers              := v_headers,
    timeout_milliseconds := d.timeout_ms
  ) into v_request;

  update jobs.job_run set request_id = v_request where id = v_run;
  return v_run;
end;
$$;
```

Mais quatro funções, sem o corpo aqui para não alongar:

- `jobs.claim_run(p_run bigint, p_job text) returns boolean` — `update ... set status='running', started_at=now() where id = p_run and job_name = p_job and status = 'dispatched'`. Devolve `false` quando a linha não estava `dispatched`, o que é a proteção contra reentrega do mesmo gatilho.
- `jobs.finish_run(p_run bigint, p_status text, p_stats jsonb, p_error text)` — fecha a execução. Chamada pela API.
- `jobs.reconcile()` — agendada `*/5 * * * *`. Devolve `jsonb` com `acted`, para obedecer RF-4. Faz três coisas: (a) marca como `failed` toda execução `dispatched`/`running` mais velha que `timeout_ms + 60s`, anexando ao `error` o que houver em `net._http_response` para o `request_id` — passadas 6 horas essa fonte já expirou e o erro fica `sem resposta registrada`; (b) redispara com `attempt + 1` e o mesmo `scheduled_for` toda execução `failed`/`partial` cujo job tenha `attempt < max_attempts`; (c) verifica o desvio de fuso e emite `raise warning` se `America/Sao_Paulo` deixar de ser UTC−3.
- `jobs.prune_history()` — agendada `0 7 * * 0`. Devolve `jsonb` com `acted`. Apaga `cron.job_run_details` com mais de 30 dias e `jobs.job_run` com mais de 90. Depende do grant que a Supabase dá ao papel `postgres` sobre o schema `cron`; se um restore não o reaplicar, o job falha — e falhar é o comportamento certo, porque aparece no digest em vez de a tabela voltar a crescer em silêncio.

`jobs.run_sql` existe para `reconcile` e `prune_history`, e só para eles. É deliberado: um watchdog que dependesse do mesmo caminho HTTP que ele vigia não teria como agir justamente quando fosse necessário, e a poda mexe em `cron.job_run_details`, que é faxina do próprio banco e não tem por que sair para a internet e voltar.

### Os dois jobs de limpeza

Ficam em TypeScript, como os outros cinco, e o `DELETE` de cada um é preservado **literalmente**, incluindo a avaliação de `CURRENT_DATE` em UTC — que é o fuso da sessão em ambos os ambientes hoje, e portanto a semântica atual:

```ts
export async function runCleanupExpiredReservations(): Promise<JobResult> {
  const result = await database.query({
    text: `
      DELETE FROM space_slots
      WHERE status = 'reserved'
      AND (upper(slot_range))::date < CURRENT_DATE
      RETURNING id
    `,
  })

  return { status: 'succeeded', stats: { deleted: result.rowCount ?? 0 } }
}
```

O que muda em relação a hoje não é o SQL: é que o `try/catch` que engolia o erro (`app.log.error` e segue) dá lugar ao contrato do handler — erro sobe, vira `failed` no ledger e entra no retry. Job que falha em silêncio é exatamente o que esta spec existe para acabar.

### As dez agendas

Sete jobs de negócio em TypeScript (`kind = 'http'`) e três de infraestrutura, dos quais dois em SQL:

| Nome | kind | UTC | Local | timeout_ms | max_attempts | retomável (no handler) |
| --- | --- | --- | --- | --- | --- | --- |
| `cleanup-expired-pre-reservations` | http | `*/30 * * * *` | :00 e :30 | 30000 | 2 | não |
| `cleanup-expired-reservations` | http | `50 5 * * *` | 02:50 | 30000 | 2 | não |
| `attendance-status-updater` | http | `0 6 * * *` | 03:00 | 120000 | 3 | não |
| `email-notification-data-collector` | http | `10 6 * * *` | 03:10 | 240000 | 3 | **sim** |
| `weekly-compliance-wednesday-reminder` | http | `0 5 * * 3` | quarta 02:00 | 60000 | 3 | não |
| `weekly-compliance-friday-report` | http | `0 5 * * 5` | sexta 02:00 | 180000 | 3 | não |
| `weekly-early-checkout-monday-reminder` | http | `10 5 * * 1` | segunda 02:10 | 180000 | 3 | não |
| `internal-jobs-reconcile` | sql | `*/5 * * * *` | a cada 5 min | 30000 | 1 | não |
| `internal-jobs-prune-history` | sql | `0 7 * * 0` | domingo 04:00 | 60000 | 1 | não |
| `internal-jobs-health-digest` | http | `0 10 * * *` | 07:00 | 60000 | 2 | não |

Nenhuma agenda coincide com outra dentro do mesmo minuto, exceto o reconciliador de 5 minutos, que é curto. Fica dentro da recomendação da Supabase de no máximo 8 jobs concorrentes e 10 minutos por job, e muito abaixo do teto de 32 do pg_cron.

### A rota interna

```
POST /v1/internal/jobs/:name
Headers: x-jobs-secret: <segredo>
Body:    { "job": "...", "runId": 123, "scheduledFor": "...", "timeoutMs": 120000 }
```

Arquivos novos:

- `src/api/v1/internal/jobs/jobs-run.ts` — controller.
- `src/routes/internalRoutes.ts` — registro, adicionado ao array de [src/routes/index.ts](../../../src/routes/index.ts).
- `src/infra/jobs/registry.ts` — mapa `nome → { handler, resumable }`.
- `src/infra/jobs/types.ts` — `JobResult` e `JobContext`.
- `src/infra/jobs/cli.ts` — runner local (`npm run job:run -- <nome>`).

Comportamento do handler HTTP, em ordem:

1. Compara `x-jobs-secret` com `env.JOBS_TRIGGER_SECRET` usando `timingSafeEqual` sobre buffers de mesmo tamanho. Diferente ou ausente → **401**, sem tocar no banco e sem revelar se o job existe.
2. `:name` no registry? Não → **404**.
3. `runId` presente → `jobs.claim_run`. Devolveu `false` → **409** (`{ "skipped": "run já reclamada" }`). Isso é o que impede execução dupla se o mesmo gatilho chegar duas vezes.
4. `runId` ausente → permitido só quando `NODE_ENV=development` (execução sem ledger, para teste local). Em produção → **400**. Rodar na mão em produção é `select jobs.trigger_http('<nome>', 'manual')`, que cria o registro e mantém o histórico íntegro.
5. Executa o handler com um `JobContext` que carrega `deadlineAt = now + min(JOBS_TIME_BUDGET_MS, timeoutMs − 10 s)`. O handler consulta `ctx.isPastDeadline()` entre unidades de trabalho. Os dois fatos vêm de donos diferentes de propósito: o teto da plataforma é variável de ambiente, porque depende do plano da Vercel; o teto do job vem do banco, que é quem também arma o watchdog. Tomar o menor dos dois é o que torna RB-7 verdadeiro por construção, em vez de por disciplina.
6. Handler devolve `{ status: 'succeeded' | 'partial', stats }` → `jobs.finish_run` → **200** com o mesmo corpo. Exceção → `jobs.finish_run(..., 'failed', ...)` → **500**.
7. `schema: { hide: true }` mantém a rota fora do Swagger. Nenhum middleware de JWT ou CSRF é registrado nela (RB-6).

### Orçamento de tempo e o job de e-mail

O job de e-mail processa até `MAX_EMAILS_PER_DAY = 60` notificações a `EMAILS_PER_SECOND = 1` ([attendance-status.ts:311](../../../src/infra/jobs/attendance/attendance-status.ts#L311)) — algo em torno de 60 a 90 segundos, acima do `maxDuration` default de função serverless. Duas providências:

1. **Função dedicada na Vercel.** Nova entrada `api/jobs.js`, idêntica em forma a [api/index.js](../../../api/index.js), com `maxDuration` e memória próprios; a rota interna é reescrita para ela **antes** do catch-all:

```json
{
  "functions": {
    "api/index.js": { "includeFiles": "build/**" },
    "api/jobs.js":  { "includeFiles": "build/**", "maxDuration": 300, "memory": 1024 }
  },
  "rewrites": [
    { "source": "/v1/internal/jobs/(.*)", "destination": "/api/jobs" },
    { "source": "/(.*)",                   "destination": "/api/index" }
  ]
}
```

2. **Encerramento parcial.** O prazo efetivo é `min(JOBS_TIME_BUDGET_MS, timeoutMs − 10 s)` (RB-7). `JOBS_TIME_BUDGET_MS` tem default 50000 para caber em qualquer plano, e sobe a 240000 depois de confirmar o teto do plano (Q-1) — momento em que `timeout_ms` do job de e-mail, hoje 240000, precisa subir junto, senão o prazo volta a ser ditado pelo watchdog. Ao estourar, o job para na fronteira de um envio e devolve `partial` com `stats.remaining`. O reconciliador redispara em até 5 minutos. Isso é seguro porque o job é naturalmente retomável: a seleção é `email_notification_status in ('pending','error')`, então o que sobrou continua elegível.

### Correção dos dois defeitos pré-existentes

- **PD-1, advertência fora de transação.** `database.ts` ganha `withTransaction(fn)`, que pega um cliente do pool, faz `BEGIN`, entrega o cliente ao callback e fecha com `COMMIT`/`ROLLBACK`. O processamento de cada reserva no job de presença passa a rodar dentro desse bloco, de modo que "reserva atualizada" e "advertência somada" viram um único fato. O `database.query` atual pega um cliente por query ([database.ts:63](../../../src/infra/database.ts#L63)) e não serve para isso.
- **PD-2, e-mail marcado depois do envio.** Antes de chamar `sendEmail`, o job reserva a linha:

```sql
update space_reservations
   set email_notification_status = 'sending', updated_at = now()
 where id = $1
   and email_notification_status in ('pending','error')
returning id
```

Sem linha devolvida, outra execução já pegou e esta passa adiante. Depois do envio, `sent`; em erro de envio, `error`. Linha presa em `sending` **não** é liberada automaticamente: reverter às cegas é justamente o que provoca envio duplicado. Ela aparece no digest depois de 24 horas, para decisão humana. É isso que exige `'sending'` no `CHECK` (§7, Dados e migração).

### Configuração de ambiente

Novas variáveis em [src/infra/env.ts](../../../src/infra/env.ts) e em [.env.example](../../../.env.example):

| Variável | Tipo | Default | Papel |
| --- | --- | --- | --- |
| `JOBS_TRIGGER_SECRET` | `string` (mín. 32) | — | Segredo da rota interna. Obrigatória |
| `JOBS_TIME_BUDGET_MS` | `number` | `50000` | Orçamento de tempo por execução |

`JOBS_TRIGGER_SECRET` entra no schema como obrigatória e com mínimo de tamanho, no mesmo espírito do `superRefine` de `STORAGE_DRIVER` ([env.ts:111](../../../src/infra/env.ts#L111)): falha no boot, e não na primeira execução.

```ts
JOBS_TRIGGER_SECRET: z
  .string()
  .min(32, 'JOBS_TRIGGER_SECRET precisa de no mínimo 32 caracteres.'),
JOBS_TIME_BUDGET_MS: z.coerce.number().int().positive().default(50000),
```

E [src/app.ts](../../../src/app.ts) perde o bloco do agendador — não há condicional, o código simplesmente deixa de existir:

```ts
// removido: app.register(fastifySchedule)
// removido: app.ready().then(() => setupJobs(app))
```

Do lado do banco, os valores equivalentes vivem no Vault (§7, Dados e migração). O `jobs_trigger_secret` do Vault e o `JOBS_TRIGGER_SECRET` da Vercel são o mesmo valor; rotação é: gravar o novo nos dois lugares (a API aceita o antigo até o redeploy), redeployar, `select vault.update_secret(...)`.

### Segurança e privacidade

| Ativo | Onde vive | Quem lê | Como é protegido |
| --- | --- | --- | --- |
| `jobs_trigger_secret` | Vault (banco) + env var (Vercel) | `postgres` no banco; processo da API | Fora do git; fora de `cron.job.command`; nunca logado; comparação em tempo constante |
| `jobs_base_url` | Vault | `postgres` | Sem segredo, mas fica junto para não ter URL fixa em migration |
| `jobs_protection_bypass` | Vault do projeto de validação | `postgres` | Só existe fora de produção |
| Rota `/v1/internal/jobs/*` | Internet | quem tiver o segredo | 401 sem segredo; fora do Swagger; sem JWT e sem CSRF por desenho (RB-6) |
| Schema `jobs` | Banco | `postgres` | `revoke all ... from anon, authenticated`; não exposto na API REST |

Duas observações que valem explicitar:

- **A rota é pública em rede, não em autorização.** O domínio `gestao-api.bbz.com.br` não tem proteção SSO (é o que permite o gatilho funcionar). Quem descobrir o caminho e não tiver o segredo recebe 401. Quem tiver o segredo consegue disparar job, e é exatamente por isso que o segredo tem mínimo de 32 caracteres e rotação documentada.
- **As funções de `jobs` são `security invoker` com `search_path` fixo.** O pg_cron executa como o usuário que agendou o job e as migrations rodam como `postgres`, que é dono de todos os objetos — `security definer` não compraria nada e deixaria em pé o `function_search_path_mutable` do linter do Supabase, que em função privilegiada é vetor de escalonamento. Com `set search_path = ''` e tudo qualificado, não há caminho de busca a sequestrar. Não há `grant execute` para `anon` nem `authenticated`.
- **As duas tabelas novas têm RLS habilitada e nenhuma policy** (RB-8), o mesmo estado das 17 tabelas de `public`. Quem passa é o papel `postgres`, por `rolbypassrls`. A proteção real continua sendo o schema não exposto e a ausência de grants; a RLS é a rede embaixo, e alinha as tabelas novas ao piso do projeto em vez de abrir exceção.

### Observabilidade

Três camadas, nesta ordem de confiança:

1. **`jobs.job_run`** — verdade sobre o que a aplicação fez. Contém `stats` por job (`{"deleted": 12}`, `{"processed": 43, "emailsSent": 41, "remaining": 0}` etc.).
2. **`cron.job_run_details`** — verdade sobre o que o relógio fez. É onde aparece o caso em que o pg_cron tentou e o comando falhou antes de chegar ao ledger (Vault vazio, por exemplo).
3. **`net._http_response`** — diagnóstico de entrega, com 6 horas de validade. Usado pelo watchdog para explicar um `failed`.

Uma view para consumo humano:

```sql
create or replace view jobs.v_job_health as
select d.name,
       d.schedule_label,
       d.enabled,
       r.status         as last_status,
       r.trigger        as last_trigger,
       r.attempt        as last_attempt,
       r.started_at,
       r.finished_at,
       extract(epoch from (r.finished_at - r.started_at)) * 1000 as duration_ms,
       r.stats,
       r.error
  from jobs.job_definition d
  left join lateral (
    select * from jobs.job_run x
     where x.job_name = d.name
       and x.status in ('succeeded','partial','failed')   -- último estado terminal
     order by x.created_at desc
     limit 1
  ) r on true
 order by d.name;
```

E o job `internal-jobs-health-digest`, que às 07:00 lê essa view, monta uma lista do que falhou, ficou parcial, ficou preso em `sending` por mais de 24 h ou não rodou na janela esperada, e manda um e-mail para `DEVELOPER_EMAIL` **só quando houver algo a dizer**. Silêncio é sinal de que está tudo em ordem — e a ausência do digest por vários dias é detectável pela própria view.

## 8. Falhas e edge cases

| Situação | O que acontece hoje | O que acontece depois |
| --- | --- | --- |
| API em deploy no horário do job | O agendador simplesmente não existe naquele instante | `net.http_post` falha ou dá timeout; a execução fica `dispatched`; o watchdog marca `failed` em ≤ 5 min e redispara, até o `max_attempts` do job — 2 nos de limpeza, 3 nos demais |
| Duas instâncias serverless acordadas | Duas execuções do mesmo job | Uma só: `unique (job_name, scheduled_for, attempt)` e `claim_run` só deixam a primeira passar |
| Job estoura o `maxDuration` da Vercel | Não se aplica | Execução termina como `partial` (orçamento de tempo) ou `failed` (watchdog). Nos dois casos, redisparo |
| Job de e-mail morre no meio | Reenvio dos e-mails já mandados na próxima execução | Linha reservada em `sending` não é reprocessada; aparece no digest para decisão humana |
| SMTP fora do ar | `email_notification_status = 'error'`, retentado no dia seguinte | Igual, mais o retry do mesmo dia. `stats.failed` no ledger e no digest |
| Vault sem os segredos | Não se aplica | `jobs.trigger_http` levanta exceção; o erro fica em `cron.job_run_details` (não em `jobs.job_run`, que nem chega a receber linha). O digest reporta "sem execução" |
| Alguém chama a rota interna sem segredo | Não se aplica | 401, nada executado |
| O mesmo gatilho é entregue duas vezes | Não se aplica | Segunda entrega recebe 409 no `claim_run` |
| Restore ou upgrade in-place do projeto Supabase | Não se aplica | O upgrade dropa e recria o `pg_cron`; as agendas precisam de `select jobs.sync_schedules()` depois. Consta no runbook |
| Projeto Supabase pausado | Não se aplica | Nenhum job roda, nem os SQL. Detectado pela ausência de digest |
| Brasil volta a ter horário de verão | Jobs continuariam corretos (o `toad-scheduler` conhece o fuso) | Jobs rodam 1 h fora do horário local. O reconciliador acusa o desvio e a correção é ajustar `schedule_utc` + `sync_schedules()` |
| `cron.job_run_details` cresce sem limite | Não se aplica | `internal-jobs-prune-history` poda semanalmente. Sem isso, upgrade in-place degrada ou falha |
| Execução `skipped` por sobreposição | `preventOverrun` descartava em silêncio | Fica registrada com o motivo, em vez de desaparecer. O índice único é parcial (`where status <> 'skipped'`) justamente para que o registro do skip nunca colida com a tentativa em curso — sem isso, um disparo manual no mesmo minuto de um automático teria o skip descartado em silêncio |
| `prune_history` perde o privilégio sobre `cron.job_run_details` | Poda para sem avisar e a tabela volta a crescer | A Supabase concede `all privileges on all tables in schema cron to postgres`; um restore que não reaplique o grant quebra isso. O job falha em vez de não fazer nada, e a falha aparece no digest |
| API fora do ar por horas, com o job de 30 min disparando o tempo todo | Não se aplica | São até 48 falhas por dia, cada uma com 1 retry (`max_attempts = 2`, menor que o dos demais justamente por causa da frequência). O digest agrupa por job — "cleanup-expired-pre-reservations: 37 falhas, primeira às 04:00" — em vez de listar execução por execução |

## 9. Estratégia de testes

Não há suíte automatizada no repositório, então a verificação é roteirizada e observável. O portão de sempre continua valendo antes de cada entrega:

```bash
npm run lint:eslint:check && npx tsc --noEmit && npm run build
```

**Nenhum critério de aceite desta spec se prova em navegador.** Não há superfície de UI: os dez critérios de §10 se verificam por query SQL, por log da Vercel ou por inspeção do repositório. O projeto também não tem harness E2E — não há diretório de teste, runner configurado nem suíte ([README:158](../../../README.md#L158)) —, então não há arquivo E2E a nomear. Isto é registro, não omissão.

**Verificação estática nova (entra no CI).** Um script `scripts/jobs/check-registry.mjs` compara as chaves do registry TypeScript com os nomes esperados (lista fixa no próprio script, espelhada da migration) e falha se divergirem. É o que sustenta RB-2 sem depender de conexão com o banco no CI.

**Roteiro no projeto de validação (`gestao_reservas_copy`), Fase 2:**

| # | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | `select extname, extversion from pg_extension where extname in ('pg_cron','pg_net','supabase_vault')` | três linhas |
| 2 | `show cron.timezone` | `GMT`/`UTC`. Se for outro valor, §7 precisa de revisão antes de seguir |
| 3 | `select utc_offset from pg_timezone_names where name = 'America/Sao_Paulo'` | `-03:00:00` |
| 4 | `select jobname, schedule from cron.job order by jobname` | as 10 agendas de §7, com as expressões da tabela |
| 5 | `select jobs.trigger_http('cleanup-expired-pre-reservations','manual')` | linha `succeeded` em `jobs.job_run`, `stats.deleted` numérico |
| 5b | `select jobs.run_sql('internal-jobs-prune-history')` | linha `succeeded`, e `cron.job_run_details` recortado em 30 dias |
| 6 | `curl` na rota interna **sem** header | 401, nenhuma linha nova no ledger |
| 7 | `curl` com header e `runId` inexistente | 409 |
| 8 | `select jobs.trigger_http('attendance-status-updater','manual')` | linha `dispatched` → `running` → `succeeded`; `request_id` preenchido; `net._http_response` com 200 |
| 9 | Repetir o item 8 imediatamente | segunda chamada devolve `null` e grava `skipped` |
| 10 | `update jobs.job_run set status='running', started_at = now() - interval '1 hour' where id = <x>` e `select jobs.reconcile()` | a linha vira `failed`; nova tentativa com `attempt = 2` e o mesmo `scheduled_for` |
| 11 | `JOBS_TIME_BUDGET_MS=3000` e disparar o job de e-mail com fila cheia | `partial` com `stats.remaining > 0`; reconciliador redispara |
| 12 | Derrubar o SMTP (credencial inválida) e disparar o job de e-mail | reservas ficam em `error`, nenhuma em `sending`, ledger `succeeded` com `stats.failed > 0` |
| 13 | `git grep -nE "fastifySchedule|toad-scheduler|app.scheduler" src/` | nenhuma ocorrência: não existe agendador no código |
| 15 | `select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='jobs'` | as duas tabelas com `relrowsecurity = true` (RB-8) |
| 16 | `select proname, prosecdef, proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='jobs'` | `prosecdef = false` e `proconfig` contendo `search_path=` em todas |
| 17 | `update jobs.job_definition set timeout_ms = 10000 where name='attendance-status-updater'; select jobs.sync_schedules();` | exceção sobre o piso de 30000 (RB-7); desfazer depois |
| 18 | Reaplicar `jobs_runtime.sql` inteiro por cima de si mesmo | roda sem erro e sem duplicar definição (idempotência) |
| 19 | Deixar o reconciliador rodar 30 minutos sem nada a fazer | nenhuma linha nova em `jobs.job_run`, e seis execuções em `cron.job_run_details` (RF-4) |
| 14 | Esperar dois ciclos de `*/30` | duas execuções, em `:00` e `:30`, sem sobreposição |

**Roteiro em produção, Fase 3:** itens 1 a 4, 8 e 9, mais uma semana de observação cobrindo segunda, quarta e sexta, com conferência diária de `jobs.v_job_health` e do digest.

## 10. Critérios de aceite

1. `select count(*) from cron.job` devolve 10, e cada `jobname` corresponde a uma linha `enabled` de `jobs.job_definition`, com a expressão UTC da tabela de §7.
2. `@fastify/schedule`, `toad-scheduler` e `croner` não constam mais do `package.json`, e o log de boot da função serverless **não** contém "Jobs agendados com sucesso".
3. Os sete jobs de negócio estão no registry de `src/infra/jobs/` e nenhum deles tem regra de negócio dentro de migration: `git grep -n "DELETE FROM\|UPDATE " supabase/migrations/<ts>_jobs_runtime.sql` não devolve nada que toque em tabela de domínio.
4. Sete dias corridos de operação com: uma execução `succeeded` por job por janela esperada, zero duplicidade em `(job_name, scheduled_for)` e desvio máximo de `started_at - scheduled_for` abaixo de 120 s.
5. Chamada à rota interna sem segredo, ou com segredo errado, devolve 401 e não cria linha no ledger.
6. Gatilho entregue duas vezes resulta em uma execução e um 409.
7. Execução interrompida por orçamento de tempo aparece como `partial` e é concluída por redisparo automático, sem intervenção.
8. Execução travada é marcada `failed` pelo watchdog em ≤ 5 min e retentada até `max_attempts`.
9. O digest das 07:00 chega quando (e só quando) há falha, execução parcial, linha presa em `sending` por mais de 24 h ou janela sem execução.
10. `jobs.v_job_health` responde "esse job rodou?" para os 10 jobs, com duração e estatísticas.
11. Nenhum segredo aparece em `git grep`, em `cron.job.command`, em log da Vercel ou em resposta HTTP.
11b. As duas tabelas de `jobs` têm RLS habilitada, e nenhuma função de `jobs` é `security definer` nem tem `search_path` mutável (itens 15 e 16 de §9).
12. Rollback executado em ambiente de validação: `enabled = false` + `sync_schedules()` esvazia `cron.job`, nenhum job dispara, e `select jobs.trigger_http('<nome>', 'manual')` continua funcionando — tudo sem deploy de código e sem migration reversa.
13. `internal-jobs-prune-history` roda uma vez e reduz `cron.job_run_details` ao recorte de 30 dias.
14. README atualizado: seção de jobs descreve pg_cron, e a seção de deploy não afirma mais que existe scheduler no processo da API.

## 11. Rollout e rollback

O encadeamento respeita o que o CI já faz: `dev` publica em preview e aplica migration no projeto de validação; `main` publica em produção e aplica migration em produção, **no mesmo job** ([build-action.yml](../../../.github/workflows/build-action.yml)).

### O que o deploy não faz por você

Quatro coisas ficam fora do código e da migration, por motivos diferentes. É a lista inteira: fora disso, o CI resolve.

| Ação manual | Onde | Quando | Por que não é automatizável | Se faltar |
| --- | --- | --- | --- | --- |
| Cadastrar `JOBS_TRIGGER_SECRET` e `JOBS_TIME_BUDGET_MS` | Vercel, ambientes `prod` e `dev` | **Antes** do deploy que leva o código novo | Segredo não entra no repositório | O boot falha no `superRefine` e a **API inteira** para, não só o job. A ordem aqui não é preferência, é requisito |
| Criar os segredos no Vault: `jobs_base_url` e `jobs_trigger_secret` (mais `jobs_protection_bypass` no projeto de validação) | SQL Editor do Supabase, uma vez por projeto | Antes de ligar as agendas | `supabase/migrations/` é versionado; migration com segredo o publicaria no git **e** em `cron.job.command` | `jobs.trigger_http` levanta exceção. Nenhum job dispara e o erro fica em `cron.job_run_details`, não no ledger — porque a linha nem chega a ser criada |
| Gerar o Protection Bypass for Automation | Vercel, configurações do projeto | Antes da Fase 2 | Credencial da plataforma | A validação contra o preview devolve 401 (a proteção SSO cobre tudo que não é domínio customizado) |
| **Ligar as agendas**: `update jobs.job_definition set enabled = true; select jobs.sync_schedules();` | SQL Editor do Supabase | Depois que o deploy estiver verde | É o cutover em si. Ver abaixo | Nada dispara. `cron.job` fica vazio e o sistema segue como antes |

**As definições nascem com `enabled = false`, de propósito.** O CI aplica migration **antes** de publicar; se as agendas já nascessem ligadas, elas começariam a disparar contra o código velho durante os minutos do build e do deploy — o job de 30 minutos pegaria essa janela quase sempre. Com `enabled = false`, a migration cria tudo e `cron.job` permanece vazio até você mandar ligar. O cutover deixa de ser efeito colateral de um merge e vira uma ação de uma linha, no momento que você escolher, com a API já no ar e testável por disparo manual antes.

Duas consequências práticas: dá para ligar **um job por vez** (`where name = '...'`) durante a observação, e o desligamento de emergência é a mesma linha com `false`.

Depois disso, a operação não pede mais nada de você — com uma exceção registrada em §8: **upgrade in-place ou restore do projeto Supabase dropa e recria o `pg_cron`**, e as agendas voltam com `select jobs.sync_schedules();`.

### O acúmulo que já existe

Os jobs pararam de rodar quando o deploy saiu do Render, e isso deixou um passivo. Medido em `kpwxmtqmzzybaolhijxb` em 2026-09-21 — números do banco de produção tendem a ser **maiores**, porque a cópia tem dados até 20/09:

| Medida | Valor |
| --- | --- |
| Reservas com `attendance_status = 'pending'` e encerradas há mais de um dia | 195, de 15/09 a 18/09 |
| Que a primeira execução classificaria como `absent`, com advertência | 183 |
| Usuários que receberiam advertência | 113 |
| **Usuários que cruzariam as 5 advertências e teriam a conta desativada** | **40** |
| E-mails que entrariam na fila (37 já pendentes + 183 novos) | ~220, drenados a 60 por execução |

Ou seja: ligar o `attendance-status-updater` sem mais nada desativa cerca de 40 contas numa manhã e dispara advertências sobre reservas de duas semanas atrás. Isso não é notificação, é incidente — e não é efeito desta spec, é o passivo que ela torna visível.

**Decisão tomada em 2026-09-21 (Q-6): deixar rodar, sem anistia.** O job avalia o passado e emite as advertências. Foi levantada a alternativa de anistiar as 195 reservas, e ela foi recusada: a regra vale para o período, independentemente de a execução ter atrasado. As consequências ficam aceitas e registradas: **~40 contas desativadas** na primeira execução, exigindo reativação administrativa de quem procurar o suporte, e ~4 dias de fila de e-mail a 60 por execução.

Três consequências operacionais decorrem disso e valem como regra da Fase 3:

1. **A primeira execução do `attendance-status-updater` acontece na agenda, às 03:00, e não por disparo manual.** Foi a condição colocada junto com a decisão, e faz sentido: a advertência chega no horário em que ela sempre chegaria, não numa tarde qualquer por causa de um teste.
2. **A validação em produção usa apenas os dois jobs de limpeza.** São os únicos idempotentes e sem efeito externo. O de presença e os de e-mail provam-se na própria agenda.
3. **Avisar o suporte antes do cutover**, com o número medido no dia. Quarenta pessoas descobrindo a conta desativada na manhã seguinte, sem ninguém avisado, é incidente evitável mesmo quando a decisão é deliberada.

**Medir de novo no banco de produção imediatamente antes do cutover** — os números acima são da cópia e o acúmulo cresce um dia por dia.

**Fase 0 — Verificação e segredos.** Confirmar `pg_cron`, `pg_net` e `supabase_vault` nos dois projetos (itens 1–3 de §9) — em 2026-09-21 faltava o `pg_net` na cópia, e ele é pré-requisito do gatilho. Gerar o segredo do gatilho. Criar os três segredos no Vault do projeto de validação e dois (sem o bypass) no de produção. Cadastrar `JOBS_TRIGGER_SECRET` e `JOBS_TIME_BUDGET_MS` nos ambientes `dev` e `prod` da Vercel. Criar o bypass de proteção para automação na Vercel. **Nada muda em produção nesta fase.**

**Fase 1 — Código, na branch `dev`.** Extrair o corpo de cada uma das sete tasks para função pura (`runX(ctx): Promise<JobResult>`), consumida pela rota interna e pelo CLI — o mesmo movimento que a [spec 01](../01-migracao-s3-supabase-storage/migracao-s3-supabase-storage.md) fez ao desacoplar o storage antes de trocar o adapter. Remover `setupJobs`, `app.scheduler`, os wrappers `createXJob` e as três dependências de agendamento. Criar registry, tipos, rota interna, `api/jobs.js`, os rewrites, o CLI `job:run`, o `withTransaction`, a reserva de linha do job de e-mail (PD-1 e PD-2), as variáveis de ambiente e o `check-registry`. Escrever a migration do `CHECK` nos dois sistemas e a `jobs_runtime.sql`. **Merge em `dev`, não em `main`.** Produção segue com o código antigo e o comportamento de hoje, porque `main` não se move nesta fase.

**Fase 2 — Validação fora de produção.** O CI de `dev` aplica `jobs_runtime.sql` no projeto de validação e publica o preview. Ligar as agendas (`update jobs.job_definition set enabled = true; select jobs.sync_schedules();`) e rodar o roteiro completo de §9 contra o preview, com o header de bypass. Ajustar `timeout_ms` e `JOBS_TIME_BUDGET_MS` a partir das durações reais registradas no ledger, e repetir o roteiro. Esta fase termina quando os 14 itens passam.

**Fase 3 — Cutover em produção.** `dev` → `main`: a mesma execução do CI aplica `jobs_runtime.sql` em produção e publica o código em que o agendador em memória não sobe. Nesse ponto ainda não dispara nada — as definições estão `enabled = false`. Com o deploy verde, disparar um job na mão (`select jobs.trigger_http('cleanup-expired-pre-reservations','manual')`) e conferir a linha no ledger; só então ligar as agendas. O relógio troca de dono nessa linha de SQL: em nenhum instante existem dois, e a janela sem nenhum é a distância entre o deploy e o seu comando. Observar uma semana inteira, que é o ciclo mínimo para os três jobs semanais aparecerem.

**Rollback (válido do começo da Fase 2 ao fim da Fase 3):**

```sql
update jobs.job_definition set enabled = false;
select jobs.sync_schedules();
-- e, enquanto investiga, disparo manual com registro no ledger:
select jobs.trigger_http('attendance-status-updater', 'manual');
```

`cron.job` fica vazio, nada dispara sozinho e cada job continua executável por uma linha de SQL. Sem deploy, sem migration reversa, sem tocar em variável de ambiente.

**Voltar o agendador em memória não é rollback, e a spec não oferece esse caminho.** Ele é o defeito que originou a task: em produção ele não dispara nos horários e duplica quando dispara (§2). Trocar um relógio observável por um que não funciona não recupera nada — só devolve o silêncio. Se o problema estiver no código publicado, o rollback é o da Vercel: repromover o deployment anterior, que continua disponível. Se estiver no agendamento, é o SQL acima.

**Fase 4 — Fechar a observabilidade.** Ligar `internal-jobs-health-digest` e `internal-jobs-prune-history` em produção (podem entrar já na Fase 3 desabilitados). Conferir o primeiro digest e a primeira poda.

**Fase 5 — Documentação e fechamento.** Atualizar README (seção de jobs e seção de deploy, que ainda fala de Render e de scheduler no processo da API) e `.env.example`. Registrar o runbook curto: como olhar `jobs.v_job_health`, como rodar um job na mão, como ligar e desligar agenda, e o `sync_schedules()` depois de upgrade do Supabase. A remoção de código já aconteceu na Fase 1; aqui só sobra o que se conta para quem vem depois.

## 12. Riscos e trade-offs

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| **Ligar o relógio faz o passado inteiro desabar de uma vez** | 183 advertências e ~40 contas desativadas numa manhã, mais ~220 e-mails sobre reservas de duas semanas atrás | Risco **aceito** na decisão de Q-6: o job roda e adverte. Mitigação acordada: primeira execução na agenda normal, validação em produção só com os jobs de limpeza, e suporte avisado antes, com o número medido no dia |
| Teto de `maxDuration` do plano da Vercel menor que 300 s (Q-1) | Job de e-mail truncado | `JOBS_TIME_BUDGET_MS` default conservador (50 s), `partial` + redisparo. Funciona em qualquer plano, só leva mais ciclos |
| A rota interna é alcançável da internet | Disparo indevido de job | Segredo de 32+ caracteres, comparação em tempo constante, fora do Swagger, rotação documentada. Job disparado indevidamente é idempotente (RB-5) |
| Upgrade ou restore do Supabase apaga as agendas | Jobs param em silêncio | `sync_schedules()` no runbook de upgrade; digest detecta a ausência em ≤ 24 h |
| `pg_net` é beta e a assinatura pode mudar | Gatilho quebra num upgrade | Uso restrito a `net.http_post` e `net._http_response`, os dois pontos mais estáveis; o ledger não depende do pg_net para saber o resultado |
| Dependência nova: o banco precisa alcançar a internet, e a API precisa estar no ar no horário | Nenhum job de negócio roda se o caminho HTTP estiver quebrado | O reconciliador é SQL e continua vivo: marca as falhas, retenta e alimenta o digest. Nenhuma execução some — no pior caso ela fica registrada como `failed` até alguém agir. Os jobs são higiene ou notificação, nenhum é caminho crítico de uso do sistema |
| Retry pode multiplicar e-mail além do teto diário de 60 | Até 180 e-mails num dia ruim | `max_attempts = 3` e reserva de linha; o teto real passa a ser a fila de pendências, não o número de tentativas |
| Complexidade nova (schema, 5 funções, 3 jobs de infra) | Mais superfície para manter | É o preço de ter garantia observável. A alternativa — só trocar o relógio — deixa falha silenciosa, que é o defeito de hoje |
| Alguém editar a agenda pelo painel do Supabase | Divergência silenciosa entre `cron.job` e o git | O próximo `sync_schedules()` sobrescreve — e isso é desenhado assim. O painel é para ler; a agenda se altera pela migration |
| Entre a Fase 1 e a Fase 3, `dev` e `main` têm agendadores diferentes | Confusão sobre quem disparou o quê | Produção fica intocada na Fase 1 (o merge é em `dev`), e o cutover é um único merge. `jobs.job_run.trigger` registra a origem de toda execução do lado novo; o agendador em memória não escreve no ledger |

## 13. Decisões e alternativas

| Decisão | Por quê | Alternativas descartadas |
| --- | --- | --- |
| pg_cron como relógio único | O banco é o único componente sempre no ar, já é a fonte de verdade dos dados, não tem teto de plano para número de agendas e permite que o mecanismo de recuperação (watchdog e retry) viva fora do caminho que ele vigia | **Vercel Cron** (`crons` no vercel.json): menos peças, mas depende do plano para granularidade de minuto (o job de 30 min precisa), não tem retry, não tem ledger, não roda se o projeto estiver com deploy quebrado e não permite job em SQL puro. **GitHub Actions `schedule`**: atrasos de vários minutos documentados, segredo fora do produto, e o CI deixaria de ser só publicador |
| Manter os sete jobs de negócio em Node | React Email + nodemailer + os repositórios `Pg*` já existem e são testados em produção. E, para os dois de limpeza, vale a uniformidade: um lugar só para procurar job, uma linguagem só para alterá-lo, um caminho só de teste. Mudar a regra de limpeza volta a ser um deploy, como qualquer outra mudança de comportamento, em vez de uma migration | Os dois `DELETE` como função SQL: economizaria ~48 invocações/dia e sobreviveria à API fora do ar, mas partiria o modelo mental em dois e exigiria migration para mudar regra de negócio. O ganho é pequeno — os dois jobs são higiene, e o próprio comentário do job de pré-reservas registra que as queries de disponibilidade já ignoram slot expirado por filtro SQL |
| Funções `security invoker` com `search_path = ''`, em vez de `security definer` | O único chamador é `postgres`, dono dos objetos: o `definer` não acrescenta capacidade nenhuma e acrescenta superfície. Com `search_path` fixo, nenhum schema plantado no caminho de busca sequestra `public.space_slots` | `security definer` sem `search_path`: é o default que a maioria dos exemplos usa e é exatamente o `function_search_path_mutable` que o linter do Supabase acusa |
| PK do ledger em `bigint identity`, contra a convenção `uuid` do repositório | `job_run` é log append-only de alto volume; UUID v4 fragmenta índice. O repositório já abre a mesma exceção em `backup_logs`, que é a mesma natureza | `uuid default gen_random_uuid()`: uniforme com 14 das 17 tabelas, e pior no único lugar onde o volume importa |
| Segredo estático em header, sem HMAC | A skill de backend pede HMAC em webhook, e a decisão de não usar é consciente: o emissor não é um terceiro, é o próprio banco; o canal é TLS; e o replay já morre no `claim_run`, que só aceita execução em estado `dispatched`. HMAC sobre corpo e timestamp acrescentaria cerimônia sem fechar buraco aberto | HMAC com timestamp: correto para webhook de terceiro, desproporcional para chamada do próprio banco |
| Jobs de runtime não registram execução sem efeito | 288 linhas por dia do reconciliador contra ~58 de todos os jobs de negócio somados: o ledger viraria registro do watchdog. Liveness deles se prova em `cron.job_run_details`, que registra sempre | RF-4 literal para todos: uniforme de ler, inútil de usar |
| `jobs.run_sql` existe, mas só para `reconcile` e `prune_history` | Watchdog não pode depender do caminho que vigia; e poda de `cron.job_run_details` é faxina interna do banco | Fazer o reconciliador por HTTP: quando o HTTP quebra, o mecanismo de recuperação quebra junto |
| Ledger próprio em vez de confiar em `cron.job_run_details` | `job_run_details` conta o que o relógio fez, não o que a aplicação fez; com gatilho assíncrono os dois divergem por desenho | Só `job_run_details`: um job que falhou dentro da API apareceria como `succeeded` |
| Resultado gravado pela API, não pela resposta HTTP | `net._http_response` é unlogged, expira em 6 h e o timeout do pg_net cancela a espera, não o trabalho | Ler `net._http_response` como fonte primária: perderia histórico e confundiria "não respondeu" com "não executou" |
| `unique (job_name, scheduled_for, attempt)` com `scheduled_for` truncado no minuto | Transforma duplicidade de execução em erro de banco, no momento em que acontece | Lock distribuído em tabela própria: mesma garantia, mais código, e sem histórico de graça |
| Advisory lock transacional (`pg_advisory_xact_lock`) | Correto sob qualquer modo do pooler; o `.env` de desenvolvimento aponta para o Supavisor (`aws-0-us-east-1.pooler.supabase.com`), onde lock de sessão é armadilha | Lock de sessão: vaza entre requisições no pooler em modo transação |
| Segredo no Vault, não na migration | `supabase/migrations/` é versionado e o `cron.job.command` é legível; migration com segredo o publicaria nos dois lugares | Segredo em GUC (`alter database set app.jobs_secret`): também aparece em `pg_settings` e não tem rotação |
| Função dedicada `api/jobs.js` | Isola `maxDuration` e memória do job do resto da API | Elevar `maxDuration` de `api/index.js`: aplicaria o limite de 5 min a toda requisição pública |
| Preservar literalmente o SQL dos dois `DELETE`, com `set local timezone = 'UTC'` | Esta spec troca o ambiente de execução, não o comportamento. `CURRENT_DATE` hoje é avaliado em UTC nos dois ambientes; fixar isso evita mudança acidental de semântica | Comparar datas em `America/Sao_Paulo`: tecnicamente mais correto para "reserva de data passada" (apagaria slots encerrados ontem à noite, hoje só apagados no dia seguinte). Fica registrado como melhoria futura, fora desta task |
| Remover o agendador em memória de vez na Fase 1, em vez de mantê-lo atrás de um flag | O flag `JOBS_RUNNER` só serviria para disparo automático no ambiente local, que não vale nada: ninguém está com `npm run dev` aberto às 02:50, e o job de 30 minutos disparando local é ruído. Localmente o que se quer é "roda esse job agora", que é o CLI. Sem o flag, "dois relógios" passa a ser impossível por ausência de código, e não por uma variável estar certa | Flag `JOBS_RUNNER=in-process` fora de produção: manteria três dependências e um caminho de execução que ninguém exercita, justamente o tipo de código que apodrece. Mantê-lo como rollback de produção seria pior: trocar um relógio observável por um que comprovadamente não dispara |
| A agenda mora em `jobs.job_definition` (git), não em `cron.job` | `cron.job` é linha em tabela: não aparece em revisão de código, não tem histórico e some num upgrade in-place da extensão. Declarar no repositório e derivar com `sync_schedules()` põe horário de job sob o mesmo controle que o resto do schema | `cron.schedule` à mão no SQL Editor ou pelo painel: mais rápido de fazer e impossível de auditar depois |

## 14. Questões em aberto

| Questão | O que ela decide | Onde se resolve | Bloqueia? |
| --- | --- | --- | --- |
| **Q-1**: Qual o plano da Vercel do time BBZ e, portanto, o teto de `maxDuration`? A API de projetos não expõe o plano | Se `JOBS_TIME_BUDGET_MS` pode ir a 240 s ou fica em 50 s com mais ciclos de redisparo | Painel de billing da Vercel | Não — o default conservador funciona nos dois casos |
| ~~**Q-2**~~ **respondida em 2026-09-21**: em `kpwxmtqmzzybaolhijxb` há `pg_cron` 1.6.4 e `supabase_vault` 0.3.1, mas **`pg_net` não está instalado** (disponível 0.20.4). Em `xgpimigeqhkjaixhggog`, o projeto que a produção usa de fato, ainda não foi verificado | A Fase 0 tem sim um passo de habilitação — ou a migration carrega `create extension if not exists pg_net` | Preflight por `pg` com o `.env` local | Sim, para a Fase 2 |
| ~~**Q-3**~~ **respondida em 2026-09-21, e a resposta é não**: `POSTGRES_USER` na Vercel tem `target: [production, preview]` com o mesmo valor, `postgres.xgpimigeqhkjaixhggog`. **Preview aponta para o banco de produção**, e não existe ambiente `dev` | A Fase 2 não tem onde rodar como especificada. Ou se cria um ambiente `dev` apontando para `kpwxmtqmzzybaolhijxb`, ou a validação acontece em produção com agenda desligada e disparo manual | Variável `POSTGRES_USER` do projeto na Vercel | Sim, para a Fase 2 |
| ~~**Q-6**~~ **decidida em 2026-09-21**: o acúmulo não será anistiado. O job avalia o passado e emite as advertências, desde que na agenda normal (03:00), sem disparo manual antecipado | Consequência aceita: ~40 contas desativadas na primeira execução e ~4 dias de fila de e-mail | Decisão do responsável pela regra de advertência | Resolvida |
| ~~**Q-7**~~ **respondida em 2026-09-21**: produção é `xgpimigeqhkjaixhggog`, e os segredos do Vault foram recriados lá. Falta conferir que o `SUPABASE_PROJECT_ID` do ambiente `prod` no GitHub aponta para o mesmo ref | Onde criar os segredos do Vault e onde a migration precisa chegar | `POSTGRES_USER` do projeto na Vercel | Resolvida |
| **Q-4**: O digest deve ir para `DEVELOPER_EMAIL` ou para uma lista da equipe? | Destinatário do `internal-jobs-health-digest` | Combinar com quem opera | Não — começa em `DEVELOPER_EMAIL` |
| **Q-5**: Linha presa em `sending` por mais de 24 h deve ganhar tratamento automático depois de alguma janela? | Se o digest basta ou se entra uma política de liberação | Depois de observar a frequência real | Não |

### Hipóteses

- **H-1**: `show cron.timezone` devolve GMT/UTC no projeto. Toda a tabela de conversão de §7 depende disso. Verificado no item 2 de §9, **antes** de agendar qualquer coisa.
- **H-2**: A Vercel não aborta a execução da função quando o cliente HTTP desiste (o timeout do pg_net). Se abortar, o job termina sem gravar no ledger e o watchdog o trata como `failed` — degradação aceitável, detectada no item 11 de §9.
- **H-3**: O domínio `gestao-api.bbz.com.br` continua fora da proteção SSO. Se a política mudar para incluir domínios customizados, o gatilho passa a exigir o header de bypass também em produção.
- **H-4**: O volume de e-mails permanece na casa de dezenas por dia. Se passar de algumas centenas, o desenho de "um POST que processa a fila inteira" cede lugar a fila de verdade (`pgmq`), hoje em §4.

## 15. Definition of Ready

```text
Implementation Ready: SIM para a Fase 1
                      NÃO para as Fases 2 e 3, por dois pré-requisitos operacionais

Bloqueios das Fases 2 e 3:
- pg_net não habilitado em xgpimigeqhkjaixhggog, e preflight não repetido lá (Q-2)
- ambiente dev inexistente na Vercel; preview hoje escreve no banco de produção (Q-3)

Hipótese aceita conscientemente:
- H-1, cron.timezone = GMT em produção. Confirmada na cópia, não em produção.
  Validação: item 2 de §9, antes de agendar qualquer coisa.
  Contingência: se divergir, a tabela de conversão de §7 muda antes da Fase 3.
```

```text
Consistência do modelo: APROVADA
- SDD e jobs-pg-cron-supabase.dbml descrevem as mesmas duas tabelas, os mesmos
  campos, tipos, defaults, PK, FK, uniques e índices
- escopo declarado como parcial nos dois documentos
- RLS, policies, funções, agendas, migration e rollback permanecem na SDD, que é
  onde eles podem ser expressos
```

- [x] Problema e evidência do problema descritos com arquivo e linha
- [x] Os sete jobs de negócio inventariados, com agenda, tipo e dependência de SMTP
- [x] Conversão de agenda para UTC verificada campo a campo, com a premissa de fuso isolada em H-1
- [x] Modelo persistente definido, com DBML companheiro do estado-alvo e a alteração do `CHECK` existente
- [x] Revisão de banco aplicada: RLS nas tabelas novas, `security invoker` com `search_path` fixo, PK do ledger justificada, índice único parcial, migrations idempotentes
- [x] Nenhum critério de aceite depende de navegador, e o motivo está registrado em §9
- [x] Contratos definidos: rota interna, corpo, headers, códigos de resposta e retorno do handler
- [x] Mecanismo de execução única, exclusão mútua, watchdog e retry especificados
- [x] Segredos com dono, local de armazenamento e procedimento de rotação
- [x] Restrições da plataforma verificadas na fonte (proteção SSO, rewrites, `maxDuration`, limites do pg_cron e do pg_net)
- [x] Rollout em fases, com rollback sem deploy e sem migration reversa
- [x] Critérios de aceite observáveis por query ou por log
- [x] Roteiro de verificação manual, dado que o repositório não tem suíte
- [x] Q-2, Q-3, Q-6 e Q-7 resolvidas em 2026-09-21 (ver §14); produção é `xgpimigeqhkjaixhggog` e o acúmulo roda sem anistia
- [ ] `pg_net` habilitado em `xgpimigeqhkjaixhggog` e preflight repetido lá. Bloqueia a Fase 3
- [ ] Ambiente `dev` na Vercel apontando para `kpwxmtqmzzybaolhijxb`. Bloqueia a Fase 2, não a Fase 1
