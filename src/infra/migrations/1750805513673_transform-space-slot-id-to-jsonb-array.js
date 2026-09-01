/**
 * Migração para transformar o campo space_slot_id em um array JSONB (space_slot_ids)
 *
 * MOTIVAÇÃO:
 * -------------
 * Antes desta migração, cada reserva de espaço tinha uma relação 1:1 com um slot_id,
 * o que significava que, para uma única reserva que abrangia múltiplos slots horários,
 * precisávamos criar múltiplas linhas na tabela space_reservations, repetindo todos os
 * dados da reserva para cada slot_id. Isso causava:
 *
 * 1. Redundância de dados: todos os metadados da reserva eram duplicados para cada slot
 * 2. Maior volume de dados na tabela space_reservations
 * 3. Complexidade adicional para encontrar todos os registros relacionados a uma única reserva lógica
 *
 * SOLUÇÃO:
 * -------------
 * Com esta migração, agora armazenamos:
 * - Uma única linha na tabela space_reservations para cada reserva
 * - Um array JSONB de UUIDs contendo todos os space_slot_ids associados à reserva
 * - O slot_range representa o intervalo completo da reserva (hora inicial até hora final)
 *
 * BENEFÍCIOS:
 * -------------
 * 1. Redução significativa no volume de dados
 * 2. Estrutura de dados mais coerente com o modelo conceitual (uma reserva = uma linha)
 * 3. Simplificação de queries relacionadas a reservas
 * 4. Facilita operações em lote nos slots (cancelamento, fechamento)
 *
 * OBSERVAÇÕES IMPORTANTES:
 * -------------
 * - Existe um job que apaga os space_slots do dia anterior, independentemente do status
 * - Os IDs dos slots são relevantes apenas para operações no mesmo dia (cancelamento/fechamento)
 * - Após a execução do job, os IDs no array podem apontar para registros inexistentes,
 *   mas isso não afeta a integridade da reserva, pois mantemos o slot_range
 * - Esta abordagem mantém as tabelas space_reservations e space_slots mais enxutas
 *   e com dados históricos mais relevantes
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Primeiro, desabilitar RLS na tabela
  pgm.sql(`ALTER TABLE space_reservations DISABLE ROW LEVEL SECURITY;`)

  // 1. Adicionar nova coluna space_slot_ids como jsonb
  pgm.addColumn('space_reservations', {
    space_slot_ids: {
      type: 'jsonb',
      notNull: false,
      default: pgm.func(`'[]'::jsonb`),
    },
  })

  // 2. Migrar dados da coluna existente para a nova coluna como array
  pgm.sql(`
    UPDATE space_reservations
    SET space_slot_ids = jsonb_build_array(space_slot_id)
    WHERE space_slot_id IS NOT NULL;
  `)

  // 3. Remover a coluna antiga space_slot_id e seu constraint
  pgm.dropConstraint(
    'space_reservations',
    'space_reservations_space_slot_id_fkey',
  )
  pgm.dropColumn('space_reservations', 'space_slot_id')

  // 4. Adicionar um índice GIN para melhorar a performance de consultas no array de slot IDs
  pgm.createIndex('space_reservations', 'space_slot_ids', {
    name: 'idx_space_reservations_space_slot_ids',
    method: 'GIN',
  })

  // 5. Reabilitar RLS na tabela
  pgm.sql(`ALTER TABLE space_reservations ENABLE ROW LEVEL SECURITY;`)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Primeiro, desabilitar RLS na tabela
  pgm.sql(`ALTER TABLE space_reservations DISABLE ROW LEVEL SECURITY;`)

  // 1. Remover o índice GIN
  pgm.dropIndex('space_reservations', 'space_slot_ids', {
    name: 'idx_space_reservations_space_slot_ids',
  })

  // 2. Adicionar a coluna space_slot_id novamente
  pgm.addColumn('space_reservations', {
    space_slot_id: {
      type: 'uuid',
      notNull: false,
      references: 'space_slots(id)',
      onDelete: 'SET NULL',
    },
  })

  // 3. Migrar o primeiro ID do array de volta para a coluna space_slot_id
  pgm.sql(`
    UPDATE space_reservations
    SET space_slot_id = (space_slot_ids->0)::text::uuid
    WHERE jsonb_array_length(space_slot_ids) > 0;
  `)

  // 4. Remover a coluna space_slot_ids
  pgm.dropColumn('space_reservations', 'space_slot_ids')

  // 5. Reabilitar RLS na tabela
  pgm.sql(`ALTER TABLE space_reservations ENABLE ROW LEVEL SECURITY;`)
}
