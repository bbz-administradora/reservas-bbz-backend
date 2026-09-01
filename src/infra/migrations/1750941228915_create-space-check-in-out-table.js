/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable('space_check_in_out', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
    },
    space_id: {
      type: 'uuid',
      notNull: true,
      references: 'spaces(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    reservation_id: {
      type: 'uuid',
      notNull: true,
      references: 'space_reservations(id)',
      onDelete: 'CASCADE',
    },
    type: {
      type: 'varchar(20)',
      notNull: true,
      check: "type IN ('check-in', 'check-out')",
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
    },
  })

  // Ativa o Row-Level Security na tabela
  pgm.sql(`ALTER TABLE space_check_in_out ENABLE ROW LEVEL SECURITY;`)

  // Adiciona restrição de unicidade para space_id, user_id, reservation_id e type
  pgm.addConstraint(
    'space_check_in_out',
    'unique_space_user_reservation_type',
    {
      unique: ['space_id', 'user_id', 'reservation_id', 'type'],
    },
  )

  // Índice para melhorar a performance de consultas por reservation_id
  pgm.createIndex('space_check_in_out', 'reservation_id')

  // Índice para melhorar a performance de consultas por space_id e user_id
  pgm.createIndex('space_check_in_out', ['space_id', 'user_id'])

  // Índice para melhorar a performance de consultas por created_at
  pgm.createIndex('space_check_in_out', 'created_at')
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Remove os índices
  pgm.dropIndex('space_check_in_out', 'reservation_id')
  pgm.dropIndex('space_check_in_out', ['space_id', 'user_id'])
  pgm.dropIndex('space_check_in_out', 'created_at')

  // Remove a restrição de unicidade
  pgm.dropConstraint('space_check_in_out', 'unique_space_user_reservation_type')

  // Desativa o Row-Level Security
  pgm.sql(`ALTER TABLE space_check_in_out DISABLE ROW LEVEL SECURITY;`)

  // Remove a tabela
  pgm.dropTable('space_check_in_out')
}
