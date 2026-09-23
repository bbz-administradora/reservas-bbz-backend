-- Runtime dos jobs agendados: pg_cron como unico relogio.
--
-- Ver docs/specs/02-jobs-pg-cron-supabase/jobs-pg-cron-supabase.md
--
-- Esta migration NAO liga nenhuma agenda: as definicoes nascem com
-- enabled = false e cron.job continua vazio ate alguem rodar
--
--   update jobs.job_definition set enabled = true;
--   select jobs.sync_schedules();
--
-- O motivo e que o CI aplica migration ANTES de publicar o codigo. Agenda
-- ligada aqui comecaria a disparar contra o deploy antigo durante o build.
--
-- O arquivo inteiro e idempotente de proposito: se falhar no meio, o
-- `supabase db push` reexecuta tudo.

-- ---------------------------------------------------------------------------
-- Extensoes
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

create schema if not exists jobs;
revoke all on schema jobs from anon, authenticated;
comment on schema jobs is 'Runtime dos jobs agendados. Nao exposto na API REST.';

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists jobs.job_definition (
  name           text        primary key,
  kind           text        not null,
  schedule_utc   text        not null,
  schedule_label text        not null,
  sql_function   text,
  http_path      text,
  timeout_ms     integer     not null default 30000,
  max_attempts   smallint    not null default 1,
  enabled        boolean     not null default false,
  description    text        not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table jobs.job_definition is
  'Verdade declarativa das agendas. Append-only em nome: job retirado do ar fica enabled = false.';
comment on column jobs.job_definition.timeout_ms is
  'Teto de execucao. A API deriva dele o proprio prazo: min(JOBS_TIME_BUDGET_MS, timeout_ms - 10s).';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_definition_kind_check') then
    alter table jobs.job_definition
      add constraint job_definition_kind_check check (kind in ('sql','http'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_definition_shape_check') then
    alter table jobs.job_definition
      add constraint job_definition_shape_check check (
        (kind = 'sql'  and sql_function is not null and http_path is null) or
        (kind = 'http' and http_path is not null and sql_function is null)
      );
  end if;

  -- Piso que sustenta RB-7: abaixo disso o prazo derivado pela API ficaria
  -- negativo e o watchdog passaria a matar execucao viva.
  if not exists (select 1 from pg_constraint where conname = 'job_definition_timeout_check') then
    alter table jobs.job_definition
      add constraint job_definition_timeout_check check (timeout_ms >= 30000);
  end if;
end $$;

create table if not exists jobs.job_run (
  id            bigint      generated always as identity primary key,
  job_name      text        not null references jobs.job_definition(name)
                            on update cascade on delete restrict,
  scheduled_for timestamptz not null,
  attempt       smallint    not null default 1,
  status        text        not null,
  trigger       text        not null default 'pg_cron',
  request_id    bigint,
  started_at    timestamptz,
  finished_at   timestamptz,
  stats         jsonb       not null default '{}'::jsonb,
  error         text,
  created_at    timestamptz not null default now()
);

comment on table jobs.job_run is
  'Ledger de execucoes e mecanismo de exclusao. Job de negocio grava sempre; job de runtime so quando agiu ou falhou.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_run_status_check') then
    alter table jobs.job_run
      add constraint job_run_status_check check (
        status in ('dispatched','running','succeeded','partial','failed','skipped')
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_run_trigger_check') then
    alter table jobs.job_run
      add constraint job_run_trigger_check check (trigger in ('pg_cron','manual','retry'));
  end if;
end $$;

-- Parcial, excluindo skipped: execucao pulada nao e tentativa e nao pode
-- disputar a chave com a execucao que a pulou.
create unique index if not exists job_run_slot_uniq
  on jobs.job_run (job_name, scheduled_for, attempt)
  where status <> 'skipped';

create index if not exists job_run_job_recente_idx
  on jobs.job_run (job_name, created_at desc);

create index if not exists job_run_ativos_idx
  on jobs.job_run (status)
  where status in ('dispatched','running');

-- RLS ligada e nenhuma policy, igual as 17 tabelas de public. Quem passa e o
-- papel postgres, que tem rolbypassrls.
alter table jobs.job_definition enable row level security;
alter table jobs.job_run        enable row level security;

-- ---------------------------------------------------------------------------
-- Funcoes
--
-- Todas security invoker (o default) com search_path fixo: o unico chamador e
-- o postgres, dono dos objetos, entao security definer nao acrescentaria
-- capacidade e deixaria em pe o function_search_path_mutable.
-- ---------------------------------------------------------------------------

create or replace function jobs.claim_run(p_run bigint, p_job text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_linhas integer;
begin
  update jobs.job_run
     set status = 'running',
         started_at = pg_catalog.now()
   where id = p_run
     and job_name = p_job
     and status = 'dispatched';

  get diagnostics v_linhas = row_count;
  return v_linhas = 1;
end;
$$;

comment on function jobs.claim_run(bigint, text) is
  'Reclama uma execucao. false quando ela nao estava em dispatched: e a protecao contra reentrega do mesmo gatilho.';

create or replace function jobs.finish_run(
  p_run    bigint,
  p_status text,
  p_stats  jsonb,
  p_error  text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update jobs.job_run
     set status = p_status,
         finished_at = pg_catalog.now(),
         stats = pg_catalog.coalesce(p_stats, '{}'::jsonb),
         error = p_error
   where id = p_run;
end;
$$;

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
  d         jobs.job_definition;
  v_slot    timestamptz := pg_catalog.coalesce(
                             p_scheduled_for,
                             pg_catalog.date_trunc('minute', pg_catalog.now())
                           );
  v_base    text;
  v_secret  text;
  v_bypass  text;
  v_headers jsonb;
  v_run     bigint;
  v_request bigint;
begin
  select * into d
    from jobs.job_definition
   where name = p_job and enabled and kind = 'http';

  if not found then
    raise warning 'job % inexistente, desabilitado ou nao-http', p_job;
    return null;
  end if;

  select decrypted_secret into v_base
    from vault.decrypted_secrets where name = 'jobs_base_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'jobs_trigger_secret';

  if v_base is null or v_secret is null then
    raise exception 'segredos jobs_base_url/jobs_trigger_secret ausentes no Vault';
  end if;

  -- Uma execucao ativa por job.
  if exists (
    select 1
      from jobs.job_run r
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

  select decrypted_secret into v_bypass
    from vault.decrypted_secrets where name = 'jobs_protection_bypass';

  if v_bypass is not null then
    v_headers := v_headers || pg_catalog.jsonb_build_object(
      'x-vercel-protection-bypass', v_bypass
    );
  end if;

  -- O POST so entra na fila depois do commit: o registro no ledger e o gatilho
  -- sao atomicos, e nao existe estado em que um saiu sem o outro.
  select net.http_post(
    url                  := v_base || d.http_path,
    body                 := pg_catalog.jsonb_build_object(
                              'job',          p_job,
                              'runId',        v_run,
                              'scheduledFor', v_slot,
                              'timeoutMs',    d.timeout_ms
                            ),
    headers              := v_headers,
    timeout_milliseconds := d.timeout_ms
  ) into v_request;

  update jobs.job_run set request_id = v_request where id = v_run;
  return v_run;
end;
$$;

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

  -- O equivalente honesto do preventOverrun.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_job, 0)) then
    insert into jobs.job_run (job_name, scheduled_for, status, trigger, error)
    values (p_job, v_slot, 'skipped', p_trigger, 'execucao anterior em andamento');
    return;
  end if;

  perform pg_catalog.set_config('statement_timeout', d.timeout_ms::text, true);

  begin
    execute pg_catalog.format('select %s()', d.sql_function) into v_stats;
  exception when others then
    v_erro := pg_catalog.sqlstate || ': ' || pg_catalog.sqlerrm;
  end;

  -- Job de runtime so entra no ledger quando agiu ou falhou. Liveness dele se
  -- prova em cron.job_run_details, que registra toda execucao.
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

create or replace function jobs.sync_schedules()
returns table (job text, acao text)
language plpgsql
set search_path = ''
as $$
declare
  d record;
begin
  for d in select * from jobs.job_definition order by name loop
    if d.kind = 'sql' and pg_catalog.to_regprocedure(d.sql_function || '()') is null then
      raise exception 'job %: funcao % nao existe', d.name, d.sql_function;
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

comment on function jobs.sync_schedules() is
  'Aplica jobs.job_definition ao cron.job. Ninguem chama cron.schedule a mao.';

-- ---------------------------------------------------------------------------
-- Jobs do proprio runtime
-- ---------------------------------------------------------------------------

create or replace function jobs.reconcile()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_expiradas    integer := 0;
  v_redisparadas integer := 0;
  v_fuso_ok      boolean;
  r              record;
begin
  -- (a) execucao pendurada alem do proprio timeout vira falha.
  with travadas as (
    update jobs.job_run jr
       set status = 'failed',
           finished_at = pg_catalog.now(),
           error = pg_catalog.coalesce(
             (select 'http ' || resp.status_code::text ||
                     pg_catalog.coalesce(' ' || resp.error_msg, '')
                from net._http_response resp
               where resp.id = jr.request_id),
             'sem resposta registrada'
           )
      from jobs.job_definition d
     where d.name = jr.job_name
       and jr.status in ('dispatched','running')
       and pg_catalog.coalesce(jr.started_at, jr.created_at) <
           pg_catalog.now() - (d.timeout_ms * interval '1 millisecond') - interval '60 seconds'
    returning jr.id
  )
  select pg_catalog.count(*)::integer into v_expiradas from travadas;

  -- (b) retry, preservando o scheduled_for original.
  for r in
    select jr.job_name, jr.scheduled_for, jr.attempt
      from jobs.job_run jr
      join jobs.job_definition d on d.name = jr.job_name
     where jr.status in ('failed','partial')
       and d.enabled
       and d.kind = 'http'
       and jr.attempt < d.max_attempts
       and jr.created_at > pg_catalog.now() - interval '1 day'
       and not exists (
         select 1 from jobs.job_run mais_nova
          where mais_nova.job_name = jr.job_name
            and mais_nova.scheduled_for = jr.scheduled_for
            and mais_nova.attempt > jr.attempt
       )
  loop
    perform jobs.trigger_http(r.job_name, 'retry', (r.attempt + 1)::smallint, r.scheduled_for);
    v_redisparadas := v_redisparadas + 1;
  end loop;

  -- (c) fio-terra de horario de verao.
  select utc_offset = interval '-3 hours' into v_fuso_ok
    from pg_catalog.pg_timezone_names
   where name = 'America/Sao_Paulo';

  if not pg_catalog.coalesce(v_fuso_ok, false) then
    raise warning 'America/Sao_Paulo deixou de ser UTC-3: as agendas em UTC precisam ser revistas';
  end if;

  return pg_catalog.jsonb_build_object(
    'acted',      (v_expiradas + v_redisparadas) > 0,
    'expired',    v_expiradas,
    'retried',    v_redisparadas,
    'timezoneOk', pg_catalog.coalesce(v_fuso_ok, false)
  );
end;
$$;

create or replace function jobs.prune_history()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_cron   integer;
  v_ledger integer;
begin
  -- A Supabase avisa que cron.job_run_details cresce sem limite e atrapalha
  -- upgrade in-place. Depende do grant que ela da ao papel postgres sobre o
  -- schema cron; se um restore nao reaplicar, este job falha — e falhar e o
  -- comportamento certo, porque aparece no digest.
  delete from cron.job_run_details
   where start_time < pg_catalog.now() - interval '30 days';
  get diagnostics v_cron = row_count;

  delete from jobs.job_run
   where created_at < pg_catalog.now() - interval '90 days';
  get diagnostics v_ledger = row_count;

  return pg_catalog.jsonb_build_object(
    'acted',      (v_cron + v_ledger) > 0,
    'cronRows',   v_cron,
    'ledgerRows', v_ledger
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Observabilidade
-- ---------------------------------------------------------------------------

create or replace view jobs.v_job_health as
select d.name,
       d.schedule_label,
       d.enabled,
       r.status  as last_status,
       r.trigger as last_trigger,
       r.attempt as last_attempt,
       r.started_at,
       r.finished_at,
       extract(epoch from (r.finished_at - r.started_at)) * 1000 as duration_ms,
       r.stats,
       r.error
  from jobs.job_definition d
  left join lateral (
    select *
      from jobs.job_run x
     where x.job_name = d.name
       and x.status in ('succeeded','partial','failed')  -- ultimo estado terminal
     order by x.created_at desc
     limit 1
  ) r on true
 order by d.name;

comment on view jobs.v_job_health is
  'Uma linha por job, com a ultima execucao que chegou a estado terminal.';

-- ---------------------------------------------------------------------------
-- Definicoes
--
-- Horarios em UTC. Sao Paulo e UTC-3 fixo desde 2019, e cron.timezone no
-- Supabase e GMT, entao a conversao e aritmetica estavel.
--
-- O on conflict atualiza tudo MENOS enabled: reaplicar a migration nao pode
-- desligar agenda que ja esta no ar.
-- ---------------------------------------------------------------------------

insert into jobs.job_definition
  (name, kind, schedule_utc, schedule_label, sql_function, http_path, timeout_ms, max_attempts, description)
values
  ('cleanup-expired-pre-reservations', 'http', '*/30 * * * *', ':00 e :30 de cada hora',
   null, '/v1/internal/jobs/cleanup-expired-pre-reservations', 30000, 2,
   'Remove slots com pre-reserva expirada.'),

  ('cleanup-expired-reservations', 'http', '50 5 * * *', 'diario 02:50',
   null, '/v1/internal/jobs/cleanup-expired-reservations', 30000, 2,
   'Remove slots reservados de datas passadas.'),

  ('attendance-status-updater', 'http', '0 6 * * *', 'diario 03:00',
   null, '/v1/internal/jobs/attendance-status-updater', 120000, 3,
   'Consolida presenca do dia anterior, advertencias e bloqueios de conta.'),

  ('email-notification-data-collector', 'http', '10 6 * * *', 'diario 03:10',
   null, '/v1/internal/jobs/email-notification-data-collector', 240000, 3,
   'Envia ate 60 notificacoes por execucao, a 1 e-mail/s. Retomavel: devolve partial com o que sobrou.'),

  ('weekly-compliance-wednesday-reminder', 'http', '0 5 * * 3', 'quarta 02:00',
   null, '/v1/internal/jobs/weekly-compliance-wednesday-reminder', 60000, 3,
   'Lembra por BCC os colaboradores ainda nao compliant para a proxima semana.'),

  ('weekly-compliance-friday-report', 'http', '0 5 * * 5', 'sexta 02:00',
   null, '/v1/internal/jobs/weekly-compliance-friday-report', 180000, 3,
   'Envia pendencias a supervisores e relatorio consolidado a diretores.'),

  ('weekly-early-checkout-monday-reminder', 'http', '10 5 * * 1', 'segunda 02:10',
   null, '/v1/internal/jobs/weekly-early-checkout-monday-reminder', 180000, 3,
   'Envia a supervisores as ocorrencias pendentes de checkout antecipado.'),

  ('internal-jobs-reconcile', 'sql', '*/5 * * * *', 'a cada 5 minutos',
   'jobs.reconcile', null, 30000, 1,
   'Watchdog: expira execucao travada, redispara ate max_attempts e confere o fuso.'),

  ('internal-jobs-prune-history', 'sql', '0 7 * * 0', 'domingo 04:00',
   'jobs.prune_history', null, 60000, 1,
   'Poda cron.job_run_details (30 dias) e jobs.job_run (90 dias).')

on conflict (name) do update set
  kind           = excluded.kind,
  schedule_utc   = excluded.schedule_utc,
  schedule_label = excluded.schedule_label,
  sql_function   = excluded.sql_function,
  http_path      = excluded.http_path,
  timeout_ms     = excluded.timeout_ms,
  max_attempts   = excluded.max_attempts,
  description    = excluded.description,
  updated_at     = now();

-- Deliberadamente NAO chamamos jobs.sync_schedules() aqui: com tudo em
-- enabled = false ela so desagendaria, e ligar as agendas e acao humana.
