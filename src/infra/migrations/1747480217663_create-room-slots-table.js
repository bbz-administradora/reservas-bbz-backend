/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // extensão necessária para usar GiST em tipos nativos
  pgm.createExtension('btree_gist', { ifNotExists: true })

  pgm.createTable('room_slots', {
    id: {
      type: 'uuid',
      notNull: true,
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    room_id: {
      type: 'uuid',
      notNull: true,
      references: 'rooms(id)',
      onDelete: 'CASCADE',
    },
    slot_range: {
      // intervalo de início e fim com timezone
      type: 'tstzrange',
      notNull: true,
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      check: "status IN ('pre_reserved', 'reserved')",
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      notNull: true,
      onDelete: 'SET NULL',
    },
    pre_reserved_until: {
      type: 'timestamp with time zone',
      notNull: true,
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() AT TIME ZONE 'utc')"),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() AT TIME ZONE 'utc')"),
    },
  })

  // evita sobreposição de slots na mesma sala
  pgm.addConstraint(
    'room_slots',
    'no_overlapping_slots_per_room',
    'EXCLUDE USING gist (room_id WITH =, slot_range WITH &&)',
  )

  // índice para buscas por intervalo
  pgm.createIndex('room_slots', 'slot_range', {
    using: 'gist',
  })

  pgm.sql(`ALTER TABLE room_slots ENABLE ROW LEVEL SECURITY;`)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE room_slots DISABLE ROW LEVEL SECURITY;`)
  pgm.dropTable('room_slots')
  pgm.dropConstraint('room_slots', 'no_overlapping_slots_per_room')
  pgm.dropIndex('room_slots', 'slot_range', {
    using: 'gist',
  })
  pgm.dropExtension('btree_gist', { ifExists: true })
}
