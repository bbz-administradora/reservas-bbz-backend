/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
/**
 * Fluxo de atualização dos status:
 *
 * attendance_status:
 *   - Inicia como 'pending' (job ainda não avaliou a reserva)
 *   - Se reserva não está fechada/cancelada e não tem check-in: 'absent'
 *   - Se reserva não está fechada/cancelada e tem check-in: 'checked-in'
 *   - Se reserva não está fechada/cancelada e tem check-in e check-out: 'checked-out'
 *   - Se reserva está fechada/cancelada: 'not-applicable'
 *
 * email_notification_status:
 *   - Inicia como 'not-evaluated' (ainda não foi avaliada pelo job)
 *   - Se reserva está fechada/cancelada: 'not-required'
 *   - Se não está fechada/cancelada e não tem check-in/check-out: 'pending' (pendente de envio de e-mail)
 *   - Se não está fechada/cancelada e só tem check-in: 'pending' (pendente de envio de e-mail)
 *   - Se não está fechada/cancelada e tem check-in e check-out: 'not-required'
 *   - Quando o e-mail é enviado: 'sent'
 *   - Se houver erro no envio: 'error' (será retentado na próxima execução do job)
 */
exports.up = function (pgm) {
  pgm.addColumn('space_reservations', {
    attendance_status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'pending',
      comment:
        'Status de presença da reserva. Valores: pending (job não avaliou), checked-in (fez check-in), checked-out (fez check-in e check-out), absent (não compareceu), not-applicable (fechada/cancelada).',
      check:
        "attendance_status IN ('pending', 'checked-in', 'checked-out', 'absent', 'not-applicable')",
    },
    email_notification_status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'not-evaluated',
      comment:
        'Status do envio de e-mail. Valores: not-evaluated (ainda não avaliada), pending (pendente de envio), sent (e-mail enviado), not-required (não precisa e-mail), error (erro ao enviar e-mail).',
      check:
        "email_notification_status IN ('not-evaluated', 'pending', 'sent', 'not-required', 'error')",
    },
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = function (pgm) {
  pgm.dropColumns('space_reservations', [
    'attendance_status',
    'email_notification_status',
  ])
}
