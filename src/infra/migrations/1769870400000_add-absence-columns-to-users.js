/**
 * Colunas de afastamento/folga:
 *   - absence_start_date: Data de início do afastamento (férias, licença, etc.)
 *   - absence_end_date: Data de fim do afastamento
 *
 * Quando o usuário está "de folga":
 *   - Data atual está entre absence_start_date e absence_end_date (inclusive)
 *   - Usuário é excluído de TODOS os indicadores:
 *     - Compliance semanal
 *     - Checkout antecipado
 *     - Cancelamentos fora do prazo
 *
 * Para remover o afastamento:
 *   - Setar ambas as colunas como NULL
 *
 * Quem pode definir:
 *   - Admin/Dev: qualquer usuário
 *   - Diretor: qualquer usuário
 *   - Supervisor: apenas membros da própria equipe
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = function (pgm) {
  pgm.addColumn('users', {
    absence_start_date: {
      type: 'date',
      notNull: false,
      default: null,
      comment:
        'Data de início do afastamento (férias, licença, etc.). NULL = sem afastamento.',
    },
    absence_end_date: {
      type: 'date',
      notNull: false,
      default: null,
      comment: 'Data de fim do afastamento. NULL = sem afastamento.',
    },
  })

  // Criar índice para consultas de usuários em afastamento
  pgm.createIndex('users', ['absence_start_date', 'absence_end_date'], {
    name: 'idx_users_absence_dates',
    where: 'absence_start_date IS NOT NULL AND absence_end_date IS NOT NULL',
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = function (pgm) {
  pgm.dropIndex('users', ['absence_start_date', 'absence_end_date'], {
    name: 'idx_users_absence_dates',
  })
  pgm.dropColumn('users', 'absence_start_date')
  pgm.dropColumn('users', 'absence_end_date')
}
