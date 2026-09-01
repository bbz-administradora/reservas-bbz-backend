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
  pgm.createTable('verification_tokens', {
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    token: {
      type: 'uuid',
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
      unique: true,
    },
    token_type: {
      type: 'varchar(255)',
      notNull: true,
    },
    expires: {
      type: 'timestamp with time zone',
      notNull: true,
    },
    opt: {
      type: 'varchar(6)',
      notNull: true,
      default: pgm.func("LPAD((floor(random() * 1000000)::int)::text, 6, '0')"), // Gera um número de 6 dígitos
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

  // Add unique constraint for user_id and token
  pgm.addConstraint('verification_tokens', 'unique_user_id_token', {
    unique: ['user_id', 'token_type'],
  })

  // Ativa o Row-Level Security na tabela accounts
  pgm.sql(`ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;`)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // remove constraint unique_user_id_token
  pgm.dropConstraint('verification_tokens', 'unique_user_id_token')

  // remove RLS from verification_tokens
  pgm.sql(`ALTER TABLE verification_tokens DISABLE ROW LEVEL SECURITY;`)

  // Drop the verification_token table
  pgm.dropTable('verification_tokens')
}
