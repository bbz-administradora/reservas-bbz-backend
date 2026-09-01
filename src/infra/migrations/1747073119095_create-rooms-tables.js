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
  pgm.createTable('rooms', {
    id: {
      type: 'uuid',
      notNull: true,
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"(id)',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    description: {
      type: 'text',
      notNull: false,
    },
    recursos: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func(`'[]'::jsonb`),
    },
    imagens: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func(`'[]'::jsonb`),
    },
    capacidade: {
      type: 'integer',
      notNull: true,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
    },
  })

  // Se estiver usando Row-Level Security
  pgm.sql(`ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;`)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Desabilita o Row-Level Security
  pgm.sql(`ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;`)

  pgm.dropTable('rooms')
}
