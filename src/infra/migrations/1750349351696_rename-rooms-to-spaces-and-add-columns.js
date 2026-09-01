/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Primeiro, desabilitar RLS nas tabelas
  pgm.sql(`ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;`)
  pgm.sql(`ALTER TABLE room_slots DISABLE ROW LEVEL SECURITY;`)
  pgm.sql(`ALTER TABLE room_reservations DISABLE ROW LEVEL SECURITY;`)

  // 1. Renomear tabelas
  pgm.renameTable('rooms', 'spaces')
  pgm.renameTable('room_slots', 'space_slots')
  pgm.renameTable('room_reservations', 'space_reservations')

  // 2. Renomear FK nas tabelas
  pgm.renameConstraint(
    'space_slots',
    'room_slots_room_id_fkey',
    'space_slots_space_id_fkey',
  )
  pgm.renameConstraint(
    'space_reservations',
    'room_reservations_room_id_fkey',
    'space_reservations_space_id_fkey',
  )
  pgm.renameConstraint(
    'space_reservations',
    'room_reservations_room_slot_id_fkey',
    'space_reservations_space_slot_id_fkey',
  )

  // 3. Renomear colunas que ainda têm referência a "room"
  pgm.renameColumn('space_slots', 'room_id', 'space_id')
  pgm.renameColumn('space_reservations', 'room_id', 'space_id')
  pgm.renameColumn('space_reservations', 'room_slot_id', 'space_slot_id')

  // 4. Adicionar novas colunas à tabela spaces (antiga rooms)
  pgm.addColumn('spaces', {
    type: {
      type: 'varchar(20)',
      notNull: true,
      default: 'room', // Os espaços existentes serão do tipo 'room'
      check: "type IN ('room', 'workstation')",
    },
    floor: {
      type: 'varchar(10)',
      notNull: false,
    },
    zone: {
      type: 'varchar(50)',
      notNull: false,
    },
    position: {
      type: 'varchar(50)',
      notNull: false,
    },
  })

  // 5. Renomear o constraint que evita sobreposição de slots
  pgm.renameConstraint(
    'space_slots',
    'no_overlapping_slots_per_room',
    'no_overlapping_slots_per_space',
  )

  // 5.1 Renomear o constraint que evita nomes duplicados
  pgm.sql(
    `ALTER TABLE spaces RENAME CONSTRAINT rooms_name_key TO spaces_name_key;`,
  )

  // 6. Recriar índice em space_slots se necessário
  pgm.createIndex('space_slots', ['space_id', 'slot_range'], {
    name: 'idx_space_slots_space_id_slot_range',
    using: 'gist',
  })

  // 7. Reabilitar RLS nas tabelas
  pgm.sql(`ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;`)
  pgm.sql(`ALTER TABLE space_slots ENABLE ROW LEVEL SECURITY;`)
  pgm.sql(`ALTER TABLE space_reservations ENABLE ROW LEVEL SECURITY;`)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Primeiro, desabilitar RLS nas tabelas
  pgm.sql(`ALTER TABLE spaces DISABLE ROW LEVEL SECURITY;`)
  pgm.sql(`ALTER TABLE space_slots DISABLE ROW LEVEL SECURITY;`)
  pgm.sql(`ALTER TABLE space_reservations DISABLE ROW LEVEL SECURITY;`)

  // 1. Remover as novas colunas da tabela spaces
  pgm.dropColumn('spaces', 'type')
  pgm.dropColumn('spaces', 'floor')
  pgm.dropColumn('spaces', 'zone')
  pgm.dropColumn('spaces', 'position')

  // 2. Remover índice se foi criado na migração up
  pgm.dropIndex('space_slots', ['space_id', 'slot_range'], {
    name: 'idx_space_slots_space_id_slot_range',
  })

  // 3. Renomear colunas de volta para referências a "room"
  pgm.renameColumn('space_slots', 'space_id', 'room_id')
  pgm.renameColumn('space_reservations', 'space_id', 'room_id')
  pgm.renameColumn('space_reservations', 'space_slot_id', 'room_slot_id')

  // 4. Renomear constraint que evita sobreposição
  pgm.renameConstraint(
    'space_slots',
    'no_overlapping_slots_per_space',
    'no_overlapping_slots_per_room',
  )

  // 4.1 Reverter renomeação do constraint de nomes únicos
  pgm.sql(
    `ALTER TABLE spaces RENAME CONSTRAINT spaces_name_key TO rooms_name_key;`,
  )

  // 5. Renomear FK nas tabelas de volta
  pgm.renameConstraint(
    'space_slots',
    'space_slots_space_id_fkey',
    'room_slots_room_id_fkey',
  )
  pgm.renameConstraint(
    'space_reservations',
    'space_reservations_space_id_fkey',
    'room_reservations_room_id_fkey',
  )
  pgm.renameConstraint(
    'space_reservations',
    'space_reservations_space_slot_id_fkey',
    'room_reservations_room_slot_id_fkey',
  )

  // 6. Renomear tabelas de volta
  pgm.renameTable('spaces', 'rooms')
  pgm.renameTable('space_slots', 'room_slots')
  pgm.renameTable('space_reservations', 'room_reservations')

  // 7. Reabilitar RLS nas tabelas
  pgm.sql(`ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;`)
  pgm.sql(`ALTER TABLE room_slots ENABLE ROW LEVEL SECURITY;`)
  pgm.sql(`ALTER TABLE room_reservations ENABLE ROW LEVEL SECURITY;`)
}
