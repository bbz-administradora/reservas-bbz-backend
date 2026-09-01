/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = function (pgm) {
  pgm.createTable('backup_logs', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    backup_key: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
    },
  })

  pgm.createIndex('backup_logs', 'created_at')
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = function (pgm) {
  pgm.dropTable('backup_logs')
}
