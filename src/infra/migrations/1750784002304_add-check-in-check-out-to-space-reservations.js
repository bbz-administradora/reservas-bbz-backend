/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.addColumns('space_reservations', {
    check_in_at: {
      type: 'timestamp with time zone',
      notNull: false,
    },
    check_out_at: {
      type: 'timestamp with time zone',
      notNull: false,
    },
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropColumns('space_reservations', ['check_in_at', 'check_out_at'])
}
