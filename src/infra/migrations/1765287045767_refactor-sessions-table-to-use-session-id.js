/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * Migração para refatorar a tabela sessions para usar session_id como chave primária
 * e remover a coluna session_token que não é mais necessária.
 *
 * Esta mudança alinha a estrutura com o padrão do Pontuei onde:
 * - session_id é a chave primária (antes era 'id')
 * - session_token é removido (o refresh token não precisa ser armazenado no banco)
 * - updated_at é removido (não é necessário para sessões)
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // 1. Renomear a coluna 'id' para 'session_id'
  pgm.renameColumn('sessions', 'id', 'session_id')

  // 2. Remover a coluna 'session_token' (não é mais necessária)
  pgm.dropColumn('sessions', 'session_token')

  // 3. Remover a coluna 'updated_at' (não é necessária para sessões)
  pgm.dropColumn('sessions', 'updated_at')
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // 1. Adicionar de volta a coluna 'updated_at'
  pgm.addColumn('sessions', {
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
    },
  })

  // 2. Adicionar de volta a coluna 'session_token'
  pgm.addColumn('sessions', {
    session_token: {
      type: 'text',
      notNull: true,
      unique: true,
      default: pgm.func('gen_random_uuid()::text'), // Valor temporário para registros existentes
    },
  })

  // 3. Renomear 'session_id' de volta para 'id'
  pgm.renameColumn('sessions', 'session_id', 'id')
}
