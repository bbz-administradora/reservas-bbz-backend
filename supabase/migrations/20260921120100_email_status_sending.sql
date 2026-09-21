-- Acrescenta 'sending' aos valores aceitos por
-- space_reservations.email_notification_status.
--
-- O job de e-mail passa a reservar a linha ANTES de enviar. Sem isso, morrer
-- entre o envio e a marcacao faz a proxima execucao reenviar o mesmo e-mail —
-- defeito que ja existia e que fica mais provavel agora que existe retry
-- automatico.
--
-- Postgres nao tem `add constraint if not exists`, entao a troca e drop + add
-- dentro de um bloco do, para o arquivo poder ser reexecutado.

do $$
begin
  alter table public.space_reservations
    drop constraint if exists space_reservations_email_notification_status_check;

  alter table public.space_reservations
    add constraint space_reservations_email_notification_status_check
    check (
      email_notification_status in (
        'not-evaluated',
        'pending',
        'sending',
        'sent',
        'not-required',
        'error'
      )
    );
end $$;

comment on column public.space_reservations.email_notification_status is
  'Status do envio de e-mail. Valores: not-evaluated (ainda nao avaliada), pending (pendente de envio), sending (linha reservada por uma execucao em andamento), sent (e-mail enviado), not-required (nao precisa e-mail), error (erro ao enviar e-mail).';
