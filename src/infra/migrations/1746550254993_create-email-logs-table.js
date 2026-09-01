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
  pgm.createTable('email_logs', {
    id: {
      type: 'uuid',
      default: pgm.func('gen_random_uuid()'),
      notNull: true,
      primaryKey: true,
    },
    email_types_id: {
      type: 'serial',
      notNull: true,
      references: 'email_types(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: false,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    to: {
      type: 'varchar(254)',
      notNull: true,
    },
    cc: {
      type: 'varchar(254)',
      notNull: false,
    },
    bcc: {
      type: 'varchar(254)',
      notNull: false,
    },
    subject: {
      type: 'varchar(255)',
      notNull: true,
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
    },
    response: {
      type: 'text',
      notNull: false,
    },
  })

  // Ativa o Row-Level Security na tabela email_logs
  pgm.sql(`ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;`)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Desativa o Row-Level Security
  pgm.sql(`ALTER TABLE email_logs DISABLE ROW LEVEL SECURITY;`)

  // Remove a tabela email_logs
  pgm.dropTable('email_logs')
}
