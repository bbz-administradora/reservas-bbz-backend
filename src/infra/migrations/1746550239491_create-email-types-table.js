/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable('email_types', {
    id: {
      type: 'serial',
      notNull: true,
      primaryKey: true,
    },
    type: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    description: {
      type: 'text',
      notNull: false,
    },
  })

  pgm.sql(`ALTER TABLE email_types ENABLE ROW LEVEL SECURITY;`)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Desativa o Row-Level Security
  pgm.sql(`ALTER TABLE email_types DISABLE ROW LEVEL SECURITY;`)

  // Remove a tabela email_types
  pgm.dropTable('email_types')
}
