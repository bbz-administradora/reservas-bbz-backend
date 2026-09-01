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
  // Cria o tipo enum para a coluna role se não existir
  pgm.db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE "user_role" AS ENUM ('dev', 'admin', 'user');
      END IF;
    END
    $$;
  `)

  pgm.createTable('users', {
    id: {
      type: 'uuid',
      default: pgm.func('gen_random_uuid()'),
      notNull: true,
      primaryKey: true,
    },
    name: {
      type: 'varchar(255)',
      notNull: false,
    },
    nick_name: {
      type: 'varchar(255)',
      notNull: false,
    },
    email: {
      type: 'varchar(254)',
      notNull: true,
      unique: true,
    },
    email_verified: {
      type: 'timestamp',
      notNull: false,
    },
    email_verified_provider: {
      type: 'varchar(255)',
      notNull: false,
    },
    avatar: {
      type: 'text',
      notNull: false,
    },
    password_hash: {
      type: 'varchar(60)',
      notNull: false,
    },
    password_reset_required: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    phone: {
      type: 'varchar(20)',
      notNull: false,
    },
    account_status: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    role: {
      type: 'user_role',
      notNull: true,
      default: 'user',
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

  // Ativa o Row-Level Security na tabela users
  pgm.sql(`ALTER TABLE users ENABLE ROW LEVEL SECURITY;`)

  // Adiciona uma política de RLS que impede qualquer operação na tabela users para o app_user
  // pgm.sql(`
  //   CREATE POLICY no_insert ON users
  //   FOR INSERT
  //   TO app_user
  //   WITH CHECK (false);
  // `)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Remove a política de RLS
  // pgm.sql(`DROP POLICY IF EXISTS no_access ON users;`)

  // Desativa o Row-Level Security
  pgm.sql(`ALTER TABLE users DISABLE ROW LEVEL SECURITY;`)

  // Remove a tabela users
  pgm.dropTable('users')

  // Remove o tipo enum user_role
  pgm.dropType('user_role')
}
