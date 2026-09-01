/**
 * Adiciona coluna de motivo/justificativa do afastamento:
 *   - absence_reason: Texto livre explicando o motivo (férias, licença médica, etc.)
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = function (pgm) {
  pgm.addColumn('users', {
    absence_reason: {
      type: 'text',
      notNull: false,
      default: null,
      comment:
        'Motivo/justificativa do afastamento (férias, licença médica, etc.). Texto livre.',
    },
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = function (pgm) {
  pgm.dropColumn('users', 'absence_reason')
}
