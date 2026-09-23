/**
 * Acrescenta 'sending' aos valores aceitos por
 * space_reservations.email_notification_status.
 *
 * Espelha supabase/migrations/20260921120100_email_status_sending.sql, que é o
 * caminho de produção. Esta versão existe para o Postgres local do compose, que
 * é migrado pelo node-pg-migrate.
 *
 * O job de e-mail passa a reservar a linha antes de enviar: sem isso, morrer
 * entre o envio e a marcação reenvia o mesmo e-mail na execução seguinte.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

const CONSTRAINT = 'space_reservations_email_notification_status_check'

const VALORES_NOVOS = [
  'not-evaluated',
  'pending',
  'sending',
  'sent',
  'not-required',
  'error',
]

const VALORES_ANTIGOS = [
  'not-evaluated',
  'pending',
  'sent',
  'not-required',
  'error',
]

function checagem(valores) {
  const lista = valores.map((valor) => `'${valor}'`).join(', ')
  return `email_notification_status IN (${lista})`
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = function (pgm) {
  pgm.dropConstraint('space_reservations', CONSTRAINT, { ifExists: true })
  pgm.addConstraint('space_reservations', CONSTRAINT, {
    check: checagem(VALORES_NOVOS),
  })

  pgm.sql(`
    COMMENT ON COLUMN space_reservations.email_notification_status IS
      'Status do envio de e-mail. Valores: not-evaluated (ainda não avaliada), pending (pendente de envio), sending (linha reservada por uma execução em andamento), sent (e-mail enviado), not-required (não precisa e-mail), error (erro ao enviar e-mail).'
  `)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = function (pgm) {
  // Linhas presas em 'sending' precisam voltar para 'error' antes de o
  // constraint antigo valer de novo, senão o ALTER falha.
  pgm.sql(`
    UPDATE space_reservations
    SET email_notification_status = 'error'
    WHERE email_notification_status = 'sending'
  `)

  pgm.dropConstraint('space_reservations', CONSTRAINT, { ifExists: true })
  pgm.addConstraint('space_reservations', CONSTRAINT, {
    check: checagem(VALORES_ANTIGOS),
  })
}
