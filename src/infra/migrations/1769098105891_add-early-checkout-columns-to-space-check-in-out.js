/**
 * Migration: Adicionar colunas para controle de checkout antecipado
 *
 * Esta migration adiciona as colunas necessárias para detectar e gerenciar
 * ocorrências de checkout antecipado em workstations. A jornada mínima é de
 * 9 horas, com tolerância de 15 minutos (mínimo 8h45 trabalhadas).
 *
 * Novas colunas:
 * - is_early_checkout: Flag indicando se foi checkout antecipado
 * - early_checkout_status: Status da ocorrência (pending, justified, dismissed)
 * - worked_hours: Horas trabalhadas entre check-in e check-out
 * - justification: Texto da justificativa do supervisor
 * - justified_by: ID do supervisor que justificou
 * - justified_at: Data/hora da justificativa
 */

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Adicionar coluna is_early_checkout
  pgm.addColumn('space_check_in_out', {
    is_early_checkout: {
      type: 'boolean',
      notNull: false,
      default: null,
    },
  })

  // Adicionar coluna early_checkout_status
  pgm.addColumn('space_check_in_out', {
    early_checkout_status: {
      type: 'varchar(20)',
      notNull: false,
      default: null,
      check:
        "early_checkout_status IS NULL OR early_checkout_status IN ('pending', 'justified', 'dismissed')",
    },
  })

  // Adicionar coluna worked_hours (horas trabalhadas)
  pgm.addColumn('space_check_in_out', {
    worked_hours: {
      type: 'decimal(5,2)',
      notNull: false,
      default: null,
    },
  })

  // Adicionar coluna justification (texto da justificativa)
  pgm.addColumn('space_check_in_out', {
    justification: {
      type: 'text',
      notNull: false,
      default: null,
    },
  })

  // Adicionar coluna justified_by (FK para users)
  pgm.addColumn('space_check_in_out', {
    justified_by: {
      type: 'uuid',
      notNull: false,
      default: null,
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
  })

  // Adicionar coluna justified_at (data/hora da justificativa)
  pgm.addColumn('space_check_in_out', {
    justified_at: {
      type: 'timestamp with time zone',
      notNull: false,
      default: null,
    },
  })

  // Criar índice para is_early_checkout (para buscar ocorrências rapidamente)
  pgm.createIndex('space_check_in_out', 'is_early_checkout', {
    where: 'is_early_checkout = true',
  })

  // Criar índice para early_checkout_status (para filtrar por status)
  pgm.createIndex('space_check_in_out', 'early_checkout_status', {
    where: 'early_checkout_status IS NOT NULL',
  })

  // Criar índice composto para buscas de ocorrências pendentes
  pgm.createIndex(
    'space_check_in_out',
    ['is_early_checkout', 'early_checkout_status'],
    {
      name: 'idx_space_check_in_out_early_checkout_pending',
      where: "is_early_checkout = true AND early_checkout_status = 'pending'",
    },
  )
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Remover índices
  pgm.dropIndex(
    'space_check_in_out',
    ['is_early_checkout', 'early_checkout_status'],
    {
      name: 'idx_space_check_in_out_early_checkout_pending',
    },
  )
  pgm.dropIndex('space_check_in_out', 'early_checkout_status')
  pgm.dropIndex('space_check_in_out', 'is_early_checkout')

  // Remover colunas
  pgm.dropColumn('space_check_in_out', 'justified_at')
  pgm.dropColumn('space_check_in_out', 'justified_by')
  pgm.dropColumn('space_check_in_out', 'justification')
  pgm.dropColumn('space_check_in_out', 'worked_hours')
  pgm.dropColumn('space_check_in_out', 'early_checkout_status')
  pgm.dropColumn('space_check_in_out', 'is_early_checkout')
}
